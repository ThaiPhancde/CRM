import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb, runInWorkspace, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { auditFilter, changedKeys, listAuditLog } from "@/modules/admin/audit";
import { getConfig, saveCap, saveHours, saveLowStock, saveRouting, saveSla } from "@/modules/admin/config";
import { ERASED_NAME, eraseCustomerData, exportCustomerData } from "@/modules/admin/privacy";
import { nextSendable, workingHours } from "@/modules/marketing/journeys";
import { lowStockThresholds } from "@/modules/products/service";
import { loadRouting } from "@/modules/sales/routing";
import { dueDates, slaFor } from "@/modules/service/tickets";

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES_LEAD" | "FINANCE_VIEW")[]) => (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles })).id, ws.id))!;
  const [mgr, lead, fin] = [await u("mgr", ["MANAGER"]), await u("lead", ["SALES_LEAD"]), await u("fin", ["FINANCE_VIEW"])];
  return { ws, c, brand, store, mgr, lead, fin, as: <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn) };
}

describe("Phase 11.1 — cấu hình", () => {
  it("SLA, phân công, giới hạn liên hệ, giờ làm việc, tồn thấp: lưu có audit, kiểm hợp lệ, nghiệp vụ đọc đúng giá trị mới; thiếu quyền 403", async () => {
    const s = await setup("cfg");
    await expect(s.as(() => saveSla(s.lead, { priority: "CAO", firstResponseHours: 1, resolveHours: 4 }))).rejects.toMatchObject({ status: 403 });
    await expect(s.as(() => saveSla(s.mgr, { priority: "CAO", firstResponseHours: 5, resolveHours: 4 }))).rejects.toMatchObject({ fields: { resolveHours: "Hạn xử lý phải ≥ hạn phản hồi đầu" } });
    await s.as(() => saveSla(s.mgr, { priority: "CAO", firstResponseHours: 1, resolveHours: 6 }));
    await s.as(() => saveSla(s.mgr, { priority: "CAO", firstResponseHours: 1.5, resolveHours: 6 })); // sửa, không thêm dòng
    expect(await s.c.slaPolicy.count()).toBe(1);
    const now = new Date("2026-11-02T00:00:00Z");
    expect(dueDates(now, await slaFor(s.c, null, "CAO")).firstResponseDueAt.toISOString()).toBe("2026-11-02T01:30:00.000Z");

    await s.as(() => saveRouting(s.mgr, { firstResponseHours: "2", maxOpenPerUser: "30", autoCloseDays: "10", dedupeDays: "5" }));
    expect(await loadRouting(s.c)).toMatchObject({ firstResponseHours: 2, maxOpenPerUser: 30, autoCloseDays: 10, dedupeDays: 5 });

    await s.as(() => saveCap(s.mgr, { channel: "EMAIL", maxCount: "1", windowDays: "14" }));
    expect(await s.c.contactCap.findFirst({ where: { channel: "EMAIL", brandId: null } })).toMatchObject({ maxCount: 1, windowDays: 14 });

    await expect(s.as(() => saveHours(s.mgr, { market: "AE", from: "10", to: "" }))).rejects.toMatchObject({ fields: { to: expect.stringContaining("cả giờ") } });
    await expect(s.as(() => saveHours(s.mgr, { market: "AE", from: "10", to: "11" }))).rejects.toMatchObject({ fields: { to: "Khung gửi tối thiểu 2 giờ" } });
    await expect(s.as(() => saveHours(s.mgr, { market: "XX", from: "10", to: "18" }))).rejects.toMatchObject({ fields: { market: "Thị trường không thuộc team" } });
    await s.as(() => saveHours(s.mgr, { market: "AE", from: "10", to: "18" }));
    const win = (await workingHours(s.c))("AE");
    expect(win).toEqual({ from: 10, to: 18 });
    // 09:30 Dubai (05:30Z) ngoài khung 10–18 → dời tới 10:00 Dubai (06:00Z); khung mặc định 9–20 thì gửi ngay.
    expect(nextSendable(new Date("2026-11-02T05:30:00Z"), "Asia/Dubai", win).toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(nextSendable(new Date("2026-11-02T05:30:00Z"), "Asia/Dubai").toISOString()).toBe("2026-11-02T05:30:00.000Z");
    await s.as(() => saveHours(s.mgr, { market: "AE", from: "", to: "" })); // để trống → về mặc định
    expect((await workingHours(s.c))("AE")).toEqual({ from: 9, to: 20 });

    await s.as(() => saveLowStock(s.mgr, { market: "*", value: "25" }));
    await s.as(() => saveLowStock(s.mgr, { market: "AE", value: "5" }));
    const thr = await s.as(() => lowStockThresholds());
    expect([thr("AE"), thr("KW")]).toEqual([5, 25]);
    const cfg = await s.as(() => getConfig(s.mgr));
    expect(cfg.sla.find((x) => x.brandId === null && x.priority === "CAO")).toMatchObject({ firstResponseHours: 1.5, custom: true });
    expect(cfg.sla.find((x) => x.brandId === null && x.priority === "THAP")).toMatchObject({ firstResponseHours: 8, custom: false });
    expect(await s.c.auditLog.count({ where: { entity: { in: ["SlaPolicy", "Setting", "ContactCap"] } } })).toBe(8);
  });
});

describe("Phase 11.1 — nhật ký", () => {
  it("lọc theo người / entity / kỳ / mã, phân trang server; trường đổi được đánh dấu; cô lập team", async () => {
    const s = await setup("aud");
    const other = await setup("aud-o");
    await s.as(() => saveCap(s.mgr, { channel: "SMS", maxCount: 2, windowDays: 7 }));
    await s.as(() => saveCap(s.mgr, { channel: "SMS", maxCount: 3, windowDays: 7 }));
    await other.as(() => saveCap(other.mgr, { channel: "SMS", maxCount: 9, windowDays: 7 }));
    const all = await s.as(() => listAuditLog(s.mgr, auditFilter.parse({})));
    expect(all.total).toBe(2);
    expect(all.rows[0]).toMatchObject({ entity: "ContactCap", action: "update", actor: expect.stringContaining("aud-mgr") });
    expect(all.rows[0].changed).toEqual(["maxCount", "updatedAt"]);
    expect(all.actors.map((a) => a.id).sort()).toEqual([s.mgr.id, s.lead.id, s.fin.id].sort());
    expect((await s.as(() => listAuditLog(s.mgr, auditFilter.parse({ actor: s.lead.id })))).total).toBe(0);
    expect((await s.as(() => listAuditLog(s.mgr, auditFilter.parse({ entity: "ContactCap", action: "create" })))).total).toBe(1);
    expect((await s.as(() => listAuditLog(s.mgr, auditFilter.parse({ from: "2000-01-01", to: "2000-01-02" })))).total).toBe(0);
    await expect(s.as(() => listAuditLog(s.lead, auditFilter.parse({})))).rejects.toMatchObject({ status: 403 });
    expect(changedKeys(null, { a: 1 })).toEqual(["(toàn bộ)"]);
    expect(changedKeys({ a: 1, b: [1] }, { a: 1, b: [1] })).toEqual([]);
  });
});

describe("Phase 11.1 — dữ liệu khách theo yêu cầu", () => {
  it("xuất đủ dữ liệu; xóa ẩn danh hóa mọi bảng (cả hồ sơ đã gộp), giữ đơn và số tiền, chạy lại không đổi, audit không chứa PII; thiếu quyền 403", async () => {
    const s = await setup("prv");
    const k = await s.c.customer.create({ data: { displayName: "Fatima Al Zahra", primaryPhoneE164: "+971500001111", primaryEmail: "fatima@x.invalid", tags: ["vip"] } as never });
    const dup = await s.c.customer.create({ data: { displayName: "Fatima Z", primaryPhoneE164: "+971500002222", mergedIntoId: k.id } as never });
    const conn = await s.c.connection.create({ data: { storeId: s.store.id, platform: "pancake" } as never });
    await s.c.customerIdentity.create({ data: { customerId: k.id, platform: "pancake", connectionId: conn.id, sourceCustomerId: "pc-77", phoneE164: "+971500001111" } as never });
    await s.c.address.create({ data: { customerId: k.id, kind: "SHIPPING", raw: { line: "Villa 9, Dubai" }, countryCode: "AE" } as never });
    const o = await s.c.order.create({ data: { storeId: s.store.id, customerId: dup.id, orderNumber: "P1", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", currency: "AED", grossAmount: "100", discount: "0", shippingFee: "0", netAmount: "100", fxRate: "7000", fxDate: new Date("2026-10-01"), netBase: "700000", bookedAt: new Date("2026-10-01"), customerName: "Fatima Z", customerPhone: "+971500002222", customerEmail: "fz@x.invalid" } as never });
    await s.c.sourceEvent.create({ data: { connectionId: conn.id, eventKey: `e-${RUN}`, recordType: "order", sourceRecordId: "r1", sourceUpdatedAt: new Date(), payload: { customer: { name: "Fatima Z" } }, outcome: "APPLIED", orderId: o.id } as never });
    const lead = await s.c.lead.create({ data: { contactName: "Fatima", contactPhoneE164: "+971500001111", source: "inbox", customerId: k.id } as never });
    await s.c.activity.create({ data: { type: "MESSAGE", direction: "IN", body: "Tôi ở Villa 9", leadId: lead.id, occurredAt: new Date() } as never });
    const t = await s.c.ticket.create({ data: { code: `TK-P-${RUN}`, type: "KHAC", priority: "TRUNG", subject: "Fatima hỏi đơn", customerId: k.id, firstResponseDueAt: new Date(), resolveDueAt: new Date() } as never });
    await s.c.ticketEvent.create({ data: { ticketId: t.id, type: "CUSTOMER", body: "SĐT mới 0501234567" } as never });
    await s.c.outbox.create({ data: { channel: "SMS", recipient: "+971500001111", body: "Chào Fatima", status: "SIMULATED", idempotencyKey: `ob-${RUN}` } as never });

    await expect(s.as(() => exportCustomerData(s.lead, k.id))).rejects.toMatchObject({ status: 403 });
    await expect(s.as(() => exportCustomerData(s.mgr, dup.id))).rejects.toMatchObject({ fields: { customerId: expect.stringContaining("gộp") } });
    const ex = await s.as(() => exportCustomerData(s.mgr, k.id));
    expect([ex.customers.length, ex.orders.length, ex.leads.length, ex.activities.length, ex.tickets.length, ex.addresses.length]).toEqual([2, 1, 1, 1, 1, 1]);

    await expect(s.as(() => eraseCustomerData(s.mgr, { customerId: k.id, reason: "Yêu cầu GDPR #12", confirm: "xoa nhầm" }))).rejects.toMatchObject({ fields: { confirm: "Gõ XOA để xác nhận" } });
    await expect(s.as(() => eraseCustomerData(s.fin, { customerId: k.id, reason: "Yêu cầu GDPR #12", confirm: "XOA" }))).rejects.toMatchObject({ status: 403 });
    const r = await s.as(() => eraseCustomerData(s.mgr, { customerId: k.id, reason: "Yêu cầu GDPR #12", confirm: "xoa" }));
    expect(r.counts).toMatchObject({ customers: 2, identities: 1, addresses: 1, orders: 1, sourceEvents: 1, leads: 1, activities: 1, tickets: 1, ticketEvents: 1, outbox: 1 });
    expect((await s.as(() => eraseCustomerData(s.mgr, { customerId: k.id, reason: "Yêu cầu GDPR #12", confirm: "XOA" }))).replayed).toBe(true);

    // Không còn chuỗi định danh nào ở các bảng liên quan; đơn và số tiền giữ nguyên.
    const dump = JSON.stringify(await Promise.all([
      s.c.customer.findMany({ where: { id: { in: [k.id, dup.id] } } }), s.c.customerIdentity.findMany(), s.c.address.findMany(), s.c.order.findMany(),
      s.c.sourceEvent.findMany(), s.c.lead.findMany(), s.c.activity.findMany(), s.c.ticket.findMany(), s.c.ticketEvent.findMany(), s.c.outbox.findMany(),
      s.c.auditLog.findMany({ where: { action: "privacy.erase" } }),
    ]));
    for (const pii of ["Fatima", "9715000", "x.invalid", "Villa 9", "pc-77", "0501234567"]) expect(dump).not.toContain(pii);
    expect(await s.c.customer.findUniqueOrThrow({ where: { id: k.id } })).toMatchObject({ displayName: ERASED_NAME, tags: [] });
    expect((await s.c.order.findUniqueOrThrow({ where: { id: o.id } })).netBase.toString()).toBe("700000");
    expect((await rootDb.auditLog.findFirstOrThrow({ where: { workspaceId: s.ws.id, action: "privacy.erase" } })).reason).toBe("Yêu cầu GDPR #12");
  });
});

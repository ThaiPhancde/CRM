import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { runSync } from "@/modules/connectors/service";
import { getCustomer360, listCustomerReviews, listCustomers, mergeFromReview, unmergeCustomers } from "@/modules/customers/service";
import { listOrders } from "@/modules/orders/service";

const dir = mkdtempSync(path.join(tmpdir(), "crm-c360-"));
process.env.REPLAY_DIR = dir;
const T0 = new Date("2026-06-01T08:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();

/** Đơn Shopify tối giản; `delivered` = đã giao đủ. */
function sh(o: { id: string; cust: string; phone?: string | null; email?: string | null; name?: string; updated?: number; delivered?: boolean }) {
  return {
    id: `gid://shopify/Order/${o.id}`, name: `#${o.id}`, createdAt: at(0), updatedAt: at(o.updated ?? 2), processedAt: at(1), cancelledAt: null,
    displayFinancialStatus: "PAID", displayFulfillmentStatus: o.delivered ? "FULFILLED" : "UNFULFILLED", currencyCode: "EUR",
    customer: { id: o.cust, firstName: o.name ?? "Anna", lastName: "Keller", email: o.email ?? null, phone: o.phone ?? null },
    shippingAddress: { countryCodeV2: "DE" },
    lineItems: [{ sku: "X-1", title: "Vase", quantity: 2, originalUnitPrice: "45.00", fulfilledQuantity: o.delivered ? 2 : 0 }],
    totalDiscounts: "0", totalShipping: "5.00", tags: [], note: null,
    transactions: [{ kind: "SALE", status: "SUCCESS", gateway: "card", amount: "95.00", processedAt: at(1) }], refunds: [],
    fulfillments: o.delivered ? [{ trackingCompany: "DHL", trackingNumber: "T", events: [{ status: "DELIVERED", happenedAt: at(o.updated ?? 2) }] }] : [],
  };
}
function pk(o: { id: string; cust: string; phone: string; updated?: number }) {
  return {
    id: o.id, order_code: o.id, status: 1, inserted_at: at(30), updated_at: at(o.updated ?? 40), confirmed_at: at(31), currency: "EUR", is_cod: false,
    customer: { id: o.cust, name: "A. Keller", phone_number: o.phone, email: null }, shipping_address: { country_code: "DE" },
    items: [{ sku: "X-2", name: "Lamp", quantity: 1, price: "20.00" }], total_discount: "0", shipping_fee: "0", payments: [], refunds: [], partner: null, note: null,
  };
}
const fixture = (code: string, records: unknown[]) => writeFileSync(path.join(dir, `${code}.json`), JSON.stringify(records.map((record, i) => ({ visibleAt: at(50 + i), record }))));

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  for (const [currency, rate] of [["USD", "1"], ["EUR", "1.08"]]) await c.fxRate.create({ data: { currency, rateToUsd: rate, validFrom: new Date("2025-01-01") } as never });
  const brand = await c.brand.create({ data: { code: "B", name: "B" } as never });
  await c.market.create({ data: { code: "DE", name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" } as never });
  const mk = async (code: string, platform: string) => {
    const store = await c.store.create({ data: { brandId: brand.id, code: `${code}-${RUN}`, name: code, platform } as never });
    return { store, conn: await c.connection.create({ data: { storeId: store.id, platform } as never }) };
  };
  const shS = await mk(`SH-${tag}`, "shopify");
  const pkS = await mk(`PK-${tag}`, "pancake");
  const user = async (t: string, roles: NonNullable<Parameters<typeof makeUser>[1]>["roles"]) => (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles })).id))!;
  return { ws, c, shS, pkS, mgr: await user("mgr", ["MANAGER"]), mkt: await user("mkt", ["MARKETING"]), sync: (s: { conn: { id: string } }) => runSync(ws.id, s.conn.id, "INCREMENTAL", new Date(T0.getTime() + 600 * 60000)) };
}

describe("chuẩn hóa SĐT (lõi — bảng đầy đủ ở tests/phone.test.ts)", () => {
  it("cùng một số ở nhiều cách viết ra cùng E.164; số mơ hồ trả null", () => {
    for (const s of ["+49 151 2345 6789", "0049 151 23456789", "(0151) 2345-6789"]) expect(normalizePhone(s, "DE")?.e164).toBe("+4915123456789");
    expect(normalizePhone("0912 345 678", "VN")?.e164).toBe("+84912345678");
    expect(normalizePhone("971501234567", "AE")?.e164).toBe("+971501234567");
    expect(normalizePhone("0151 2345", null)).toBeNull();
    expect(normalizePhone("12", "DE")).toBeNull();
  });
});

describe("Phase 3 — hợp nhất khách (D-08)", () => {
  it("cùng SĐT viết khác nhau ở hai nền tảng → một hồ sơ, hai danh tính", async () => {
    const s = await setup("phone");
    fixture(s.shS.store.code, [sh({ id: "1", cust: "gid://shopify/Customer/9", phone: "+49 151 2345 6789" })]);
    fixture(s.pkS.store.code, [pk({ id: "P1", cust: "pc-1", phone: "0151 23456789" })]);
    await s.sync(s.shS);
    await s.sync(s.pkS);
    const customers = await s.c.customer.findMany({ include: { identities: true, orders: true } });
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ primaryPhoneE164: "+4915123456789", orderCount: 2 });
    expect(customers[0].identities.map((i) => i.platform).sort()).toEqual(["pancake", "shopify"]);
  });

  it("cùng mã khách nguồn (đổi SĐT) → vẫn một hồ sơ; tên giống nhau KHÔNG đủ để gộp", async () => {
    const s = await setup("srcid");
    fixture(s.shS.store.code, [
      sh({ id: "1", cust: "gid://shopify/Customer/5", phone: "+49 151 0000 0001" }),
      sh({ id: "2", cust: "gid://shopify/Customer/5", phone: "+49 151 0000 0002" }),
      sh({ id: "3", cust: "gid://shopify/Customer/6", phone: "+49 151 0000 0003" }), // cùng tên "Anna Keller", khác người
    ]);
    await s.sync(s.shS);
    const cs = await s.c.customer.findMany({ orderBy: { createdAt: "asc" } });
    expect(cs.map((c) => c.orderCount)).toEqual([2, 1]);
  });

  it("chỉ trùng email (chưa xác minh) → hai hồ sơ + hàng đợi; gộp rồi tách lại trả đơn về đúng chỗ", async () => {
    const s = await setup("email");
    fixture(s.shS.store.code, [
      sh({ id: "1", cust: "gid://shopify/Customer/1", phone: "+49 151 1111 1111", email: "Anna@Example.invalid" }),
      sh({ id: "2", cust: "gid://shopify/Customer/2", phone: "+49 151 2222 2222", email: "anna@example.invalid" }),
    ]);
    await s.sync(s.shS);
    expect(await s.c.customer.count()).toBe(2);
    const reviews = await listCustomerReviews(s.mgr);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].reasons).toMatchObject({ sameEmailUnverified: "anna@example.invalid" });

    const before = await s.c.order.findMany({ select: { id: true, customerId: true } });
    const merged = await mergeFromReview(s.mgr, reviews[0].id);
    expect(await s.c.order.count({ where: { customerId: merged.survivorId } })).toBe(2);
    const survivor = await getCustomer360(s.mgr, merged.survivorId);
    expect("redirectTo" in survivor ? null : survivor.summary.orderCount).toBe(2);
    const gone = before.find((o) => o.customerId !== merged.survivorId)!.customerId!;
    expect(await getCustomer360(s.mgr, gone)).toEqual({ redirectTo: merged.survivorId });

    await unmergeCustomers(s.mgr, merged.mergeLogId);
    const after = await s.c.order.findMany({ select: { id: true, customerId: true } });
    expect(new Map(after.map((o) => [o.id, o.customerId]))).toEqual(new Map(before.map((o) => [o.id, o.customerId])));
    expect(await s.c.customer.count({ where: { mergedIntoId: null } })).toBe(2);
    expect((await s.c.customerIdentity.groupBy({ by: ["customerId"], _count: true })).length).toBe(2);
  });

  it("REV-03 12 tháng = giá trị dòng đã giao (không tính phí ship) quy USD theo tỷ giá chốt", async () => {
    const s = await setup("value");
    fixture(s.shS.store.code, [sh({ id: "1", cust: "gid://shopify/Customer/1", phone: "+49 151 3333 3333", delivered: true, updated: 120 })]);
    await s.sync(s.shS);
    const c = await s.c.customer.findFirstOrThrow();
    expect(c.valueUsd12m.toString()).toBe("97.2"); // 2 × 45 EUR × 1.08
    expect(c.deliveredOrders).toBe(1);
  });

  it("người thiếu quyền PII/tiền: SĐT, email bị che, giá trị null, không tìm được theo SĐT — cả ở danh sách đơn", async () => {
    const s = await setup("mask");
    fixture(s.shS.store.code, [sh({ id: "1", cust: "gid://shopify/Customer/1", phone: "+49 151 4444 5555", email: "secret@example.invalid", delivered: true })]);
    await s.sync(s.shS);
    const full = await listCustomers(s.mgr, { page: 1, sort: "recent" });
    expect(full.rows[0]).toMatchObject({ phone: "+4915144445555", email: "secret@example.invalid" });
    const masked = await listCustomers(s.mkt, { page: 1, sort: "value" });
    expect(masked.rows[0].phone).toBe("+49 1•••••••555");
    expect(masked.rows[0].email).toBe("se•••@example.invalid");
    expect(masked.rows[0].valueUsd12m).toBeNull();
    expect((await listCustomers(s.mkt, { page: 1, sort: "recent", q: "44445555" })).total).toBe(0);
    expect((await listCustomers(s.mgr, { page: 1, sort: "recent", q: "44445555" })).total).toBe(1);
    const orders = await listOrders(s.mkt, { page: 1 });
    expect(orders.rows[0].customerPhone).toBe("+49 1•••••••555");
    expect((await listOrders(s.mkt, { page: 1, q: "44445555" })).total).toBe(0);
    const p = await getCustomer360(s.mkt, full.rows[0].id);
    if ("redirectTo" in p) throw new Error("không mong đợi");
    expect(p.identities.every((i) => !i.phone || i.phone.includes("•"))).toBe(true);
    expect(p.orders[0].net).toBeNull();
  });

  it("cùng SĐT ở hai team là hai hồ sơ riêng; team này không mở được hồ sơ team kia", async () => {
    const a = await setup("iso-a");
    const b = await setup("iso-b");
    fixture(a.shS.store.code, [sh({ id: "1", cust: "gid://shopify/Customer/1", phone: "+49 151 7777 7777" })]);
    fixture(b.shS.store.code, [sh({ id: "1", cust: "gid://shopify/Customer/1", phone: "+49 151 7777 7777" })]);
    await a.sync(a.shS);
    await b.sync(b.shS);
    const ca = await a.c.customer.findFirstOrThrow();
    const cb = await b.c.customer.findFirstOrThrow();
    expect(ca.id).not.toBe(cb.id);
    await expect(getCustomer360(a.mgr, cb.id)).rejects.toMatchObject({ status: 404 });
  });
});

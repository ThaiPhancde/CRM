import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { runInWorkspace, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { applySettlement, codSummary, orderCodSteps, outstandingCod, previewSettlement } from "@/modules/fulfillment/cod";
import { actOnDelivery, interventionFilter, listInterventions } from "@/modules/fulfillment/service";
import { parseReportFilter } from "@/modules/reports/period";
import { financeReport, reportContext } from "@/modules/reports/service";
import { refreshAndScoreCustomers } from "@/modules/scoring/engine";
import { getCustomerScores } from "@/modules/scoring/service";
import { listProducts, mapSourceSku, productFilter, syncCosts } from "@/modules/products/service";

const D = (s: string) => new Date(s.length === 10 ? `${s}T10:00:00Z` : s);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const team = await c.team.create({ data: { code: "A", name: "Nhóm A" } as never });
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  const ae = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  await c.market.create({ data: { code: "KW", name: "Kuwait", currency: "KWD", paymentMode: "COD", timezone: "Asia/Kuwait", locale: "ar-KW" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "Lumi UAE", platform: "pancake" } as never });
  const store2 = await c.store.create({ data: { brandId: brand.id, code: `S2-${RUN}`, name: "Lumi KSA", platform: "pancake" } as never });
  await c.fxRate.create({ data: { currency: "AED", rateToBase: "7000", validFrom: new Date("2026-01-01") } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES" | "MARKETING" | "FULFILLMENT" | "FINANCE_VIEW")[]) => (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles, teamId: team.id })).id, ws.id))!;
  const [mgr, ful, fin, sales] = [await u("mgr", ["MANAGER"]), await u("ful", ["FULFILLMENT"]), await u("fin", ["FINANCE_VIEW"]), await u("sales", ["SALES"])];
  const cust = await c.customer.create({ data: { displayName: "Khách A", primaryPhoneE164: "+971500000009" } as never });
  /** Đơn COD AED một dòng; vận đơn với các mốc tùy chọn. */
  const cod = async (o: { no: string; net: string; booked: string; tn: string; carrier?: string; delivered?: string; collected?: string; failed?: { at: string; reason: string }; store?: string; customerId?: string | null }) => {
    const ord = await c.order.create({ data: {
      storeId: o.store ?? store.id, marketId: ae.id, orderNumber: o.no, status: "CONFIRMED", paymentStatus: o.collected ? "COD_COLLECTED" : "COD_PENDING",
      fulfillmentStatus: o.delivered ? "DELIVERED" : o.failed ? "FAILED" : "IN_TRANSIT", currency: "AED", grossAmount: o.net, discount: "0", shippingFee: "0", netAmount: o.net,
      fxRate: "7000", fxDate: D(o.booked), netBase: String(Number(o.net) * 7000), bookedAt: D(o.booked), confirmedAt: D(o.booked), deliveredAt: o.delivered ? D(o.delivered) : null,
      customerId: o.customerId === undefined ? cust.id : o.customerId,
      items: { create: [{ workspaceId: ws.id, sourceSku: "X", name: "X", qty: 1, qtyDelivered: o.delivered ? 1 : 0, unitPrice: o.net, lineAmount: o.net }] },
    } as never });
    const s = await c.shipment.create({ data: { orderId: ord.id, carrier: o.carrier ?? "Aramex", trackingNo: o.tn, codAmount: o.net, status: o.delivered ? "DELIVERED" : o.failed ? "FAILED" : "IN_TRANSIT",
      deliveredAt: o.delivered ? D(o.delivered) : null, collectedAt: o.collected ? D(o.collected) : null, failureReason: o.failed?.reason ?? null, failedAt: o.failed ? D(o.failed.at) : null } as never });
    if (o.failed) await c.deliveryEvent.create({ data: { shipmentId: s.id, type: "FAILED", reasonCode: o.failed.reason, occurredAt: D(o.failed.at) } as never });
    return { ord, s };
  };
  const as = <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn);
  return { ws, c, ae, store, store2, mgr, ful, fin, sales, cust, cod, as };
}

describe("Phase 10 — COD 4 mốc + đối soát", () => {
  it("một đơn COD đi qua 4 mốc hiện đúng ở đơn, báo cáo CASH và REV-04; dán lại không cộng trùng", async () => {
    const s = await setup("cod1");
    const { ord } = await s.cod({ no: "LAE1", net: "163", booked: "2026-10-01", tn: "ARA1", delivered: "2026-10-04", collected: "2026-10-04" });
    await s.cod({ no: "LAE2", net: "100", booked: "2026-10-02", tn: "ARA2", delivered: "2026-10-05", collected: "2026-10-05" }); // còn kẹt
    // Trước đối soát: 3/4 mốc.
    let steps = (await s.as(() => orderCodSteps(s.mgr, [ord.id]))).get(ord.id)!;
    expect(steps.map((x) => [x.key, x.state])).toEqual([["booked", "done"], ["delivered", "done"], ["collected", "done"], ["remitted", "pending"]]);

    const input = { carrier: "Aramex", reference: "ARX-2026-10-W2", text: "ma_van_don\tso_tien\tngay_ve\nARA1\t160,00\t12/10/2026" };
    const pre = await s.as(() => previewSettlement(s.mgr, input));
    expect(pre).toMatchObject([{ rowNo: 2, orderNumber: "LAE1", status: "ready", amount: "160.00", codAmount: "163" }]);
    expect(pre[0].message).toMatch(/thiếu 3/);
    expect(await s.c.settlementLine.count()).toBe(0); // xem trước không ghi
    const r = await s.as(() => applySettlement(s.mgr, input));
    expect([r.inserted, r.lines[0].status]).toEqual([1, "done"]);
    const again = await s.as(() => applySettlement(s.mgr, input));
    expect([again.inserted, again.lines[0].status]).toEqual([0, "unchanged"]);
    expect(await s.c.settlementLine.count()).toBe(1);

    steps = (await s.as(() => orderCodSteps(s.mgr, [ord.id]))).get(ord.id)!;
    expect(steps.find((x) => x.key === "remitted")).toMatchObject({ state: "done", at: "2026-10-12T00:00:00.000Z", amount: "160", note: "Bảng ARX-2026-10-W2" });
    expect((await s.as(() => orderCodSteps(s.ful, [ord.id]))).get(ord.id)!.every((x) => x.amount === null)).toBe(true); // Vận đơn không thấy tiền

    // Báo cáo: CASH-01 = 263 AED đã thu, CASH-02 = 160 đã về, CASH-03 = 100 còn kẹt (LAE2); REV-04 = 160 × 7000 theo ngày về.
    const f = parseReportFilter({ from: "2026-10-01", to: "2026-10-31" }, "2026-11-02");
    const sum = await s.as(() => codSummary(s.mgr, f, null));
    expect(sum.byCarrier).toMatchObject([{ key: "Aramex", cash01: 263 * 7000, n01: 2, cash02: 160 * 7000, n02: 1, cash03: 100 * 7000, n03: 1, age15: 0, age30: 100 * 7000 }]);
    const fin = await s.as(async () => financeReport(s.mgr, f, await reportContext(s.mgr, "tai-chinh", f)));
    expect(fin.total.rev04).toBe(160 * 7000);
    const sep = parseReportFilter({ from: "2026-10-01", to: "2026-10-11" }, "2026-11-02");
    expect((await s.as(async () => financeReport(s.mgr, sep, await reportContext(s.mgr, "tai-chinh", sep)))).total.rev04).toBe(0); // chưa về trong kỳ
    const out = await s.as(() => outstandingCod(s.fin, { page: 1 }, D("2026-11-02")));
    expect(out.rows.map((x) => [x.orderNumber, x.codAmount, x.days])).toEqual([["LAE2", "100", 28]]);

    // Chỉ số khách (R12M): REV-04 gồm COD đã về.
    await refreshAndScoreCustomers(s.c, s.ws.id, D("2026-11-01"));
    expect((await s.c.customerMetric.findFirstOrThrow({ where: { customerId: s.cust.id } })).rev04.toString()).toBe(String(160 * 7000));
  });

  it("chặn dòng sai: chưa thu, không phải COD, mã mơ hồ, khác hãng, đối soát bảng khác, trùng dòng; dòng lỗi không chặn dòng đúng; Kế toán không nhập được", async () => {
    const s = await setup("cod2");
    await s.cod({ no: "N1", net: "50", booked: "2026-10-01", tn: "ARA9", delivered: "2026-10-03" });                         // chưa thu
    await s.cod({ no: "A1", net: "60", booked: "2026-10-01", tn: "ARA5", delivered: "2026-10-03", collected: "2026-10-03" });
    await s.cod({ no: "A2", net: "70", booked: "2026-10-01", tn: "ARA5", delivered: "2026-10-03", collected: "2026-10-03", store: s.store2.id }); // trùng mã vận đơn (khác shop)
    await s.cod({ no: "S1", net: "80", booked: "2026-10-01", tn: "SMS1", carrier: "SMSA", delivered: "2026-10-03", collected: "2026-10-03" });
    await s.cod({ no: "OK1", net: "90", booked: "2026-10-01", tn: "ARA7", delivered: "2026-10-03", collected: "2026-10-06" });
    const prepaid = await s.c.order.create({ data: { storeId: s.store.id, orderNumber: "P1", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", currency: "AED", grossAmount: "10", discount: "0", shippingFee: "0", netAmount: "10", fxRate: "7000", fxDate: D("2026-10-01"), netBase: "70000", bookedAt: D("2026-10-01") } as never });
    await s.c.shipment.create({ data: { orderId: prepaid.id, carrier: "Aramex", trackingNo: "ARA8", status: "DELIVERED" } as never });
    const text = ["ma_van_don,ma_don,so_tien,ngay_ve", "ARA9,,50,10/10/2026", "ARA8,,10,10/10/2026", "ARA5,,60,10/10/2026", "ARA5,A2,70,10/10/2026", "SMS1,,80,10/10/2026",
      "ARA7,,90,05/10/2026", "ARA7,,90,2026-10-10", "ARA7,,90,2026-10-10", "XYZ,,1,10/10/2026", "ARA5,A1,abc,10/10/2026", "ARA5,A1,60,31/02/2026"].join("\n");
    const lines = await s.as(() => previewSettlement(s.mgr, { carrier: "Aramex", reference: "R1", text }));
    const exp: [number, string, string][] = [
      [2, "error", "Chưa có mốc đã thu COD"], [3, "error", "Vận đơn không thu hộ"], [4, "error", "Mã vận đơn ARA5 thuộc nhiều đơn (A1, A2)"],
      [5, "ready", "Về đủ 70 AED"], [6, "error", "Vận đơn thuộc SMSA, không phải Aramex"], [7, "error", "Ngày về 05/10/2026 trước ngày thu 06/10/2026"],
      [8, "ready", "Về đủ 90 AED"], [9, "error", "Trùng dòng 8"], [10, "error", "Không tìm thấy vận đơn XYZ"], [11, "error", 'Số tiền "abc" không hợp lệ'],
      [12, "error", 'Ngày "31/02/2026" không đúng dạng'],
    ];
    expect(lines.map((l, i) => [l.rowNo, l.status, l.message.startsWith(exp[i]?.[2] ?? " ") ? exp[i][2] : l.message])).toEqual(exp);
    await expect(s.as(() => applySettlement(s.fin, { carrier: "Aramex", reference: "R1", text }))).rejects.toMatchObject({ status: 403 });
    const r = await s.as(() => applySettlement(s.mgr, { carrier: "Aramex", reference: "R1", text }));
    expect(r.inserted).toBe(2);
    // Cùng vận đơn, bảng khác → lỗi, không cộng trùng.
    const other = await s.as(() => previewSettlement(s.mgr, { carrier: "Aramex", reference: "R2", text: "ma_van_don\tso_tien\tngay_ve\nARA7\t90\t11/10/2026" }));
    expect(other[0]).toMatchObject({ status: "error", message: "Đã đối soát trong bảng R1 ngày 10/10/2026" });
    await expect(s.as(() => previewSettlement(s.mgr, { carrier: "Aramex", reference: "R1", text: "foo\tbar\n1\t2" }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("Phase 10 — đơn cần can thiệp", () => {
  it("giao thất bại hiện ở danh sách; xử lý (Outbox SIMULATED) thì rời danh sách; thất bại lại thì hiện lại; bấm lại không nhân đôi; hai người cùng xử lý → 409", async () => {
    const s = await setup("itv1");
    const a = await s.cod({ no: "F1", net: "100", booked: "2026-10-01", tn: "ARA1", failed: { at: "2026-10-03", reason: "unreachable" } });
    await s.cod({ no: "F2", net: "100", booked: "2026-10-01", tn: "ARA2", failed: { at: "2026-10-04", reason: "carrier_delay" } });
    let l = await s.as(() => listInterventions(s.ful, interventionFilter.parse({ page: 1 })));
    expect([l.total, l.rows.map((r) => [r.orderNumber, r.reason, r.fault, r.amount])]).toEqual([2, [["F1", "unreachable", "customer", null], ["F2", "carrier_delay", "carrier", null]]]);
    expect((await s.as(() => listInterventions(s.ful, interventionFilter.parse({ fault: "carrier", page: 1 })))).rows.map((r) => r.orderNumber)).toEqual(["F2"]);
    expect(l.byReason.map((r) => `${r.reason}:${r.n}`).sort()).toEqual(["carrier_delay:1", "unreachable:1"]);

    await expect(s.as(() => actOnDelivery(s.sales, { orderId: a.ord.id, kind: "REATTEMPT", idempotencyKey: "k-sales-0001" }))).rejects.toMatchObject({ status: 403 });
    await expect(s.as(() => actOnDelivery(s.ful, { orderId: a.ord.id, kind: "CANCEL", idempotencyKey: "k-cancel-001" }))).rejects.toMatchObject({ fields: { note: "Ghi lý do hủy" } });
    const r1 = await s.as(() => actOnDelivery(s.ful, { orderId: a.ord.id, kind: "REATTEMPT", note: "Khách hẹn chiều", idempotencyKey: "k-reattempt-1" }));
    const r2 = await s.as(() => actOnDelivery(s.ful, { orderId: a.ord.id, kind: "REATTEMPT", idempotencyKey: "k-reattempt-1" }));
    expect([r1.replayed, r2.replayed, r2.id]).toEqual([false, true, r1.id]);
    await expect(s.as(() => actOnDelivery(s.mgr, { orderId: a.ord.id, kind: "TICKET", idempotencyKey: "k-other-0001" }))).rejects.toMatchObject({ status: 409 });
    const ob = await s.c.outbox.findMany({ where: { entity: "DeliveryAction" } });
    expect(ob.map((o) => [o.channel, o.recipient, o.status])).toEqual([["CARRIER", "Aramex", "SIMULATED"]]);
    l = await s.as(() => listInterventions(s.ful, interventionFilter.parse({ page: 1 })));
    expect(l.rows.map((r) => r.orderNumber)).toEqual(["F2"]);

    // Giao lại vẫn thất bại: nguồn gửi sự kiện mới → failedAt mới → hiện lại, ghi số lần đã xử lý.
    await s.c.shipment.update({ where: { id: a.s.id }, data: { failedAt: D("2026-10-06"), failureReason: "customer_refused" } });
    l = await s.as(() => listInterventions(s.ful, interventionFilter.parse({ page: 1 })));
    expect(l.rows.find((r) => r.orderNumber === "F1")).toMatchObject({ reason: "customer_refused", priorActions: 1 });
    const t = await s.as(() => actOnDelivery(s.ful, { orderId: a.ord.id, kind: "TICKET", priority: "CAO", idempotencyKey: "k-ticket-001" }));
    const ticket = await s.c.ticket.findUniqueOrThrow({ where: { id: t.ticketId! } });
    expect([ticket.orderId, ticket.customerId, ticket.priority, ticket.type, ticket.subject]).toEqual([a.ord.id, s.cust.id, "CAO", "KHAC", "Giao thất bại F1: Khách từ chối nhận"]);
    expect(await s.c.auditLog.count({ where: { entityId: a.ord.id, action: { startsWith: "delivery." } } })).toBe(2);
  });

  it("lý do thất bại không bị tính thành chất lượng khách: lỗi hãng không đổi điểm; chỉ lý do thuộc khách vào rủi ro giao dịch", async () => {
    const s = await setup("itv2");
    // Một khách duy nhất trong team (RFM ngũ phân vị ổn định): một đơn đã giao + một đơn đang giao.
    await s.cod({ no: "K-1", net: "100", booked: "2026-09-01", tn: "KT1", delivered: "2026-09-03", collected: "2026-09-03" });
    const { s: ship } = await s.cod({ no: "K-2", net: "100", booked: "2026-09-10", tn: "KT2" });
    const T = D("2026-10-20");
    const snap = async () => {
      await refreshAndScoreCustomers(s.c, s.ws.id, T);
      const m = await s.c.customerMetric.findFirstOrThrow({ where: { customerId: s.cust.id }, orderBy: { createdAt: "desc" } });
      const sc = Object.fromEntries((await s.as(() => getCustomerScores(s.mgr, s.cust.id))).scores.map((x) => [x.type, x.value]));
      return { failed: m.failedByCustomer, confirmed: m.confirmedOrders, ...sc } as Record<string, number | null>;
    };
    const before = await snap();
    const fail = async (reason: string) => {
      await s.c.deliveryEvent.deleteMany({ where: { shipmentId: ship.id } });
      await s.c.shipment.update({ where: { id: ship.id }, data: { status: "FAILED", failureReason: reason, failedAt: D("2026-09-12") } });
      await s.c.deliveryEvent.create({ data: { shipmentId: ship.id, type: "FAILED", reasonCode: reason, occurredAt: D("2026-09-12") } as never });
    };
    await fail("carrier_delay");
    expect(await snap()).toEqual(before); // lỗi hãng: không đổi chỉ số hay điểm nào
    await fail("customer_refused");
    const after = await snap();
    expect([after.failed, after.RFM, after.SUPPORT_NEED]).toEqual([1, before.RFM, before.SUPPORT_NEED]);
    expect(after.TXN_RISK as number).toBeGreaterThan(before.TXN_RISK as number);
  });
});

describe("Phase 10 — sản phẩm qua PurchasingLink", () => {
  it("tồn theo thị trường + cảnh báo tồn thấp theo ngưỡng; giá vốn ẩn khi thiếu quyền; lấy giá vốn và ánh xạ mã nguồn idempotent", async () => {
    const s = await setup("prd1");
    const brand = await s.c.brand.findFirstOrThrow();
    const p = await s.c.product.create({ data: { brandId: brand.id, code: "LUMI-LAMP01", name: "Đèn ngủ" } as never });
    const v = await s.c.variant.create({ data: { productId: p.id, sku: "LUMI-LAMP01-WH", attributes: { color: "warm white" }, costPrice: "5.00", costCurrency: "USD" } as never });
    // fixtures/purchasing.json: LUMI-LAMP01-WH tồn AE 44, KW 0; giá vốn 6.20 USD.
    let l = await s.as(() => listProducts(s.mgr, productFilter.parse({ page: 1 })));
    const row = l.rows[0].variants[0];
    expect([l.markets, row.stock, row.low, row.cost, row.purchasingCost, row.costDiffers]).toEqual([["AE", "KW"], { AE: 44, KW: 0 }, ["KW"], "5", "6.20", true]);
    expect(l.summary.lowByMarket).toEqual({ AE: 0, KW: 1 });
    expect((await s.as(() => listProducts(s.ful, productFilter.parse({ page: 1 })))).rows[0].variants[0]).toMatchObject({ cost: null, purchasingCost: null, costDiffers: false });
    await s.c.setting.create({ data: { key: "inventory.lowStock", value: { "*": 50 } } as never });
    expect((await s.as(() => listProducts(s.mgr, productFilter.parse({ low: "1", page: 1 })))).rows[0].variants[0].low).toEqual(["AE", "KW"]);

    await expect(s.as(() => syncCosts(s.ful))).rejects.toMatchObject({ status: 403 });
    expect(await s.as(() => syncCosts(s.mgr))).toEqual({ updated: 1 });
    expect(await s.as(() => syncCosts(s.mgr))).toEqual({ updated: 0 });
    expect((await s.c.variant.findUniqueOrThrow({ where: { id: v.id } })).costPrice?.toString()).toBe("6.2");

    const conn = await s.c.connection.create({ data: { storeId: s.store.id, platform: "pancake" } as never });
    const o = await s.c.order.findFirst();
    const ord = o ?? (await s.cod({ no: "M1", net: "10", booked: "2026-10-01", tn: "M1" })).ord;
    await s.c.sourceOrderLink.create({ data: { orderId: ord.id, connectionId: conn.id, platform: "pancake", sourceRecordId: "r1", orderNumberNorm: "m1", refs: [], sourceStatusRaw: "x", sourceUpdatedAt: new Date(), isPrimary: true } as never });
    await s.c.orderItem.create({ data: { orderId: ord.id, sourceSku: "OLD-LAMP-W", name: "Lamp", qty: 1, unitPrice: "1", lineAmount: "1" } as never });
    await expect(s.as(() => mapSourceSku(s.sales, { sourceSku: "OLD-LAMP-W", variantId: v.id }))).rejects.toMatchObject({ status: 403 });
    expect(await s.as(() => mapSourceSku(s.ful, { sourceSku: "OLD-LAMP-W", variantId: v.id }))).toEqual({ lines: 1, connections: 1 });
    expect(await s.as(() => mapSourceSku(s.ful, { sourceSku: "OLD-LAMP-W", variantId: v.id }))).toEqual({ lines: 0, connections: 0 });
    expect(await s.c.sourceProductMapping.count({ where: { sourceSku: "OLD-LAMP-W", variantId: v.id } })).toBe(1);
  });
});

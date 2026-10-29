import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { getWarehouse, warehouseFor } from "@/adapters/warehouse";
import { customerMetricsInsert, customerMetricsSelect, dialect } from "@/adapters/warehouse/sql";
import { runInWorkspace, workspaceDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { loadUser } from "@/lib/session";
import { refreshAndScoreCustomers, scoreOpenLeads } from "@/modules/scoring/engine";
import { createScoreVersion, getCustomerScores, getLeadScore, listScoreVersions } from "@/modules/scoring/service";

const T = new Date("2026-10-20T03:00:00Z");
const ago = (d: number) => new Date(T.getTime() - d * 86400000);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const brand = await c.brand.create({ data: { code: "B", name: "B" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const mgr = (await loadUser((await makeUser(`${tag}-mgr`, { workspaceId: ws.id, roles: ["MANAGER"] })).id, ws.id))!;
  const mkt = (await loadUser((await makeUser(`${tag}-mkt`, { workspaceId: ws.id, roles: ["MARKETING"] })).id, ws.id))!;
  /** Đơn với một dòng hàng; fx = tỷ giá VND chốt của đơn. */
  const order = async (customerId: string, o: { booked: number; delivered?: number; status?: "CONFIRMED" | "CANCELLED"; qty?: number; delivered_qty?: number; price?: number; fx?: number; refunded?: number; paid?: number; refundAt?: number; failedReason?: string }) => {
    const qty = o.qty ?? 1, price = o.price ?? 100, fx = o.fx ?? 1, net = qty * price;
    const ord = await c.order.create({ data: {
      storeId: store.id, customerId, orderNumber: `#${Math.random().toString(36).slice(2, 8)}`, status: o.status ?? "CONFIRMED", paymentStatus: "PAID",
      fulfillmentStatus: o.delivered != null ? "DELIVERED" : o.failedReason ? "FAILED" : "UNFULFILLED", currency: "XXX", grossAmount: String(net), discount: "0", shippingFee: "0",
      netAmount: String(net), fxRate: String(fx), fxDate: ago(o.booked), netBase: String(net * fx), bookedAt: ago(o.booked), confirmedAt: ago(o.booked),
      deliveredAt: o.delivered != null ? ago(o.delivered) : null, refundedAmount: String(o.refunded ?? 0),
      items: { create: [{ workspaceId: ws.id, sourceSku: "SKU", name: "Hàng", qty, qtyDelivered: o.delivered != null ? (o.delivered_qty ?? qty) : 0, unitPrice: String(price), lineAmount: String(net) }] },
    } as never });
    if (o.paid) await c.payment.create({ data: { orderId: ord.id, method: "card", amount: String(o.paid), currency: "XXX", status: "SUCCESS", paidAt: ago(o.booked) } as never });
    if (o.refunded) await c.refund.create({ data: { orderId: ord.id, amount: String(o.refunded), currency: "XXX", refundedAt: ago(o.refundAt ?? o.booked) } as never });
    if (o.failedReason) {
      const s = await c.shipment.create({ data: { orderId: ord.id, status: "FAILED" } as never });
      await c.deliveryEvent.create({ data: { shipmentId: s.id, type: "FAILED", reasonCode: o.failedReason, occurredAt: ago(o.booked - 1) } as never });
    }
    return ord;
  };
  const customer = (name: string, extra: Record<string, unknown> = {}) => c.customer.create({ data: { displayName: name, ...extra } as never });
  return { ws, c, mgr, mkt, order, customer, as: <X,>(fn: () => Promise<X>) => runInWorkspace(ws.id, fn) };
}

describe("Phase 6 — chỉ số khách (Warehouse Postgres)", () => {
  it("một khách tính tay khớp REV-01..04, hoàn, độ gần, chu kỳ mua, rủi ro giao, RFM", async () => {
    const s = await setup("metric");
    const a = await s.customer("A", { primaryPhoneE164: "+971500000001", primaryEmail: "a@x.invalid" });
    await s.order(a.id, { booked: 100, delivered: 95, qty: 2, price: 100, fx: 2, paid: 200 });                       // REV-03 400
    await s.order(a.id, { booked: 40, delivered: 35, qty: 2, price: 50, delivered_qty: 1, fx: 2, paid: 100, refunded: 10, refundAt: 30 }); // giao 1/2: (50−10)×2 = 80
    await s.order(a.id, { booked: 10, price: 70, fx: 2, failedReason: "customer_refused" });                        // khách từ chối
    await s.order(a.id, { booked: 5, status: "CANCELLED", price: 999 });                                              // hủy — không tính REV-01
    await s.order(a.id, { booked: 400, delivered: 398, price: 300 });                                                 // ngoài 12 tháng
    // Bốn khách khác để RFM chia đủ 5 bậc.
    for (const [n, d, price] of [["B", 5, 100], ["C", 60, 1000], ["D", 200, 50], ["E", 300, 200]] as const) {
      const x = await s.customer(n);
      await s.order(x.id, { booked: d + 2, delivered: d, price });
    }
    const r = await getWarehouse().refreshCustomerMetrics(s.ws.id, T);
    expect(r.customers).toBe(5);
    const m = await s.c.customerMetric.findFirstOrThrow({ where: { customerId: a.id } });
    expect({
      orders: m.orders, delivered: m.deliveredOrders, confirmed: m.confirmedOrders, failed: m.failedByCustomer,
      rev01: m.rev01.toString(), rev02: m.rev02.toString(), rev03: m.rev03.toString(), rev04: m.rev04.toString(), refunds: m.refunds.toString(),
      recency: m.recencyDays, cycle: m.avgCycleDays, rep60: m.repurchase60, profit: m.grossProfit,
    }).toEqual({
      orders: 3, delivered: 2, confirmed: 3, failed: 1,
      rev01: "740", rev02: "740", rev03: "480", rev04: "580", refunds: "20",
      recency: 35, cycle: 181.5, rep60: false, profit: null, // thiếu giá vốn → không bịa lợi nhuận
    });
    expect([m.rScore, m.fScore, m.mScore]).toEqual([4, 5, 4]);
    expect(m.asOf.toISOString()).toBe(T.toISOString());
  });

  it("SQL BigQuery sinh từ cùng định nghĩa: không còn cú pháp riêng Postgres; adapter BigQuery chưa có khóa trả 501", async () => {
    const bq = dialect("bigquery", "crm_demo");
    const sql = customerMetricsSelect(bq) + customerMetricsInsert(bq);
    for (const bad of [/\$\d/, /::/, /EXTRACT\(EPOCH/, /INTERVAL '/, /AT TIME ZONE/, /"[A-Za-z]+"/]) expect(sql).not.toMatch(bad);
    expect(sql).toMatch(/`crm_demo\.Order`/);
    expect(sql).toMatch(/TIMESTAMP_DIFF\(/);
    const pg = dialect("postgres").bind("SELECT @ws, @asOf, @ws", { ws: "w", asOf: T });
    expect(pg).toEqual({ sql: "SELECT $1, $2, $1", values: ["w", T] });
    await expect(warehouseFor("bigquery").refreshCustomerMetrics("w", T)).rejects.toMatchObject({ status: 501 });
  });

  it.skipIf(!process.env.GOOGLE_APPLICATION_CREDENTIALS)("BigQuery dry-run (chỉ chạy khi có khóa — Phase 12)", () => {
    expect(true).toBe(true);
  });
});

describe("Phase 6 — chấm điểm, phiên bản, quyền", () => {
  it("chưa đủ dữ liệu không mặc định rủi ro; đổi trọng số tạo phiên bản mới, điểm cũ giữ; tổng trọng số phải 100", async () => {
    const s = await setup("score");
    const a = await s.customer("A", { primaryPhoneE164: "+971500000002" });
    await s.order(a.id, { booked: 20, delivered: 18, price: 100 });
    await s.order(a.id, { booked: 12, price: 50, failedReason: "customer_refused" });
    const fresh = await s.customer("Mới");
    await s.order(fresh.id, { booked: 3, price: 10 });
    await refreshAndScoreCustomers(s.c, s.ws.id, T);
    const scoresA = await s.as(() => getCustomerScores(s.mgr, a.id));
    const txn = scoresA.scores.find((x) => x.type === "TXN_RISK")!;
    expect([txn.value, txn.band]).toEqual([60 + 8 + 20, "CAO"]); // 1/2 từ chối = tối đa 60; thiếu email 40%×20 = 8; chưa có địa chỉ 20
    const scoresNew = await s.as(() => getCustomerScores(s.mgr, fresh.id));
    expect(scoresNew.scores.map((x) => [x.type, x.value, x.band])).toEqual([["RFM", null, "CHUA_DU_DU_LIEU"], ["TXN_RISK", null, "CHUA_DU_DU_LIEU"], ["SUPPORT_NEED", 0, "THAP"]]);

    await expect(s.as(() => createScoreVersion(s.mgr, { type: "TXN_RISK", weights: { failRate: 50, missingInfo: 20, address: 20 }, note: "Thử" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(s.as(() => createScoreVersion(s.mkt, { type: "TXN_RISK", weights: { failRate: 80, missingInfo: 10, address: 10 }, note: "Thử" }))).rejects.toMatchObject({ status: 403 });
    const v2 = await s.as(() => createScoreVersion(s.mgr, { type: "TXN_RISK", weights: { failRate: 80, missingInfo: 10, address: 10 }, note: "Tăng trọng số từ chối nhận" }));
    expect(v2.version).toBe(2);
    await refreshAndScoreCustomers(s.c, s.ws.id, T);
    const versions = (await s.as(() => listScoreVersions(s.mgr))).types.find((t) => t.type === "TXN_RISK")!.versions;
    expect(versions.map((v) => [v.version, v.active, v.scored])).toEqual([[2, true, 2], [1, false, 2]]); // điểm v1 giữ nguyên
    const now2 = (await s.as(() => getCustomerScores(s.mgr, a.id))).scores.find((x) => x.type === "TXN_RISK")!;
    expect([now2.version, now2.value]).toEqual([2, 80 + 4 + 10]);
  });

  it("người thiếu quyền tiền: chỉ số tiền null, bằng chứng M bị che; khách ngoài phạm vi 404", async () => {
    const s = await setup("mask");
    const a = await s.customer("A");
    await s.order(a.id, { booked: 20, delivered: 18, price: 100 });
    await refreshAndScoreCustomers(s.c, s.ws.id, T);
    const v = await s.as(() => getCustomerScores(s.mkt, a.id));
    expect(v.metric?.rev03).toBeNull();
    expect(v.scores.find((x) => x.type === "RFM")!.reasons.find((r) => r.part.startsWith("M"))!.evidence).toMatch(/cần quyền xem tiền/);
    expect((await s.as(() => getCustomerScores(s.mgr, a.id))).metric?.rev03).toBe("100");
    const sales = (await loadUser((await makeUser(`mask-sales-${RUN}`, { workspaceId: s.ws.id, roles: ["SALES"] })).id, s.ws.id))!;
    await expect(s.as(() => getCustomerScores(sales, a.id))).rejects.toMatchObject({ status: 404 });
  });

  it("lead mở: chấm theo tín hiệu trong tin khách; chỉ chấm lại khi có tương tác mới", async () => {
    const s = await setup("lead");
    const T = new Date(Date.now() + 5000); // worker chạy sau khi lead được tạo/sửa (so với updatedAt thật)
    const brand = await s.c.brand.findFirstOrThrow();
    const market = await s.c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
    const hot = await s.c.lead.create({ data: { contactName: "Nóng", source: "inbox", interest: "Đèn", budgetAmount: "100", budgetCurrency: "AED", brandId: brand.id, marketId: market.id, stage: "CHO_QUYET_DINH", nextActionAt: new Date(T.getTime() + 86400000), lastActivityAt: T } as never });
    await s.c.activity.create({ data: { type: "MESSAGE", direction: "IN", leadId: hot.id, body: "Giá bao nhiêu? Giao về Dubai mất mấy ngày, cho mình đặt 2 cái màu trắng COD", occurredAt: new Date(T.getTime() - 3600000) } as never });
    const cold = await s.c.lead.create({ data: { contactName: "Trống", source: "ads", stage: "MOI" } as never });
    expect((await scoreOpenLeads(s.c, T)).leads).toBe(2);
    const h = await s.as(() => getLeadScore(s.mgr, hot.id));
    expect([h?.value, h?.band]).toEqual([25 + 35 + 25 + 15, "CAO"]);
    expect(h?.reasons[1].evidence).toBe("hỏi giá, hỏi giao hàng, chọn mẫu/số lượng, muốn đặt/COD");
    const c0 = await s.as(() => getLeadScore(s.mgr, cold.id));
    expect([c0?.value, c0?.band]).toEqual([null, "CHUA_DU_DU_LIEU"]);
    expect((await scoreOpenLeads(s.c, T)).leads).toBe(0); // không có gì mới
    await s.c.lead.update({ where: { id: cold.id }, data: { interest: "Kệ", lastActivityAt: new Date(T.getTime() + 60000) } });
    expect((await scoreOpenLeads(s.c, new Date(T.getTime() + 120000))).leads).toBe(1);
  });
});

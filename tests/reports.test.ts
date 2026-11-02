import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { runInWorkspace, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { listOrders, orderFilter } from "@/modules/orders/service";
import { parseReportFilter } from "@/modules/reports/period";
import { customerReport, financeReport, reportContext, salesReport, visibleGroups } from "@/modules/reports/service";

const D = (s: string) => new Date(`${s}T10:00:00Z`);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const team = await c.team.create({ data: { code: "A", name: "Nhóm A" } as never });
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  const ae = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const us = await c.market.create({ data: { code: "US", name: "Mỹ", currency: "USD", paymentMode: "PREPAID", timezone: "America/New_York", locale: "en-US" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  await c.fxRate.create({ data: { currency: "USD", rateToBase: "25000", validFrom: new Date("2026-01-01") } as never });
  await c.fxRate.create({ data: { currency: "AED", rateToBase: "7000", validFrom: new Date("2026-01-01") } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES_LEAD" | "SALES" | "MARKETING" | "FULFILLMENT")[]) => (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles, teamId: team.id })).id, ws.id))!;
  const mgr = await u("mgr", ["MANAGER"]);
  const s1 = await u("s1", ["SALES"]);
  const s2 = await u("s2", ["SALES"]);
  const mkt = await u("mkt", ["MARKETING"]);
  const ful = await u("ful", ["FULFILLMENT"]);
  const cust = await c.customer.create({ data: { displayName: "K" } as never });
  /** Đơn: net nguyên tệ, tỷ giá, dòng hàng (số lượng, đã giao, đơn giá), hoàn. */
  const order = async (o: { no: string; cur: "AED" | "USD"; fx: string; net: string; booked: string; delivered?: string; status?: string; items: [number, number, string][]; refunded?: string; market?: string }) => {
    const ord = await c.order.create({ data: {
      storeId: store.id, marketId: o.market ?? (o.cur === "AED" ? ae.id : us.id), orderNumber: o.no, status: o.status ?? "CONFIRMED", paymentStatus: "COD_PENDING", fulfillmentStatus: o.delivered ? "DELIVERED" : "UNFULFILLED",
      currency: o.cur, grossAmount: o.net, discount: "0", shippingFee: "0", netAmount: o.net, fxRate: o.fx, fxDate: D(o.booked), netBase: String(Number(o.net) * Number(o.fx)),
      bookedAt: D(o.booked), confirmedAt: D(o.booked), deliveredAt: o.delivered ? D(o.delivered) : null, refundedAmount: o.refunded ?? "0", customerId: cust.id,
    } as never });
    for (const [qty, del, price] of o.items) await c.orderItem.create({ data: { orderId: ord.id, sourceSku: "X", name: "X", qty, qtyDelivered: del, unitPrice: price, lineAmount: String(qty * Number(price)) } as never });
    return ord;
  };
  const as = <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn);
  return { ws, c, brand, ae, us, store, mgr, s1, s2, mkt, ful, order, as, team };
}

describe("Phase 9 — báo cáo", () => {
  it("REV-01 và REV-03 của báo cáo tài chính khớp /don-hang cùng bộ lọc; đổi tiền tệ báo cáo thấy tỷ giá", async () => {
    const s = await setup("rp1");
    await s.order({ no: "A1", cur: "AED", fx: "7000", net: "100", booked: "2026-10-05", delivered: "2026-10-08", items: [[2, 2, "50"]] });
    await s.order({ no: "A2", cur: "AED", fx: "7100", net: "300", booked: "2026-10-10", delivered: "2026-10-15", items: [[3, 2, "100"]], refunded: "20" }); // giao một phần + hoàn
    await s.order({ no: "U1", cur: "USD", fx: "25000", net: "40", booked: "2026-10-20", delivered: "2026-11-03", items: [[1, 1, "40"]] }); // đặt trong kỳ, giao ngoài kỳ
    await s.order({ no: "U2", cur: "USD", fx: "25000", net: "60", booked: "2026-09-28", delivered: "2026-10-02", items: [[1, 1, "60"]] }); // đặt ngoài kỳ, giao trong kỳ
    await s.order({ no: "X1", cur: "AED", fx: "7000", net: "500", booked: "2026-10-12", status: "CANCELLED", items: [[1, 0, "500"]] });
    const f = parseReportFilter({ from: "2026-10-01", to: "2026-10-31", group: "market" }, "2026-11-05");
    const { fin, booked, delivered } = await s.as(async () => {
      const ctx = await reportContext(s.mgr, "tai-chinh", f);
      return {
        fin: await financeReport(s.mgr, f, ctx),
        booked: await listOrders(s.mgr, orderFilter.parse({ from: f.from, to: f.to, page: 1 })),
        delivered: await listOrders(s.mgr, orderFilter.parse({ from: f.from, to: f.to, anchor: "delivered", page: 1 })),
      };
    });
    // Tính tay: REV-01 = 100×7000 + 300×7100 + 40×25000 = 3.830.000; REV-03 = 100×7000 + (200−20)×7100 + 60×25000 = 3.478.000.
    expect([fin.total.rev01, fin.total.orders, Number(booked.rev01Base)]).toEqual([3_830_000, 3, 3_830_000]);
    expect([fin.total.rev03, Number(delivered.rev03.value)]).toEqual([3_478_000, 3_478_000]);
    expect(fin.byCurrency.find((r) => r.key === "AED")).toMatchObject({ orig01: 400, orig03: 280, fx01: 7075 }); // tỷ giá bình quân đã dùng
    const usd = parseReportFilter({ from: "2026-10-01", to: "2026-10-31", currency: "usd" }, "2026-11-05");
    const r = await s.as(async () => { const ctx = await reportContext(s.mgr, "tai-chinh", usd); return { ctx, fin: await financeReport(s.mgr, usd, ctx) }; });
    expect(r.ctx.rate).toEqual({ currency: "USD", rateToBase: 25000, validFrom: "2026-01-01" });
    expect(r.fin.total.rev03).toBeCloseTo(139.12, 2); // 3.478.000 / 25.000
  });

  it("cohort mua lại: tháng đầu mua, tỷ lệ còn mua theo tháng k, mua lại 60 ngày (CUS-03), tháng chưa tới để trống", async () => {
    const s = await setup("rp3");
    const a = await s.c.customer.create({ data: { displayName: "A" } as never });
    const b = await s.c.customer.create({ data: { displayName: "B" } as never });
    const mk = async (cust: string, no: string, day: string) => {
      const o = await s.order({ no, cur: "AED", fx: "7000", net: "100", booked: day, delivered: day, items: [[1, 1, "100"]] });
      await s.c.order.update({ where: { id: o.id }, data: { customerId: cust } });
    };
    await mk(a.id, "CA1", "2026-10-05"); await mk(a.id, "CA2", "2026-11-20"); // A: tháng sau, trong 60 ngày
    await mk(b.id, "CB1", "2026-10-10"); await mk(b.id, "CB2", "2027-01-15"); // B: tháng thứ 3, sau 60 ngày
    await mk(b.id, "CB3", "2026-10-25");                                     // cùng tháng đầu: tháng 0 vẫn 1 khách; là đơn thứ 2 trong 60 ngày của B
    const f = parseReportFilter({ from: "2026-10-01", to: "2026-10-31" }, "2027-01-20");
    const r = await s.as(async () => customerReport(s.mgr, f, await reportContext(s.mgr, "khach-hang", f), "2027-01-20"));
    expect(r.cohort).toEqual([{ cohort: "2026-10", size: 2, retention: [100, 50, 0, 50, null, null, null], repeat60Pct: 100 }]);
  });

  it("thiếu finance.view không thấy nhóm tài chính, số tiền ẩn ở nhóm khác; Sales chỉ thấy kết quả của mình", async () => {
    const s = await setup("rp2");
    const f = parseReportFilter({}, "2026-11-05");
    expect(visibleGroups(s.mkt)).toEqual(["sales", "khach-hang", "marketing"]);
    expect(visibleGroups(s.ful)).toEqual(["van-don"]);
    expect(visibleGroups(s.mgr)).toEqual(["sales", "khach-hang", "marketing", "van-don", "tai-chinh", "ai"]);
    await expect(s.as(() => reportContext(s.mkt, "tai-chinh", f))).rejects.toMatchObject({ status: 403 });
    const ctx = await s.as(() => reportContext(s.mkt, "khach-hang", f));
    expect(ctx.showMoney).toBe(false);
    const cr = await s.as(() => customerReport(s.mkt, f, ctx));
    expect(cr.rfm.every((r) => r.rev03 === null)).toBe(true);

    const now = new Date("2026-11-05T05:00:00Z");
    for (const [owner, stage] of [[s.s1.id, "DA_MUA"], [s.s1.id, "MOI"], [s.s2.id, "DA_MUA"], [s.s2.id, "TU_CHOI"], [s.s2.id, "MOI"]] as const)
      await s.c.lead.create({ data: { contactName: "L", source: "web", stage, ownerId: owner, teamId: s.team.id, createdAt: new Date("2026-11-02T03:00:00Z") } as never });
    const mine = await s.as(() => salesReport(s.s1, f, now));
    const team = await s.as(() => salesReport(s.mgr, f, now));
    expect([mine.scope, mine.total.leads, mine.rows.map((r) => r.key)]).toEqual(["self", 2, [s.s1.id]]);
    expect([team.scope, team.total.leads, team.total.won, team.total.winRate]).toEqual(["team", 5, 2, 40]);
    expect(team.stages.find((x) => x.key === "DA_MUA")?.n).toBe(2);
  });
});

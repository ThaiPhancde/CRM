// Checklist nghiệm thu mục 12 (Phase 11) — hai mục chưa có test riêng ở các phase trước.
import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { getWarehouse } from "@/adapters/warehouse";
import { runInWorkspace, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { askReport } from "@/modules/ai/features";

const T = new Date("2026-10-20T03:00:00Z");
const day = (d: number) => new Date(T.getTime() + d * 86_400_000);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const brand = await c.brand.create({ data: { code: "B", name: "B" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const mgr = (await loadUser((await makeUser(`${tag}-mgr`, { workspaceId: ws.id, roles: ["MANAGER"] })).id, ws.id))!;
  const k = await c.customer.create({ data: { displayName: "K" } as never });
  const order = (booked: number, delivered: number | null, price: number) => c.order.create({ data: {
    storeId: store.id, customerId: k.id, orderNumber: `#${Math.random().toString(36).slice(2, 8)}`, status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: delivered == null ? "UNFULFILLED" : "DELIVERED",
    currency: "XXX", grossAmount: String(price), discount: "0", shippingFee: "0", netAmount: String(price), fxRate: "1", fxDate: day(booked), netBase: String(price),
    bookedAt: day(booked), confirmedAt: day(booked), deliveredAt: delivered == null ? null : day(delivered),
    items: { create: [{ workspaceId: ws.id, sourceSku: "X", name: "X", qty: 1, qtyDelivered: delivered == null ? 0 : 1, unitPrice: String(price), lineAmount: String(price) }] },
  } as never });
  return { ws, c, mgr, k, order };
}

describe("Checklist mục 12", () => {
  it("điểm / chỉ số không dùng dữ liệu tương lai: đơn đặt hoặc giao sau mốc tính không vào REV-01..03, RFM", async () => {
    const s = await setup("ck-future");
    await s.order(-30, -28, 100); // trong kỳ
    await s.order(-3, 2, 500);    // đặt trong kỳ, giao SAU mốc tính → REV-01 có, REV-03 không
    await s.order(5, 7, 900);     // đặt sau mốc tính → không có ở đâu
    const late = await s.order(-40, -38, 200); // giao trong kỳ, hoàn SAU mốc tính → không trừ khi tính tại mốc
    await s.c.refund.create({ data: { orderId: late.id, amount: "200", currency: "XXX", refundedAt: day(3) } as never });
    await s.c.order.update({ where: { id: late.id }, data: { refundedAmount: "200" } });
    await getWarehouse().refreshCustomerMetrics(s.ws.id, T);
    const m = await s.c.customerMetric.findFirstOrThrow({ where: { customerId: s.k.id } });
    expect([m.rev01.toString(), m.rev03.toString(), m.orders, m.deliveredOrders]).toEqual(["800", "300", 3, 2]);
    expect(m.asOf.toISOString()).toBe(T.toISOString());
  });

  it("báo cáo AI nêu kỳ, phạm vi, nguồn, độ mới; tách dữ kiện và giả thuyết; có bằng chứng dẫn tới định nghĩa chỉ số", async () => {
    const s = await setup("ck-ai");
    await s.order(-30, -28, 100);
    await getWarehouse().refreshCustomerMetrics(s.ws.id, T);
    const r = await runInWorkspace(s.ws.id, () => askReport(s.mgr, "Doanh thu giao thành công theo thị trường"));
    expect(r.status).toBe("OK");
    const o = r.output as { kind: string; period: string; scope: string; source: string; freshness: string | null; facts: string[]; hypothesis: string | null };
    expect(o.kind).toBe("report");
    expect(o.period).toMatch(/^12 tháng tới \d/);
    expect(o.scope).toContain("mọi thị trường");
    expect(o.source).toMatch(/CustomerMetric.*Từ điển chỉ số/);
    expect(o.freshness).toBe(T.toISOString());
    expect(Array.isArray(o.facts) && o.facts.length > 0).toBe(true);
    expect("hypothesis" in o).toBe(true);
    expect(((r as { evidence?: { href?: string }[] }).evidence ?? []).some((e) => e.href === "/quan-tri/chi-so")).toBe(true);
  });
});

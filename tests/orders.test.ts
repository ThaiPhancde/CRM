import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { registerPlatform } from "@/adapters/connectors/registry";
import { normalizedOrder, type Platform } from "@/adapters/connectors/types";
import { retryErrorEvents, runSync } from "@/modules/connectors/service";
import { linkReview, listReviews, unmerge } from "@/modules/orders/links";
import { listOrders } from "@/modules/orders/service";

const dir = mkdtempSync(path.join(tmpdir(), "crm-replay-"));
process.env.REPLAY_DIR = dir;

const T0 = new Date("2026-05-10T08:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();

function shopifyOrder(o: { id: string; name: string; updated: number; phone?: string; price?: string; delivered?: boolean; tags?: string[]; inTransit?: boolean }) {
  const events = o.delivered ? [{ status: "IN_TRANSIT", happenedAt: at(60) }, { status: "DELIVERED", happenedAt: at(o.updated) }] : o.inTransit ? [{ status: "IN_TRANSIT", happenedAt: at(60) }] : [];
  return {
    id: `gid://shopify/Order/${o.id}`, name: o.name, createdAt: at(0), updatedAt: at(o.updated), processedAt: at(1), cancelledAt: null,
    displayFinancialStatus: "PAID", displayFulfillmentStatus: o.delivered ? "FULFILLED" : "UNFULFILLED", currencyCode: "EUR",
    customer: { id: `c-${o.id}`, firstName: "Anna", lastName: "Keller", email: "anna@example.invalid", phone: o.phone ?? "+49 151 2345 6789" },
    shippingAddress: { countryCodeV2: "DE" },
    lineItems: [{ sku: "ORBI-VASE01-SG", title: "Vase", quantity: 2, originalUnitPrice: o.price ?? "45.00", fulfilledQuantity: o.delivered ? 2 : 0 }],
    totalDiscounts: "0", totalShipping: "5.00", tags: o.tags ?? [], note: null,
    transactions: [{ kind: "SALE", status: "SUCCESS", gateway: "card", amount: "95.00", processedAt: at(1) }], refunds: [],
    fulfillments: events.length ? [{ trackingCompany: "DHL", trackingNumber: `DHL${o.id}`, events }] : [],
  };
}

function pancakeOrder(o: { id: string; code: string; updated: number; note?: string; phone?: string; status?: number; items?: { sku: string; quantity: number; price: string; delivered_quantity?: number; returned_quantity?: number }[]; currency?: string; inserted?: number }) {
  return {
    id: o.id, order_code: o.code, status: o.status ?? 1, inserted_at: at(o.inserted ?? 5), updated_at: at(o.updated), confirmed_at: at(6), currency: o.currency ?? "EUR", is_cod: false,
    customer: { id: `pc-${o.id}`, name: "Anna Keller", phone_number: o.phone ?? "0151 23456789", email: null },
    shipping_address: { country_code: "DE" },
    items: (o.items ?? [{ sku: "ORBI-VASE01-SG", quantity: 2, price: "45.00" }]).map((i) => ({ name: `Hàng ${i.sku}`, ...i })),
    total_discount: "0", shipping_fee: "5.00", payments: [{ method: "bank", amount: "95.00", paid_at: at(6) }], refunds: [], partner: null, note: o.note ?? null,
  };
}

/** Ghi fixture phát lại cho một shop: [{visibleAt, record}] */
const fixture = (storeCode: string, events: { visible: number; record: unknown }[]) =>
  writeFileSync(path.join(dir, `${storeCode}.json`), JSON.stringify(events.map((e) => ({ visibleAt: at(e.visible), record: e.record }))));

async function setup(tag: string, opts: { rules?: boolean; sourceOfTruth?: Record<string, string>; fx?: boolean } = {}) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  if (opts.fx !== false) {
    for (const [currency, rate] of [["USD", "26300"], ["EUR", "28404"]]) await c.fxRate.create({ data: { currency, rateToBase: rate, validFrom: new Date("2026-01-01") } as never });
  }
  const brand = await c.brand.create({ data: { code: "ORBI", name: "Orbi" } as never });
  const market = await c.market.create({ data: { code: "DE", name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" } as never });
  const mk = async (code: string, platform: string) => {
    const store = await c.store.create({ data: { brandId: brand.id, code: `${code}-${RUN}`, name: code, platform, markets: { connect: [{ id: market.id }] } } as never });
    const conn = await c.connection.create({ data: { storeId: store.id, platform } as never });
    return { store, conn };
  };
  const sh = await mk(`SH-${tag}`, "shopify");
  const pk = await mk(`PK-${tag}`, "pancake");
  if (opts.rules !== false) await c.setting.create({ data: { key: "linkRules", value: [{ platformA: "shopify", fieldA: "orderNumber", platformB: "pancake", fieldB: "refs" }] } as never });
  if (opts.sourceOfTruth) await c.setting.create({ data: { key: "sourceOfTruth", value: opts.sourceOfTruth } as never });
  const mgr = (await loadUser((await makeUser(`${tag}-mgr`, { workspaceId: ws.id, roles: ["MANAGER"] })).id))!;
  const now = (min: number) => new Date(T0.getTime() + min * 60000);
  return { ws, c, sh, pk, mgr, now, sync: (x: { conn: { id: string } }, min: number, mode: "BACKFILL" | "INCREMENTAL" = "INCREMENTAL") => runSync(ws.id, x.conn.id, mode, now(min)) };
}

describe("Phase 2 — đơn chuẩn từ nhiều nguồn", () => {
  it("một giao dịch có ở hai nguồn (khớp linkRules) chỉ thành một đơn, REV-01 tính một lần", async () => {
    const s = await setup("dup");
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "1001", name: "#1001", updated: 2 }) }]);
    fixture(s.pk.store.code, [{ visible: 8, record: pancakeOrder({ id: "PK-9", code: "PK-9", updated: 8, note: "Đơn từ Shopify #1001" }) }]);
    const a = await s.sync(s.sh, 3);
    const b = await s.sync(s.pk, 10);
    expect(a.counts.APPLIED).toBe(1);
    expect(b.counts.LINKED).toBe(1);
    const orders = await s.c.order.findMany({ include: { links: true } });
    expect(orders).toHaveLength(1);
    expect(orders[0].links.map((l) => [l.platform, l.isPrimary]).sort()).toEqual([["pancake", false], ["shopify", true]]);
    const list = await listOrders(s.mgr, { page: 1 });
    expect(list.total).toBe(1);
    // 2 × 45 + 5 = 95 EUR × 1.08 = 102.6 USD
    expect(Number(list.rev01Base)).toBeCloseTo(102.6 * 26300, 2);
  });

  it("nhận lại cùng phiên bản (chồng lấn checkpoint) → DUPLICATE, không tạo đơn mới", async () => {
    const s = await setup("resend");
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "2001", name: "#2001", updated: 2 }) }]);
    await s.sync(s.sh, 3);
    const again = await s.sync(s.sh, 5); // checkpoint lùi 10 phút → thấy lại bản ghi
    expect(again.counts.DUPLICATE).toBe(1);
    expect(again.counts.APPLIED).toBe(0);
    expect(await s.c.order.count()).toBe(1);
  });

  it("bản cũ đến muộn không làm lùi trạng thái (STALE)", async () => {
    const s = await setup("late");
    fixture(s.sh.store.code, [
      { visible: 130, record: shopifyOrder({ id: "3001", name: "#3001", updated: 120, delivered: true }) },
      { visible: 200, record: shopifyOrder({ id: "3001", name: "#3001", updated: 90, inTransit: true }) },
    ]);
    const r = await s.sync(s.sh, 210, "BACKFILL");
    expect(r.counts).toMatchObject({ APPLIED: 1, STALE: 1 });
    const o = await s.c.order.findFirstOrThrow({ include: { links: true } });
    expect(o.fulfillmentStatus).toBe("DELIVERED");
    expect(o.links[0].sourceUpdatedAt.toISOString()).toBe(at(120));
  });

  it("giao/hoàn một phần giữ đúng số lượng theo dòng", async () => {
    const s = await setup("partial", { rules: false });
    fixture(s.pk.store.code, [{
      visible: 300,
      record: pancakeOrder({ id: "PK-P", code: "PK-P", updated: 300, status: 3, items: [
        { sku: "A", quantity: 1, price: "10.00", delivered_quantity: 1 },
        { sku: "B", quantity: 2, price: "20.00", delivered_quantity: 2, returned_quantity: 1 },
        { sku: "C", quantity: 1, price: "5.00", delivered_quantity: 0 },
      ] }),
    }]);
    const r = await s.sync(s.pk, 310);
    const errs = await s.c.sourceEvent.findMany({ where: { outcome: "ERROR" }, select: { error: true } });
    expect({ counts: r.counts, errs }).toMatchObject({ counts: { APPLIED: 1 }, errs: [] });
    const o = await s.c.order.findFirstOrThrow({ include: { items: true } });
    expect(o.fulfillmentStatus).toBe("PARTIAL");
    expect(o.returnStatus).toBe("PARTIAL");
    expect(o.items.find((i) => i.sourceSku === "B")).toMatchObject({ qty: 2, qtyDelivered: 2, qtyReturned: 1 });
    expect(o.grossAmount.toString()).toBe("55");
  });

  it("nghi trùng (cùng SĐT, cùng tiền, cách 5 phút, không có mã tham chiếu) → hàng đợi; gộp rồi tách lại được", async () => {
    const s = await setup("suspect", { rules: false });
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "4001", name: "#4001", updated: 2 }) }]);
    fixture(s.pk.store.code, [{ visible: 8, record: pancakeOrder({ id: "PK-S", code: "PK-S", updated: 8, inserted: 5 }) }]);
    await s.sync(s.sh, 3);
    const r = await s.sync(s.pk, 10);
    expect(r.reviews).toBe(1);
    expect(await s.c.order.count()).toBe(2); // không tự gộp

    const { reviews } = await listReviews(s.mgr);
    expect(reviews).toHaveLength(1);
    const merged = await linkReview(s.mgr, reviews[0].id);
    expect(await s.c.order.count()).toBe(1);
    expect(await s.c.sourceOrderLink.count({ where: { orderId: merged.survivorId } })).toBe(2);

    await unmerge(s.mgr, merged.mergeLogId);
    const after = await s.c.order.findMany({ include: { links: true, items: true } });
    expect(after).toHaveLength(2);
    expect(after.every((o) => o.links.length === 1 && o.links[0].isPrimary && o.items.length === 1)).toBe(true);
  });

  it("thiếu tỷ giá → ERROR có lý do; thêm tỷ giá rồi chạy lại → đơn được tạo", async () => {
    const s = await setup("fx", { fx: false });
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "5001", name: "#5001", updated: 2 }) }]);
    const r = await s.sync(s.sh, 3);
    expect(r.counts.ERROR).toBe(1);
    const ev = await s.c.sourceEvent.findFirstOrThrow({ where: { outcome: "ERROR" } });
    expect(ev.error).toMatch(/Thiếu tỷ giá EUR/);
    await s.c.fxRate.create({ data: { currency: "EUR", rateToBase: "28404", validFrom: new Date("2026-01-01") } as never });
    const retry = await retryErrorEvents(s.c, s.sh.conn.id);
    expect(retry.APPLIED).toBe(1);
    expect(await s.c.order.count()).toBe(1);
    expect(await s.c.sourceEvent.count({ where: { outcome: "ERROR" } })).toBe(0);
  });

  it("nguồn phụ không ghi đè nhóm trường của nguồn chính; đổi chủ nhóm giao hàng qua sourceOfTruth (D-32)", async () => {
    const body = (s: Awaited<ReturnType<typeof setup>>) => {
      fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "6001", name: "#6001", updated: 2 }) }]);
      fixture(s.pk.store.code, [{ visible: 400, record: pancakeOrder({ id: "PK-6", code: "PK-6", updated: 400, status: 3, note: "Shopify #6001", items: [{ sku: "ORBI-VASE01-SG", quantity: 2, price: "45.00", delivered_quantity: 2 }] }) }]);
    };
    const def = await setup("sot-def");
    body(def);
    await def.sync(def.sh, 3);
    await def.sync(def.pk, 410);
    expect((await def.c.order.findFirstOrThrow()).fulfillmentStatus).toBe("UNFULFILLED");

    const own = await setup("sot-own", { sourceOfTruth: { fulfillment: "pancake" } });
    body(own);
    await own.sync(own.sh, 3);
    await own.sync(own.pk, 410);
    const o = await own.c.order.findFirstOrThrow();
    expect(o.fulfillmentStatus).toBe("DELIVERED");
    expect(o.netAmount.toString()).toBe("95"); // nhóm order vẫn của Shopify
  });

  it("chủ nhóm được chỉ định chỉ áp khi đơn có liên kết từ nền tảng đó; đơn chỉ có ở Shopify vẫn nhận cập nhật giao hàng (D-32)", async () => {
    const s = await setup("sot-only", { sourceOfTruth: { fulfillment: "pancake" } });
    fixture(s.sh.store.code, [
      { visible: 2, record: shopifyOrder({ id: "6101", name: "#6101", updated: 2 }) },
      { visible: 130, record: shopifyOrder({ id: "6101", name: "#6101", updated: 120, delivered: true }) },
    ]);
    await s.sync(s.sh, 140);
    expect((await s.c.order.findFirstOrThrow()).fulfillmentStatus).toBe("DELIVERED");
  });

  it("thêm nền tảng thứ ba chỉ cần đăng ký adapter, không sửa nghiệp vụ (D-28)", async () => {
    const website: Platform = {
      code: `website${RUN}`, label: "Website", verification: "CXM", capabilities: { read: ["order"], write: [], incremental: "polling" },
      peek: (r) => ({ sourceRecordId: (r as { ref: string }).ref, sourceUpdatedAt: new Date((r as { ts: string }).ts) }),
      map: (r) => {
        const x = r as { ref: string; ts: string; total: string };
        return normalizedOrder.parse({ recordType: "order", sourceRecordId: x.ref, sourceUpdatedAt: x.ts, sourceStatusRaw: "new", orderNumber: x.ref, currency: "USD", bookedAt: x.ts, status: "BOOKED", paymentStatus: "PENDING", customer: {}, items: [{ sourceSku: "W1", name: "Gift card", qty: 1, unitPrice: x.total }] });
      },
    };
    registerPlatform(website);
    const s = await setup("third", { rules: false });
    const store = await s.c.store.create({ data: { brandId: s.sh.store.brandId, code: `WEB-${RUN}`, name: "Web", platform: website.code } as never });
    const conn = await s.c.connection.create({ data: { storeId: store.id, platform: website.code } as never });
    fixture(store.code, [{ visible: 2, record: { ref: "W-1", ts: at(1), total: "25.00" } }]);
    const r = await runSync(s.ws.id, conn.id, "INCREMENTAL", s.now(3));
    expect(r.counts.APPLIED).toBe(1);
    expect((await s.c.order.findFirstOrThrow({ where: { storeId: store.id } })).netBase.toString()).toBe("657500");
  });

  it("hai lượt đồng bộ cùng lúc trên một kết nối: một lượt bị từ chối (409)", async () => {
    const s = await setup("lock");
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "7001", name: "#7001", updated: 2 }) }]);
    const res = await Promise.allSettled([s.sync(s.sh, 3), s.sync(s.sh, 3)]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(res.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await s.c.order.count()).toBe(1);
  });

  it("người thiếu finance.view không thấy số tiền đơn", async () => {
    const s = await setup("mask");
    fixture(s.sh.store.code, [{ visible: 2, record: shopifyOrder({ id: "8001", name: "#8001", updated: 2 }) }]);
    await s.sync(s.sh, 3);
    const sales = (await loadUser((await makeUser("mask-sales", { workspaceId: s.ws.id, roles: ["SALES"] })).id))!;
    const list = await listOrders(sales, { page: 1 });
    expect(list.showMoney).toBe(false);
    expect(list.rev01Base).toBeNull();
    expect(list.rows[0].net).toBeNull();
    const other = await makeWorkspace("mask-other");
    const outsider = (await loadUser((await makeUser("mask-out", { workspaceId: other.id, roles: ["MANAGER"] })).id))!;
    expect((await listOrders(outsider, { page: 1 })).total).toBe(0);
    void rootDb;
  });
});

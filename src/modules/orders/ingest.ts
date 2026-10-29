// Nhập một bản ghi nguồn vào đơn chuẩn. Quy tắc (docs/data-model.md mục C, D-06, D-07, D-32):
// 1. Chống trùng: SourceEvent.eventKey duy nhất → nhận lại cùng phiên bản = DUPLICATE, không ghi gì.
// 2. Cập nhật muộn: mỗi liên kết nguồn giữ sourceUpdatedAt riêng; bản không mới hơn = STALE, không ghi đè.
// 3. Một đơn kinh doanh nhiều liên kết: bản ghi mới khớp linkRules với đơn đã có → gắn vào đơn đó (LINKED).
//    Không khớp quy tắc nhưng giống (SĐT + tiền ±1% + thời gian ±30 phút) → tạo đơn riêng + OrderLinkReview chờ người duyệt.
//    Không bao giờ tự gộp chỉ vì giống tiền/SĐT/thời điểm.
// 4. Chủ nhóm trường: nhóm order/payment/fulfillment chỉ do nguồn chủ ghi (mặc định liên kết chính; Setting.sourceOfTruth đổi được).
// 5. Tiền: Decimal, tỷ giá chốt theo FxRate hiệu lực tại ngày đặt; thiếu tỷ giá → ERROR, không đoán.
import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { normRef, type NormalizedOrder, type Platform } from "@/adapters/connectors/types";
import { closeLeadsOnOrder } from "@/modules/sales/routing";
import { resolveCustomer, type CustomerInput } from "@/modules/customers/resolve";

const D = Prisma.Decimal;
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

export type Group = "order" | "payment" | "fulfillment";
export type LinkRule = { platformA: string; fieldA: "orderNumber" | "refs"; platformB: string; fieldB: "orderNumber" | "refs" };
export type IngestSettings = { linkRules: LinkRule[]; sourceOfTruth: Partial<Record<Group, string>> };
export type Outcome = "APPLIED" | "LINKED" | "STALE" | "NOT_OWNER" | "DUPLICATE" | "ERROR";
export type IngestResult = { outcome: Outcome; orderId?: string; review?: boolean; error?: string };

export async function loadSettings(client: Db): Promise<IngestSettings> {
  const rows = await client.setting.findMany({ where: { key: { in: ["linkRules", "sourceOfTruth"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return { linkRules: (get("linkRules") as LinkRule[] | undefined) ?? [], sourceOfTruth: (get("sourceOfTruth") as IngestSettings["sourceOfTruth"] | undefined) ?? {} };
}

/** ponytail: so SĐT bằng 9 chữ số cuối — đủ cho cảnh báo nghi trùng; Phase 3 thay bằng chuẩn E.164 theo quốc gia. */
export const phoneKey = (p?: string | null) => (p ? p.replace(/\D/g, "").slice(-9) : null);

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

type Conn = { id: string; platform: string; storeId: string };

export async function ingest(
  client: Db,
  ctx: { conn: Conn; platform: Platform; settings: IngestSettings; syncRunId?: string },
  raw: unknown,
): Promise<IngestResult> {
  let n: NormalizedOrder;
  try {
    n = ctx.platform.map(raw);
  } catch (e) {
    return recordError(client, ctx, raw, `Không chuẩn hóa được bản ghi: ${message(e)}`);
  }
  const eventKey = `order:${n.sourceRecordId}:${n.sourceUpdatedAt.toISOString()}`;
  try {
    return await client.$transaction(async (tx) => {
      const ev = await tx.sourceEvent.create({
        data: {
          connectionId: ctx.conn.id, syncRunId: ctx.syncRunId, eventKey, recordType: "order",
          sourceRecordId: n.sourceRecordId, sourceUpdatedAt: n.sourceUpdatedAt, outcome: "APPLIED", payload: raw as Prisma.InputJsonValue,
        } as Prisma.SourceEventUncheckedCreateInput,
      });
      const res = await apply(tx, ctx, n);
      await tx.sourceEvent.update({ where: { id: ev.id }, data: { outcome: res.outcome, orderId: res.orderId ?? null } });
      return res;
    });
  } catch (e) {
    if (isUnique(e)) return { outcome: "DUPLICATE" };
    return recordError(client, ctx, raw, message(e), n);
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

async function recordError(client: Db, ctx: { conn: Conn; platform: Platform; syncRunId?: string }, raw: unknown, error: string, n?: NormalizedOrder): Promise<IngestResult> {
  const key = n ? { sourceRecordId: n.sourceRecordId, sourceUpdatedAt: n.sourceUpdatedAt } : ctx.platform.peek(raw);
  const sourceRecordId = key?.sourceRecordId ?? "unknown";
  const sourceUpdatedAt = key?.sourceUpdatedAt ?? new Date(0);
  try {
    await client.sourceEvent.create({
      data: {
        connectionId: ctx.conn.id, syncRunId: ctx.syncRunId, recordType: "order", sourceRecordId, sourceUpdatedAt,
        eventKey: `order:${sourceRecordId}:${sourceUpdatedAt.toISOString()}`, outcome: "ERROR", error, payload: raw as Prisma.InputJsonValue,
      } as Prisma.SourceEventUncheckedCreateInput,
    });
  } catch (e) {
    if (!isUnique(e)) throw e; // lỗi lặp lại của cùng phiên bản: đã ghi lần trước
  }
  return { outcome: "ERROR", error };
}

async function apply(tx: Tx, ctx: { conn: Conn; platform: Platform; settings: IngestSettings }, n: NormalizedOrder): Promise<IngestResult> {
  const link = await tx.sourceOrderLink.findFirst({ where: { connectionId: ctx.conn.id, sourceRecordId: n.sourceRecordId } });
  if (link) {
    if (n.sourceUpdatedAt <= link.sourceUpdatedAt) return { outcome: "STALE", orderId: link.orderId };
    const owned = await ownedGroups(tx, ctx.settings, link);
    // Luôn giữ mốc + trạng thái gốc của liên kết (truy vết, chống STALE); chỉ ghi vào đơn khi làm chủ ít nhất một nhóm trường.
    await tx.sourceOrderLink.update({
      where: { id: link.id },
      data: { sourceUpdatedAt: n.sourceUpdatedAt, sourceStatusRaw: n.sourceStatusRaw, refs: n.refs.map(normRef), orderNumberNorm: normRef(n.orderNumber) },
    });
    if (!owned.size) return { outcome: "NOT_OWNER", orderId: link.orderId };
    await writeOrder(tx, link.orderId, n, owned);
    await resolveCustomer(tx, customerInput(ctx.conn, n), link.orderId, owned.has("order"));
    return { outcome: "APPLIED", orderId: link.orderId };
  }

  const linkData = {
    connectionId: ctx.conn.id, platform: ctx.conn.platform, sourceRecordId: n.sourceRecordId, orderNumberNorm: normRef(n.orderNumber),
    refs: n.refs.map(normRef), sourceStatusRaw: n.sourceStatusRaw, sourceUpdatedAt: n.sourceUpdatedAt,
  };

  const target = await ruleMatch(tx, ctx, n);
  if (target) {
    const l = await tx.sourceOrderLink.create({ data: { ...linkData, orderId: target, isPrimary: false } as Prisma.SourceOrderLinkUncheckedCreateInput });
    const owned = await ownedGroups(tx, ctx.settings, l);
    if (owned.size) await writeOrder(tx, target, n, owned);
    // Nguồn phụ bổ sung danh tính (mã khách ở nền tảng kia) cho cùng khách; chỉ gắn lại khách nếu làm chủ nhóm đơn.
    await resolveCustomer(tx, customerInput(ctx.conn, n), target, owned.has("order"));
    return { outcome: "LINKED", orderId: target };
  }

  const order = await createOrder(tx, ctx.conn, n);
  await tx.sourceOrderLink.create({ data: { ...linkData, orderId: order.id, isPrimary: true } as Prisma.SourceOrderLinkUncheckedCreateInput });
  await resolveCustomer(tx, customerInput(ctx.conn, n), order.id, true);
  // Phase 4 (D-49): đơn mới của khách đang có nhu cầu mở → lead tự chuyển Đã mua.
  const linked = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { id: true, customerId: true, orderNumber: true, bookedAt: true, status: true } });
  await closeLeadsOnOrder(tx, linked);
  const review = await flagSuspect(tx, ctx.conn, order);
  return { outcome: "APPLIED", orderId: order.id, review };
}

const customerInput = (conn: Conn, n: NormalizedOrder): CustomerInput => ({
  connectionId: conn.id, platform: conn.platform, sourceId: n.customer.sourceId, name: n.customer.name,
  phone: n.customer.phone, email: n.customer.email, country: n.shipCountry, at: n.sourceUpdatedAt,
});

/**
 * Nhóm trường mà liên kết này làm chủ (D-32). Nền tảng được chỉ định trong sourceOfTruth chỉ giành quyền khi ĐƠN NÀY có liên kết
 * từ nền tảng đó; đơn không có thì nguồn tạo đơn (liên kết chính) vẫn làm chủ — nếu không, đơn chỉ có một nguồn sẽ không bao giờ
 * được cập nhật nhóm đó.
 */
async function ownedGroups(tx: Tx, s: IngestSettings, link: { orderId: string; platform: string; isPrimary: boolean }): Promise<Set<Group>> {
  const out = new Set<Group>();
  const owners = [...new Set(Object.values(s.sourceOfTruth).filter(Boolean) as string[])];
  const present = owners.length
    ? new Set((await tx.sourceOrderLink.findMany({ where: { orderId: link.orderId, platform: { in: owners } }, select: { platform: true } })).map((l) => l.platform))
    : new Set<string>();
  for (const g of ["order", "payment", "fulfillment"] as Group[]) {
    const owner = s.sourceOfTruth[g];
    if (owner && present.has(owner) ? owner === link.platform : link.isPrimary) out.add(g);
  }
  return out;
}

/** Đơn đã có mà bản ghi này trỏ tới theo một quy tắc liên kết. Nhiều đơn khớp → không tự gắn (trả null). */
async function ruleMatch(tx: Tx, ctx: { conn: Conn; settings: IngestSettings }, n: NormalizedOrder): Promise<string | null> {
  const mine = { orderNumber: [normRef(n.orderNumber)], refs: n.refs.map(normRef) };
  const found = new Set<string>();
  for (const r of ctx.settings.linkRules) {
    const sides: [keyof typeof mine, string, LinkRule["fieldA"]][] = [];
    if (r.platformA === ctx.conn.platform) sides.push([r.fieldA, r.platformB, r.fieldB]);
    if (r.platformB === ctx.conn.platform) sides.push([r.fieldB, r.platformA, r.fieldA]);
    for (const [myField, otherPlatform, otherField] of sides) {
      const vals = mine[myField];
      if (!vals.length) continue;
      const where = otherField === "orderNumber" ? { orderNumberNorm: { in: vals } } : { refs: { hasSome: vals } };
      const links = await tx.sourceOrderLink.findMany({ where: { platform: otherPlatform, connectionId: { not: ctx.conn.id }, ...where }, select: { orderId: true } });
      for (const l of links) found.add(l.orderId);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

async function fxFor(tx: Tx, currency: string, at: Date) {
  const r = await tx.fxRate.findFirst({ where: { currency, validFrom: { lte: at } }, orderBy: { validFrom: "desc" } });
  if (!r) throw new Error(`Thiếu tỷ giá ${currency} hiệu lực tại ${at.toISOString().slice(0, 10)} — thêm ở Danh mục → Tỷ giá rồi chạy lại`);
  return r;
}

function amounts(n: NormalizedOrder) {
  const gross = n.items.reduce((s, i) => s.add(new D(i.unitPrice).mul(i.qty)), new D(0));
  const net = gross.sub(n.discount).add(n.shippingFee);
  return { gross, net };
}

/** Trạng thái giao/hoàn suy từ dòng hàng + sự kiện vận chuyển (giữ đúng giao/hoàn một phần — D-07). */
export function deriveFulfillment(status: NormalizedOrder["status"], items: { qty: number; qtyDelivered: number; qtyReturned: number }[], events: { type: string }[]) {
  const total = items.reduce((s, i) => s + i.qty, 0);
  const delivered = items.reduce((s, i) => s + i.qtyDelivered, 0);
  const returned = items.reduce((s, i) => s + i.qtyReturned, 0);
  const returnStatus = returned === 0 ? "NONE" : returned >= total ? "FULL" : "PARTIAL";
  const last = events.filter((e) => e.type !== "COD_COLLECTED").at(-1)?.type;
  let fulfillmentStatus: "UNFULFILLED" | "IN_TRANSIT" | "PARTIAL" | "DELIVERED" | "FAILED" | "RETURNED";
  if (returned > 0 && returned >= total) fulfillmentStatus = "RETURNED";
  else if (total > 0 && delivered >= total) fulfillmentStatus = "DELIVERED";
  else if (delivered > 0) fulfillmentStatus = "PARTIAL";
  else if (status === "CANCELLED") fulfillmentStatus = "UNFULFILLED";
  else if (last === "FAILED") fulfillmentStatus = "FAILED";
  else if (last === "RETURNED") fulfillmentStatus = "RETURNED";
  else if (last) fulfillmentStatus = "IN_TRANSIT";
  else fulfillmentStatus = "UNFULFILLED";
  return { fulfillmentStatus, returnStatus } as const;
}

async function variantMap(tx: Tx, connId: string, skus: string[]) {
  const variants = await tx.variant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } });
  const mapped = new Set((await tx.sourceProductMapping.findMany({ where: { connectionId: connId, sourceSku: { in: skus } }, select: { sourceSku: true } })).map((m) => m.sourceSku));
  const missing = variants.filter((v) => !mapped.has(v.sku));
  if (missing.length) {
    await tx.sourceProductMapping.createMany({
      data: missing.map((v) => ({ connectionId: connId, sourceSku: v.sku, variantId: v.id })) as Prisma.SourceProductMappingCreateManyInput[],
      skipDuplicates: true,
    });
  }
  return new Map(variants.map((v) => [v.sku, v.id]));
}

const allEvents = (n: NormalizedOrder) => n.shipments.flatMap((s) => s.events).sort((a, b) => a.at.getTime() - b.at.getTime());
const deliveredAt = (n: NormalizedOrder) => allEvents(n).filter((e) => e.type === "DELIVERED").at(-1)?.at ?? null;

async function createOrder(tx: Tx, conn: Conn, n: NormalizedOrder) {
  const fx = await fxFor(tx, n.currency, n.bookedAt);
  const { gross, net } = amounts(n);
  const market = n.shipCountry ? await tx.market.findFirst({ where: { code: n.shipCountry } }) : null;
  const vmap = await variantMap(tx, conn.id, n.items.map((i) => i.sourceSku));
  const derived = deriveFulfillment(n.status, n.items, allEvents(n));
  return tx.order.create({
    data: {
      storeId: conn.storeId, marketId: market?.id ?? null, orderNumber: n.orderNumber, status: n.status, paymentStatus: n.paymentStatus,
      ...derived, currency: n.currency, grossAmount: gross, discount: n.discount, shippingFee: n.shippingFee, netAmount: net,
      refundedAmount: n.refunds.reduce((s, r) => s.add(r.amount), new D(0)),
      fxRate: fx.rateToBase, fxDate: fx.validFrom, netBase: net.mul(fx.rateToBase).toDecimalPlaces(4),
      customerName: n.customer.name, customerPhone: n.customer.phone, customerEmail: n.customer.email, customerSourceId: n.customer.sourceId,
      shipCountry: n.shipCountry, bookedAt: n.bookedAt, confirmedAt: n.confirmedAt, cancelledAt: n.cancelledAt, deliveredAt: deliveredAt(n),
      items: { create: n.items.map((i) => ({ variantId: vmap.get(i.sourceSku) ?? null, sourceSku: i.sourceSku, name: i.name, qty: i.qty, qtyDelivered: i.qtyDelivered, qtyReturned: i.qtyReturned, unitPrice: i.unitPrice, lineAmount: new D(i.unitPrice).mul(i.qty) })) },
      payments: { create: n.payments.map((p) => ({ method: p.method, amount: p.amount, currency: n.currency, status: p.status, paidAt: p.paidAt })) },
      refunds: { create: n.refunds.map((r) => ({ amount: r.amount, currency: n.currency, reason: r.reason, refundedAt: r.at })) },
      shipments: { create: n.shipments.map(shipmentCreate) },
    } as unknown as Prisma.OrderUncheckedCreateInput,
  });
}

function shipmentCreate(s: NormalizedOrder["shipments"][number]) {
  const evs = [...s.events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = evs.filter((e) => e.type !== "COD_COLLECTED").at(-1);
  const status = last?.type === "DELIVERED" ? "DELIVERED" : last?.type === "FAILED" ? "FAILED" : last?.type === "RETURNED" ? "RETURNED" : evs.length ? "IN_TRANSIT" : "UNFULFILLED";
  return {
    carrier: s.carrier, trackingNo: s.trackingNo, codAmount: s.codAmount, status,
    failureReason: evs.filter((e) => e.type === "FAILED").at(-1)?.reasonCode ?? null,
    deliveredAt: evs.filter((e) => e.type === "DELIVERED").at(-1)?.at ?? null,
    collectedAt: evs.filter((e) => e.type === "COD_COLLECTED").at(-1)?.at ?? null,
    events: { create: evs.map((e) => ({ type: e.type, occurredAt: e.at, reasonCode: e.reasonCode })) },
  };
}

/** Ghi các nhóm trường mà nguồn này làm chủ. Tỷ giá đã chốt lúc tạo đơn không đổi. */
async function writeOrder(tx: Tx, orderId: string, n: NormalizedOrder, owned: Set<Group>) {
  const cur = await tx.order.findFirstOrThrow({ where: { id: orderId }, include: { items: true, shipments: { include: { events: true } } } });
  const data: Record<string, unknown> = {};
  let items = cur.items.map((i) => ({ sourceSku: i.sourceSku, name: i.name, qty: i.qty, qtyDelivered: i.qtyDelivered, qtyReturned: i.qtyReturned, unitPrice: i.unitPrice.toString(), variantId: i.variantId }));

  if (owned.has("order")) {
    const prev = new Map(items.map((i) => [i.sourceSku, i]));
    items = n.items.map((i) => ({
      sourceSku: i.sourceSku, name: i.name, qty: i.qty, unitPrice: i.unitPrice, variantId: prev.get(i.sourceSku)?.variantId ?? null,
      // số giao/hoàn thuộc nhóm fulfillment: giữ giá trị cũ nếu nguồn này không làm chủ nhóm đó
      qtyDelivered: owned.has("fulfillment") ? i.qtyDelivered : Math.min(prev.get(i.sourceSku)?.qtyDelivered ?? 0, i.qty),
      qtyReturned: owned.has("fulfillment") ? i.qtyReturned : Math.min(prev.get(i.sourceSku)?.qtyReturned ?? 0, i.qty),
    }));
    const { gross, net } = amounts(n);
    Object.assign(data, {
      orderNumber: cur.orderNumber, status: n.status, confirmedAt: n.confirmedAt ?? cur.confirmedAt, cancelledAt: n.cancelledAt ?? null,
      grossAmount: gross, discount: n.discount, shippingFee: n.shippingFee, netAmount: net, netBase: net.mul(cur.fxRate).toDecimalPlaces(4),
      customerName: n.customer.name ?? cur.customerName, customerPhone: n.customer.phone ?? cur.customerPhone,
      customerEmail: n.customer.email ?? cur.customerEmail, shipCountry: n.shipCountry ?? cur.shipCountry,
    });
  } else if (owned.has("fulfillment")) {
    const upd = new Map(n.items.map((i) => [i.sourceSku, i]));
    items = items.map((i) => ({ ...i, qtyDelivered: Math.min(upd.get(i.sourceSku)?.qtyDelivered ?? i.qtyDelivered, i.qty), qtyReturned: Math.min(upd.get(i.sourceSku)?.qtyReturned ?? i.qtyReturned, i.qty) }));
  }

  if (owned.has("payment")) {
    await tx.payment.deleteMany({ where: { orderId } });
    await tx.refund.deleteMany({ where: { orderId } });
    await tx.payment.createMany({ data: n.payments.map((p) => ({ orderId, method: p.method, amount: p.amount, currency: cur.currency, status: p.status, paidAt: p.paidAt })) as Prisma.PaymentCreateManyInput[] });
    await tx.refund.createMany({ data: n.refunds.map((r) => ({ orderId, amount: r.amount, currency: cur.currency, reason: r.reason, refundedAt: r.at })) as Prisma.RefundCreateManyInput[] });
    Object.assign(data, { paymentStatus: n.paymentStatus, refundedAmount: n.refunds.reduce((s, r) => s.add(r.amount), new D(0)) });
  }

  let events = cur.shipments.flatMap((s) => s.events).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  if (owned.has("fulfillment")) {
    await tx.shipment.deleteMany({ where: { orderId } });
    for (const s of n.shipments) await tx.shipment.create({ data: { orderId, ...shipmentCreate(s) } as unknown as Prisma.ShipmentUncheckedCreateInput });
    events = allEvents(n).map((e) => ({ type: e.type, occurredAt: e.at })) as typeof events;
    data.deliveredAt = deliveredAt(n);
  }

  if (owned.has("order") || owned.has("fulfillment")) {
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.orderItem.createMany({
      data: items.map((i) => ({ orderId, variantId: i.variantId, sourceSku: i.sourceSku, name: i.name, qty: i.qty, qtyDelivered: i.qtyDelivered, qtyReturned: i.qtyReturned, unitPrice: i.unitPrice, lineAmount: new D(i.unitPrice).mul(i.qty) })) as Prisma.OrderItemCreateManyInput[],
    });
  }
  Object.assign(data, deriveFulfillment((data.status as NormalizedOrder["status"]) ?? cur.status, items, events));
  await tx.order.update({ where: { id: orderId }, data });
}

/** Đơn vừa tạo giống một đơn khác (SĐT + tiền quy đổi VND ±1% + đặt cách ≤ 30 phút) ở nguồn khác → hàng đợi xác minh. */
async function flagSuspect(tx: Tx, conn: Conn, order: { id: string; customerPhone: string | null; netBase: Prisma.Decimal; bookedAt: Date }) {
  const key = phoneKey(order.customerPhone);
  if (!key) return false;
  const win = 30 * 60 * 1000;
  const candidates = await tx.order.findMany({
    where: {
      id: { not: order.id },
      bookedAt: { gte: new Date(order.bookedAt.getTime() - win), lte: new Date(order.bookedAt.getTime() + win) },
      customerPhone: { endsWith: key.slice(-4) },
      links: { none: { connectionId: conn.id } },
    },
    select: { id: true, customerPhone: true, netBase: true, bookedAt: true },
    take: 20,
  });
  let flagged = false;
  for (const c of candidates) {
    if (phoneKey(c.customerPhone) !== key) continue;
    const diff = c.netBase.sub(order.netBase).abs();
    if (diff.gt(order.netBase.mul("0.01"))) continue;
    const [a, b] = [c.id, order.id].sort();
    try {
      await tx.orderLinkReview.create({
        data: { orderAId: a, orderBId: b, reasons: { phone: true, amountDiffBase: diff.toString(), minutesApart: Math.round(Math.abs(c.bookedAt.getTime() - order.bookedAt.getTime()) / 60000) } } as unknown as Prisma.OrderLinkReviewUncheckedCreateInput,
      });
      flagged = true;
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  return flagged;
}

// Customer 360 — HỢP ĐỒNG cho giao diện (/khach-hang, /khach-hang/[id], /xac-minh tab Khách).
// Mọi kiểm quyền, che tiền (finance.view) và che PII (customer.pii) ở đây; giao diện chỉ hiển thị cái được trả về.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { piiFor } from "@/lib/pii";
import { requirePerm, type SessionUser } from "@/lib/session";
import { refreshCustomerStats } from "./resolve";

export const CUSTOMER_PAGE_SIZE = 50;

export const customerFilter = z.object({
  q: z.string().trim().max(100).optional(),
  brand: z.string().optional(),
  market: z.string().optional(),
  /** Giá trị REV-03 12 tháng tối thiểu (USD). Bỏ qua khi người xem thiếu finance.view. */
  minValue: z.coerce.number().min(0).optional(),
  /** Lần mua gần nhất từ/đến (YYYY-MM-DD). */
  lastFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lastTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  repeat: z.enum(["1"]).optional(),
  sort: z.enum(["recent", "value", "orders", "name"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
});
export type CustomerFilter = z.infer<typeof customerFilter>;

/** Bộ lọc từ query string; giá trị sai bị bỏ qua. */
export function parseCustomerFilter(sp: Record<string, string | string[] | undefined>): CustomerFilter {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== "" && v !== undefined));
  const ok: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) if (customerFilter.shape[k as keyof typeof customerFilter.shape]?.safeParse(v).success) ok[k] = v;
  return customerFilter.parse(ok);
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  market: string | null;
  orderCount: number;
  deliveredOrders: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  /** null khi thiếu finance.view */
  valueUsd12m: string | null;
  platforms: string[];
  tags: string[];
};

export async function listCustomers(user: SessionUser, f: CustomerFilter) {
  requirePerm(user, "customer.view");
  const money = can(user.roles, "finance.view");
  const pii = piiFor(user);
  const w: Prisma.CustomerWhereInput = { mergedIntoId: null };
  if (f.market) w.marketId = f.market;
  if (f.brand) w.orders = { some: { store: { brandId: f.brand } } };
  if (f.repeat) w.orderCount = { gte: 2 };
  if (money && f.minValue != null) w.valueUsd12m = { gte: f.minValue };
  if (f.lastFrom || f.lastTo) w.lastOrderAt = { ...(f.lastFrom ? { gte: new Date(f.lastFrom) } : {}), ...(f.lastTo ? { lt: new Date(new Date(f.lastTo).getTime() + 86400000) } : {}) };
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    const q = f.q.toLowerCase();
    // Người thiếu quyền PII chỉ tìm được theo tên/mã (không dò được SĐT/email).
    w.OR = [
      { displayName: { contains: f.q, mode: "insensitive" } },
      { id: f.q },
      ...(pii.full && digits.length >= 4 ? [{ identities: { some: { phoneE164: { contains: digits } } } }] : []),
      ...(pii.full && q.includes("@") ? [{ identities: { some: { emailNormalized: { contains: q } } } }] : []),
      { identities: { some: { sourceCustomerId: f.q } } },
    ];
  }
  const sort = f.sort === "value" && !money ? "recent" : f.sort;
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    sort === "value" ? [{ valueUsd12m: "desc" }] : sort === "orders" ? [{ orderCount: "desc" }] : sort === "name" ? [{ displayName: "asc" }] : [{ lastOrderAt: { sort: "desc", nulls: "last" } }];
  const [total, rows, repeatCount] = await Promise.all([
    db.customer.count({ where: w }),
    db.customer.findMany({
      where: w, orderBy, skip: (f.page - 1) * CUSTOMER_PAGE_SIZE, take: CUSTOMER_PAGE_SIZE,
      include: { market: { select: { code: true } }, identities: { select: { platform: true }, distinct: ["platform"] } },
    }),
    db.customer.count({ where: { ...w, orderCount: { gte: 2 } } }),
  ]);
  return {
    total, page: f.page, pages: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)), showMoney: money, showPii: pii.full, repeatCount,
    rows: rows.map((c): CustomerRow => ({
      id: c.id, name: c.displayName, phone: pii.phone(c.primaryPhoneE164), email: pii.email(c.primaryEmail), market: c.market?.code ?? null,
      orderCount: c.orderCount, deliveredOrders: c.deliveredOrders, firstOrderAt: c.firstOrderAt?.toISOString() ?? null, lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
      valueUsd12m: money ? c.valueUsd12m.toString() : null, platforms: c.identities.map((i) => i.platform), tags: c.tags,
    })),
  };
}

export type TimelineItem = {
  at: string;
  kind: "order" | "delivery" | "refund" | "merge" | "unmerge" | "preference";
  title: string;
  detail?: string;
  href?: string;
  tone: "brand" | "success" | "danger" | "neutral" | "info";
};

const EVENT_TITLE: Record<string, string> = {
  PICKED: "Đã lấy hàng", IN_TRANSIT: "Đang vận chuyển", OUT_FOR_DELIVERY: "Đang giao", DELIVERED: "Đã giao",
  FAILED: "Giao thất bại", RETURNED: "Đã hoàn về", COD_COLLECTED: "Đã thu COD",
};

export async function getCustomer360(user: SessionUser, id: string) {
  requirePerm(user, "customer.view");
  const money = can(user.roles, "finance.view");
  const pii = piiFor(user);
  const c = await db.customer.findFirst({
    where: { id },
    include: {
      market: true,
      identities: { orderBy: { createdAt: "asc" } },
      addresses: { orderBy: { createdAt: "asc" } },
      preferences: { orderBy: { changedAt: "desc" } },
      orders: {
        orderBy: { bookedAt: "desc" },
        include: { store: { select: { name: true, platform: true } }, items: { select: { qty: true, qtyDelivered: true, qtyReturned: true, sourceSku: true, name: true } }, shipments: { include: { events: true } }, refunds: true },
      },
    },
  });
  if (!c) throw new HttpError(404, "Không tìm thấy khách");
  // Hồ sơ đã gộp vào khách khác → trả về để trang chuyển hướng tới hồ sơ giữ lại.
  if (c.mergedIntoId) return { redirectTo: c.mergedIntoId } as const;

  const conns = await db.connection.findMany({ where: { id: { in: c.identities.map((i) => i.connectionId).filter(Boolean) as string[] } }, include: { store: { select: { name: true } } } });
  const storeOf = new Map(conns.map((x) => [x.id, x.store.name]));
  const merges = await db.mergeLog.findMany({ where: { entity: "CUSTOMER", OR: [{ survivorId: id }, { mergedId: id }] }, orderBy: { mergedAt: "desc" } });
  const reviews = await db.customerReview.count({ where: { status: "PENDING", OR: [{ customerAId: id }, { customerBId: id }] } });

  const timeline: TimelineItem[] = [];
  for (const o of c.orders) {
    timeline.push({ at: o.bookedAt.toISOString(), kind: "order", title: `Đặt đơn ${o.orderNumber}`, detail: `${o.store.name} · ${o.items.reduce((s, i) => s + i.qty, 0)} sản phẩm${money ? ` · ${o.netAmount.toString()} ${o.currency}` : ""}`, href: `/don-hang/${o.id}`, tone: o.status === "CANCELLED" ? "neutral" : "brand" });
    for (const s of o.shipments) for (const e of s.events) {
      if (!["DELIVERED", "FAILED", "RETURNED", "COD_COLLECTED"].includes(e.type)) continue;
      timeline.push({ at: e.occurredAt.toISOString(), kind: "delivery", title: `${EVENT_TITLE[e.type]} · ${o.orderNumber}`, detail: e.reasonCode ?? s.carrier ?? undefined, href: `/don-hang/${o.id}`, tone: e.type === "DELIVERED" || e.type === "COD_COLLECTED" ? "success" : "danger" });
    }
    for (const r of o.refunds) timeline.push({ at: r.refundedAt.toISOString(), kind: "refund", title: `Hoàn tiền · ${o.orderNumber}`, detail: money ? `${r.amount.toString()} ${r.currency}` : undefined, href: `/don-hang/${o.id}`, tone: "danger" });
  }
  for (const m of merges) {
    timeline.push({ at: m.mergedAt.toISOString(), kind: "merge", title: m.survivorId === id ? "Gộp hồ sơ khác vào hồ sơ này" : "Hồ sơ được gộp vào hồ sơ khác", tone: "info" });
    if (m.unmergedAt) timeline.push({ at: m.unmergedAt.toISOString(), kind: "unmerge", title: "Tách lại hồ sơ", tone: "info" });
  }
  for (const p of c.preferences) timeline.push({ at: p.changedAt.toISOString(), kind: "preference", title: `${p.optIn ? "Đồng ý" : "Từ chối"} nhận ${p.purpose === "MARKETING" ? "tin tiếp thị" : "tin chăm sóc"} qua ${p.channel}`, detail: p.source, tone: "neutral" });
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const delivered = c.orders.filter((o) => o.items.some((i) => i.qtyDelivered > 0)).length;
  const failed = c.orders.filter((o) => o.fulfillmentStatus === "FAILED" || o.fulfillmentStatus === "RETURNED").length;
  // Quyền liên hệ hiện hành = lựa chọn mới nhất của mỗi (kênh, mục đích, brand).
  const seen = new Set<string>();
  const currentPrefs = c.preferences.filter((p) => {
    const k = `${p.channel}:${p.purpose}:${p.brandId ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    showMoney: money,
    showPii: pii.full,
    canMerge: can(user.roles, "customer.merge"),
    canEdit: can(user.roles, "customer.edit"),
    pendingReviews: reviews,
    customer: {
      id: c.id, name: c.displayName, phone: pii.phone(c.primaryPhoneE164), email: pii.email(c.primaryEmail), locale: c.locale,
      market: c.market ? { code: c.market.code, name: c.market.name, currency: c.market.currency, paymentMode: c.market.paymentMode } : null,
      tags: c.tags, createdAt: c.createdAt.toISOString(),
    },
    summary: {
      orderCount: c.orderCount, deliveredOrders: delivered, failedOrders: failed,
      firstOrderAt: c.firstOrderAt?.toISOString() ?? null, lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
      valueUsd12m: money ? c.valueUsd12m.toString() : null,
      /** Điểm có ở Phase 6; giờ luôn null → giao diện hiện "Chưa đủ dữ liệu". */
      score: null as null,
    },
    orders: c.orders.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, bookedAt: o.bookedAt.toISOString(), store: o.store.name, platform: o.store.platform,
      status: o.status, paymentStatus: o.paymentStatus, fulfillmentStatus: o.fulfillmentStatus, currency: o.currency,
      net: money ? o.netAmount.toString() : null, netUsd: money ? o.netUsd.toString() : null,
    })),
    identities: c.identities.map((i) => ({
      id: i.id, platform: i.platform, store: i.connectionId ? (storeOf.get(i.connectionId) ?? null) : null, sourceCustomerId: i.sourceCustomerId,
      phone: pii.phone(i.phoneE164), email: pii.email(i.emailNormalized), emailVerified: i.emailVerified, createdAt: i.createdAt.toISOString(),
    })),
    addresses: c.addresses.map((a) => ({ id: a.id, kind: a.kind, countryCode: a.countryCode, isDefault: a.isDefault, text: (a.normalized as { country?: string } | null)?.country ?? null })),
    preferences: currentPrefs.map((p) => ({ id: p.id, channel: p.channel, purpose: p.purpose, optIn: p.optIn, source: p.source, changedAt: p.changedAt.toISOString() })),
    merges: merges.map((m) => ({ id: m.id, role: m.survivorId === id ? ("survivor" as const) : ("merged" as const), otherId: m.survivorId === id ? m.mergedId : m.survivorId, mergedAt: m.mergedAt.toISOString(), unmergedAt: m.unmergedAt?.toISOString() ?? null, evidence: m.evidence })),
    timeline,
  };
}
export type Customer360 = Exclude<Awaited<ReturnType<typeof getCustomer360>>, { redirectTo: string }>;

// ---- Hàng đợi khách + gộp/tách -----------------------------------------------------------------

export async function listCustomerReviews(user: SessionUser) {
  requirePerm(user, "customer.merge");
  const pii = piiFor(user);
  const money = can(user.roles, "finance.view");
  const reviews = await db.customerReview.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 });
  const ids = [...new Set(reviews.flatMap((r) => [r.customerAId, r.customerBId]))];
  const cs = await db.customer.findMany({ where: { id: { in: ids }, mergedIntoId: null }, include: { market: { select: { code: true } }, identities: { select: { platform: true, sourceCustomerId: true, phoneE164: true, emailNormalized: true } } } });
  const byId = new Map(cs.map((c) => [c.id, c]));
  const side = (c: (typeof cs)[number]) => ({
    id: c.id, name: c.displayName, phone: pii.phone(c.primaryPhoneE164), email: pii.email(c.primaryEmail), market: c.market?.code ?? null,
    orderCount: c.orderCount, lastOrderAt: c.lastOrderAt?.toISOString() ?? null, valueUsd12m: money ? c.valueUsd12m.toString() : null,
    platforms: [...new Set(c.identities.map((i) => i.platform))],
  });
  return reviews
    .filter((r) => byId.has(r.customerAId) && byId.has(r.customerBId))
    .map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), reasons: r.reasons as Record<string, unknown>, a: side(byId.get(r.customerAId)!), b: side(byId.get(r.customerBId)!) }));
}

type Snapshot = { customer: Record<string, unknown>; identityIds: string[]; orderIds: string[]; addressIds: string[]; preferenceIds: string[] };

/** Gộp: hồ sơ tạo trước giữ lại; mọi danh tính/đơn/địa chỉ/lựa chọn liên hệ của hồ sơ kia chuyển sang. Ghi danh sách id để tách lại. */
async function mergeCustomers(user: SessionUser, survivorId: string, mergedId: string, evidence: Prisma.InputJsonValue) {
  return db.$transaction(async (tx) => {
    const [a, b] = await Promise.all([tx.customer.findFirst({ where: { id: survivorId, mergedIntoId: null } }), tx.customer.findFirst({ where: { id: mergedId, mergedIntoId: null } })]);
    if (!a || !b) throw new HttpError(409, "Một trong hai hồ sơ đã thay đổi, tải lại trang");
    const [survivor, merged] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
    const pick = async (m: { findMany(x: object): Promise<{ id: string }[]> }) => (await m.findMany({ where: { customerId: merged.id }, select: { id: true } })).map((x) => x.id);
    const snap: Snapshot = {
      customer: JSON.parse(JSON.stringify(merged)),
      identityIds: await pick(tx.customerIdentity as never), orderIds: await pick(tx.order as never),
      addressIds: await pick(tx.address as never), preferenceIds: await pick(tx.contactPreference as never),
    };
    await tx.customerIdentity.updateMany({ where: { customerId: merged.id }, data: { customerId: survivor.id } });
    await tx.order.updateMany({ where: { customerId: merged.id }, data: { customerId: survivor.id } });
    await tx.address.updateMany({ where: { customerId: merged.id }, data: { customerId: survivor.id, isDefault: false } });
    await tx.contactPreference.updateMany({ where: { customerId: merged.id }, data: { customerId: survivor.id } });
    await tx.customer.update({ where: { id: merged.id }, data: { mergedIntoId: survivor.id } });
    if (!survivor.primaryPhoneE164 && merged.primaryPhoneE164) await tx.customer.update({ where: { id: survivor.id }, data: { primaryPhoneE164: merged.primaryPhoneE164 } });
    if (!survivor.primaryEmail && merged.primaryEmail) await tx.customer.update({ where: { id: survivor.id }, data: { primaryEmail: merged.primaryEmail } });
    await refreshCustomerStats(tx, survivor.id);
    await refreshCustomerStats(tx, merged.id);
    const log = await tx.mergeLog.create({ data: { entity: "CUSTOMER", survivorId: survivor.id, mergedId: merged.id, snapshot: snap as unknown as Prisma.InputJsonValue, evidence, mergedById: user.id } as Prisma.MergeLogUncheckedCreateInput });
    await tx.customerReview.updateMany({ where: { status: "PENDING", OR: [{ customerAId: merged.id }, { customerBId: merged.id }], NOT: { AND: [{ customerAId: { in: [survivor.id, merged.id] } }, { customerBId: { in: [survivor.id, merged.id] } }] } }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
    await audit(tx, { actorId: user.id, entity: "Customer", entityId: survivor.id, action: "merge", after: { mergedId: merged.id, mergeLogId: log.id, moved: { identities: snap.identityIds.length, orders: snap.orderIds.length } } });
    return { survivorId: survivor.id, mergeLogId: log.id };
  });
}

export async function mergeFromReview(user: SessionUser, reviewId: string) {
  requirePerm(user, "customer.merge");
  const r = await db.customerReview.findFirst({ where: { id: reviewId, status: "PENDING" } });
  if (!r) throw new HttpError(404, "Yêu cầu xác minh không còn chờ xử lý");
  const res = await mergeCustomers(user, r.customerAId, r.customerBId, { reviewId, reasons: r.reasons } as Prisma.InputJsonValue);
  await db.customerReview.update({ where: { id: r.id }, data: { status: "LINKED", decidedById: user.id, decidedAt: new Date() } });
  return res;
}

export async function rejectCustomerReview(user: SessionUser, reviewId: string) {
  requirePerm(user, "customer.merge");
  const res = await db.customerReview.updateMany({ where: { id: reviewId, status: "PENDING" }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
  if (!res.count) throw new HttpError(404, "Yêu cầu xác minh không còn chờ xử lý");
  await audit(db, { actorId: user.id, entity: "CustomerReview", entityId: reviewId, action: "reject" });
}

/** Tách lại: trả đúng các danh tính/đơn/địa chỉ/lựa chọn đã chuyển khi gộp về hồ sơ cũ. Đơn đến SAU khi gộp ở lại hồ sơ giữ lại. */
export async function unmergeCustomers(user: SessionUser, mergeLogId: string) {
  requirePerm(user, "customer.merge");
  return db.$transaction(async (tx) => {
    const log = await tx.mergeLog.findFirst({ where: { id: mergeLogId, entity: "CUSTOMER", unmergedAt: null } });
    if (!log) throw new HttpError(404, "Không tìm thấy lần gộp hoặc đã tách");
    const s = log.snapshot as unknown as Snapshot;
    await tx.customerIdentity.updateMany({ where: { id: { in: s.identityIds } }, data: { customerId: log.mergedId } });
    await tx.order.updateMany({ where: { id: { in: s.orderIds } }, data: { customerId: log.mergedId } });
    await tx.address.updateMany({ where: { id: { in: s.addressIds } }, data: { customerId: log.mergedId } });
    await tx.contactPreference.updateMany({ where: { id: { in: s.preferenceIds } }, data: { customerId: log.mergedId } });
    await tx.customer.update({ where: { id: log.mergedId }, data: { mergedIntoId: null } });
    await refreshCustomerStats(tx, log.survivorId);
    await refreshCustomerStats(tx, log.mergedId);
    await tx.mergeLog.update({ where: { id: log.id }, data: { unmergedAt: new Date(), unmergedById: user.id } });
    await tx.customerReview.updateMany({ where: { status: "LINKED", OR: [{ customerAId: log.mergedId }, { customerBId: log.mergedId }] }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
    await audit(tx, { actorId: user.id, entity: "Customer", entityId: log.mergedId, action: "unmerge", after: { from: log.survivorId, mergeLogId } });
    return { customerId: log.mergedId, survivorId: log.survivorId };
  });
}

// ---- Lựa chọn liên hệ (chỉ thêm dòng mới, giữ lịch sử) -----------------------------------------

const prefSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(["EMAIL", "SMS", "PHONE", "WHATSAPP", "MESSENGER"]),
  purpose: z.enum(["MARKETING", "SERVICE"]),
  optIn: z.coerce.boolean(),
  source: z.string().trim().min(1, "Ghi nguồn của lựa chọn (vd. khách gọi điện)").max(120),
});

export async function recordPreference(user: SessionUser, input: unknown) {
  requirePerm(user, "customer.edit");
  const p = prefSchema.safeParse(input);
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ");
  if (!(await db.customer.findFirst({ where: { id: p.data.customerId, mergedIntoId: null } }))) throw new HttpError(404, "Không tìm thấy khách");
  const row = await db.contactPreference.create({ data: { ...p.data, changedById: user.id } as Prisma.ContactPreferenceUncheckedCreateInput });
  await audit(db, { actorId: user.id, entity: "ContactPreference", entityId: row.id, action: "create", after: p.data });
  return row;
}

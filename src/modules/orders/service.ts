// Đọc đơn hàng: danh sách lọc + phân trang phía server, chi tiết, xuất CSV. Số tiền che khi thiếu finance.view (docs/permissions.md mục 3).
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { piiFor } from "@/lib/pii";
import { dateTimeCsv } from "@/lib/format";
import { FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, pickBadge } from "@/lib/status-badge";
import { requirePerm, type SessionUser } from "@/lib/session";
import { orderScopeWhere } from "@/modules/sales/scope";

export const PAGE_SIZE = 50;

export const orderFilter = z.object({
  q: z.string().trim().max(100).optional(),
  store: z.string().optional(),
  market: z.string().optional(),
  status: z.enum(["BOOKED", "CONFIRMED", "CANCELLED"]).optional(),
  fulfillment: z.enum(["UNFULFILLED", "IN_TRANSIT", "PARTIAL", "DELIVERED", "FAILED", "RETURNED"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  multi: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type OrderFilter = z.infer<typeof orderFilter>;

/** Bộ lọc từ query string; giá trị không hợp lệ bị bỏ qua (không ném lỗi trên trang danh sách). */
export function parseFilter(sp: Record<string, string | string[] | undefined>): OrderFilter {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== "" && v !== undefined));
  const r = orderFilter.safeParse(flat);
  if (r.success) return r.data;
  const ok: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) if (orderFilter.shape[k as keyof typeof orderFilter.shape]?.safeParse(v).success) ok[k] = v;
  return orderFilter.parse(ok);
}

/** `pii=false`: không cho tìm theo SĐT/email (tránh dò thông tin qua ô tìm kiếm). */
function where(f: OrderFilter, pii: boolean): Prisma.OrderWhereInput {
  const w: Prisma.OrderWhereInput = {};
  if (f.store) w.storeId = f.store;
  if (f.market) w.marketId = f.market;
  if (f.status) w.status = f.status;
  if (f.fulfillment) w.fulfillmentStatus = f.fulfillment;
  if (f.from || f.to) w.bookedAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lt: new Date(new Date(f.to).getTime() + 86400000) } : {}) };
  if (f.multi) w.links = { some: { isPrimary: false } };
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    w.OR = [
      { orderNumber: { contains: f.q, mode: "insensitive" } },
      { customerName: { contains: f.q, mode: "insensitive" } },
      ...(pii ? [{ customerEmail: { contains: f.q, mode: "insensitive" as const } }] : []),
      ...(pii && digits.length >= 4 ? [{ customerPhone: { contains: digits } }] : []),
    ];
  }
  return w;
}

const money = (user: SessionUser) => can(user.roles, "finance.view");

export async function listOrders(user: SessionUser, f: OrderFilter) {
  requirePerm(user, "order.view");
  const pii = piiFor(user);
  const w: Prisma.OrderWhereInput = { AND: [where(f, pii.full), await orderScopeWhere(user)] };
  const [total, rows, agg] = await Promise.all([
    db.order.count({ where: w }),
    db.order.findMany({
      where: w,
      orderBy: { bookedAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { store: { select: { name: true, platform: true } }, market: { select: { code: true } }, links: { select: { platform: true, isPrimary: true } } },
    }),
    // REV-01: Σ giá trị đặt của đơn chưa hủy, quy VND (docs/metrics.md, D-44).
    db.order.aggregate({ where: { ...w, status: { not: "CANCELLED" } }, _sum: { netBase: true }, _count: true }),
  ]);
  const showMoney = money(user);
  return {
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    showMoney,
    rev01Base: showMoney ? (agg._sum.netBase?.toString() ?? "0") : null,
    rev01Count: agg._count,
    rows: rows.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, bookedAt: o.bookedAt.toISOString(), customerName: o.customerName, customerPhone: pii.phone(o.customerPhone), customerId: o.customerId,
      store: o.store.name, platform: o.store.platform, market: o.market?.code ?? o.shipCountry ?? null,
      status: o.status, paymentStatus: o.paymentStatus, fulfillmentStatus: o.fulfillmentStatus, returnStatus: o.returnStatus,
      currency: o.currency, net: showMoney ? o.netAmount.toString() : null, netBase: showMoney ? o.netBase.toString() : null,
      sources: o.links.map((l) => l.platform),
    })),
  };
}

export async function getOrder(user: SessionUser, id: string) {
  requirePerm(user, "order.view");
  const o = await db.order.findFirst({
    where: { id, ...(await orderScopeWhere(user)) },
    include: {
      store: { include: { brand: true } }, market: true, items: { include: { variant: { include: { product: true } } } },
      payments: { orderBy: { paidAt: "asc" } }, refunds: { orderBy: { refundedAt: "asc" } },
      shipments: { include: { events: { orderBy: { occurredAt: "asc" } } } },
      links: { include: { connection: { include: { store: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!o) throw new HttpError(404, "Không tìm thấy đơn");
  const events = await db.sourceEvent.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, outcome: true, sourceUpdatedAt: true, createdAt: true, connectionId: true, sourceRecordId: true } });
  const reviews = await db.orderLinkReview.findMany({ where: { status: "PENDING", OR: [{ orderAId: id }, { orderBId: id }] } });
  const showMoney = money(user);
  const pii = piiFor(user);
  const m = (v: Prisma.Decimal | null | undefined) => (showMoney && v != null ? v.toString() : null);
  return {
    showMoney,
    order: {
      ...o,
      customerPhone: pii.phone(o.customerPhone), customerEmail: pii.email(o.customerEmail),
      grossAmount: m(o.grossAmount), discount: m(o.discount), shippingFee: m(o.shippingFee), netAmount: m(o.netAmount), refundedAmount: m(o.refundedAmount),
      netBase: m(o.netBase), fxRate: m(o.fxRate),
      items: o.items.map((i) => ({ ...i, unitPrice: m(i.unitPrice), lineAmount: m(i.lineAmount) })),
      payments: showMoney ? o.payments.map((p) => ({ ...p, amount: p.amount.toString() })) : [],
      refunds: showMoney ? o.refunds.map((r) => ({ ...r, amount: r.amount.toString() })) : [],
      shipments: o.shipments.map((s) => ({ ...s, codAmount: m(s.codAmount) })),
    },
    events,
    pendingReviews: reviews.length,
  };
}

const CSV_HEAD = ["Mã đơn", "Ngày đặt (giờ VN)", "Shop", "Nền tảng", "Thị trường", "Khách", "SĐT", "Trạng thái", "Thanh toán", "Giao hàng", "Tiền tệ", "Giá trị (nguyên tệ)", "Tỷ giá", "Giá trị VND (REV-01)", "Số nguồn"];

/** CSV UTF-8 có BOM (Excel mở đúng tiếng Việt). ponytail: tối đa 10.000 dòng; lớn hơn thì xuất từ Warehouse (Phase 9). */
export async function exportOrdersCsv(user: SessionUser, f: OrderFilter) {
  requirePerm(user, "order.view");
  const showMoney = money(user);
  const pii = piiFor(user);
  const rows = await db.order.findMany({
    where: { AND: [where(f, pii.full), await orderScopeWhere(user)] }, orderBy: { bookedAt: "desc" }, take: 10000,
    include: { store: { select: { name: true, platform: true } }, market: { select: { code: true } }, _count: { select: { links: true } } },
  });
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((o) => [
    o.orderNumber, dateTimeCsv(o.bookedAt), o.store.name, o.store.platform, o.market?.code ?? o.shipCountry, o.customerName, pii.phone(o.customerPhone),
    pickBadge(ORDER_STATUS, o.status).label, pickBadge(PAYMENT_STATUS, o.paymentStatus).label, pickBadge(FULFILLMENT_STATUS, o.fulfillmentStatus).label, o.currency,
    showMoney ? o.netAmount.toString() : "", showMoney ? o.fxRate.toString() : "", showMoney ? o.netBase.toString() : "", o._count.links,
  ].map(esc).join(","));
  return "﻿" + [CSV_HEAD.join(","), ...lines].join("\r\n");
}

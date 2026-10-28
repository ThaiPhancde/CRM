// Hàng đợi xác minh đơn nghi trùng giữa hai nguồn (/xac-minh): gộp có ảnh chụp để tách lại, hoặc đánh dấu không phải cùng đơn.
// Gộp: giữ đơn đặt sớm hơn; liên kết nguồn của đơn kia chuyển sang (không còn là liên kết chính); đơn kia bị xóa sau khi lưu ảnh chụp.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { requirePerm, type SessionUser } from "@/lib/session";

const fullOrder = { items: true, payments: true, refunds: true, shipments: { include: { events: true } }, links: true, store: true } as const;

export async function listReviews(user: SessionUser) {
  requirePerm(user, "order.link");
  const reviews = await db.orderLinkReview.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 });
  const ids = [...new Set(reviews.flatMap((r) => [r.orderAId, r.orderBId]))];
  const orders = await db.order.findMany({ where: { id: { in: ids } }, include: { store: true, items: true, links: true } });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const merges = await db.mergeLog.findMany({ where: { entity: "ORDER" }, orderBy: { mergedAt: "desc" }, take: 30 });
  return {
    reviews: reviews.filter((r) => byId.has(r.orderAId) && byId.has(r.orderBId)).map((r) => ({ ...r, a: byId.get(r.orderAId)!, b: byId.get(r.orderBId)! })),
    merges,
  };
}

export async function linkReview(user: SessionUser, reviewId: string) {
  requirePerm(user, "order.link");
  return db.$transaction(async (tx) => {
    const r = await tx.orderLinkReview.findFirst({ where: { id: reviewId, status: "PENDING" } });
    if (!r) throw new HttpError(404, "Yêu cầu xác minh không còn chờ xử lý");
    const [a, b] = await Promise.all([tx.order.findFirst({ where: { id: r.orderAId }, include: fullOrder }), tx.order.findFirst({ where: { id: r.orderBId }, include: fullOrder })]);
    if (!a || !b) throw new HttpError(409, "Một trong hai đơn đã thay đổi, tải lại trang");
    const [survivor, merged] = a.bookedAt <= b.bookedAt ? [a, b] : [b, a];
    const log = await tx.mergeLog.create({
      data: { entity: "ORDER", survivorId: survivor.id, mergedId: merged.id, snapshot: JSON.parse(JSON.stringify(merged)), evidence: r.reasons as Prisma.InputJsonValue, mergedById: user.id } as Prisma.MergeLogUncheckedCreateInput,
    });
    await tx.sourceOrderLink.updateMany({ where: { orderId: merged.id }, data: { orderId: survivor.id, isPrimary: false } });
    await tx.sourceEvent.updateMany({ where: { orderId: merged.id }, data: { orderId: survivor.id } });
    // Yêu cầu khác trỏ tới đơn bị gộp: đóng lại (đơn đó không còn tồn tại riêng).
    await tx.orderLinkReview.updateMany({ where: { id: { not: r.id }, status: "PENDING", OR: [{ orderAId: merged.id }, { orderBId: merged.id }] }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
    await tx.order.delete({ where: { id: merged.id } });
    await tx.orderLinkReview.update({ where: { id: r.id }, data: { status: "LINKED", decidedById: user.id, decidedAt: new Date() } });
    await audit(tx, { actorId: user.id, entity: "Order", entityId: survivor.id, action: "merge", after: { merged: merged.orderNumber, mergeLogId: log.id } });
    return { survivorId: survivor.id, mergeLogId: log.id };
  });
}

export async function rejectReview(user: SessionUser, reviewId: string) {
  requirePerm(user, "order.link");
  const res = await db.orderLinkReview.updateMany({ where: { id: reviewId, status: "PENDING" }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
  if (!res.count) throw new HttpError(404, "Yêu cầu xác minh không còn chờ xử lý");
  await audit(db, { actorId: user.id, entity: "OrderLinkReview", entityId: reviewId, action: "reject" });
}

type Snap = Prisma.OrderGetPayload<{ include: typeof fullOrder }>;

/** Tách lại đơn đã gộp từ ảnh chụp: tạo lại đơn cũ (cùng id) và trả các liên kết nguồn của nó về. */
export async function unmerge(user: SessionUser, mergeLogId: string) {
  requirePerm(user, "order.link");
  return db.$transaction(async (tx) => {
    const log = await tx.mergeLog.findFirst({ where: { id: mergeLogId, entity: "ORDER", unmergedAt: null } });
    if (!log) throw new HttpError(404, "Không tìm thấy lần gộp hoặc đã tách");
    const s = log.snapshot as unknown as Snap;
    const { items, payments, refunds, shipments, links, store: _store, workspaceId: _ws, ...order } = s;
    void _store; void _ws;
    await tx.order.create({
      data: {
        ...order,
        items: { create: items.map(({ id: _i, orderId: _o, workspaceId: _w, ...i }) => (void _i, void _o, void _w, i)) },
        payments: { create: payments.map(({ id: _i, orderId: _o, workspaceId: _w, ...p }) => (void _i, void _o, void _w, p)) },
        refunds: { create: refunds.map(({ id: _i, orderId: _o, workspaceId: _w, ...r }) => (void _i, void _o, void _w, r)) },
        shipments: { create: shipments.map(({ id: _i, orderId: _o, workspaceId: _w, events, ...sh }) => (void _i, void _o, void _w, { ...sh, events: { create: events.map(({ id: _e, shipmentId: _s, workspaceId: _x, ...e }) => (void _e, void _s, void _x, e)) } })) },
      } as unknown as Prisma.OrderUncheckedCreateInput,
    });
    for (const l of links) await tx.sourceOrderLink.updateMany({ where: { id: l.id }, data: { orderId: s.id, isPrimary: l.isPrimary } });
    await tx.sourceEvent.updateMany({ where: { orderId: log.survivorId, sourceRecordId: { in: links.map((l) => l.sourceRecordId) } }, data: { orderId: s.id } });
    await tx.mergeLog.update({ where: { id: log.id }, data: { unmergedAt: new Date(), unmergedById: user.id } });
    await tx.orderLinkReview.updateMany({ where: { status: "LINKED", OR: [{ orderAId: s.id }, { orderBId: s.id }] }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
    await audit(tx, { actorId: user.id, entity: "Order", entityId: s.id, action: "unmerge", after: { from: log.survivorId, mergeLogId } });
    return { orderId: s.id };
  });
}

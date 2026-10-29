// Ticket sau bán (Phase 5): SLA theo mức, tạo (idempotent), danh sách/chi tiết theo phạm vi, trả lời khách (Outbox SIMULATED),
// ghi chú nội bộ, đổi trạng thái/mức/người phụ trách — mọi thay đổi ghi TicketEvent (chỉ thêm) + audit.
import { Prisma, type TicketPriority, type TicketStatus } from "@prisma/client";
import { z } from "zod";
import { bindTenant, db, type Db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { dateTime } from "@/lib/format";
import { enqueueOutbox, notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { piiFor } from "@/lib/pii";
import { requirePerm, type SessionUser } from "@/lib/session";
import { assigneeWhere, customerScopeWhere, orderScopeWhere } from "@/modules/sales/scope";
import { OPEN_TICKET, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "./labels";
import { ticketAssignWhere, ticketWhere } from "./scope";

// ---- SLA ----

/** Mặc định giờ lịch khi team chưa cấu hình SlaPolicy (Q-23 → D-50): phản hồi đầu / xử lý xong. */
export const DEFAULT_SLA: Record<TicketPriority, { firstResponseHours: number; resolveHours: number }> = {
  THAP: { firstResponseHours: 8, resolveHours: 48 },
  TRUNG: { firstResponseHours: 4, resolveHours: 24 },
  CAO: { firstResponseHours: 2, resolveHours: 8 },
  KHAN: { firstResponseHours: 0.5, resolveHours: 2 },
};

/** Chính sách khớp: brand cụ thể > mọi brand (brandId null) > mặc định. */
export async function slaFor(client: Pick<Db, "slaPolicy">, brandId: string | null, priority: TicketPriority) {
  const rows = await client.slaPolicy.findMany({ where: { priority, OR: [{ brandId: null }, ...(brandId ? [{ brandId }] : [])] } });
  const p = rows.find((r) => r.brandId === brandId) ?? rows.find((r) => r.brandId === null);
  return p ? { firstResponseHours: p.firstResponseHours, resolveHours: p.resolveHours } : DEFAULT_SLA[priority];
}

export function dueDates(createdAt: Date, sla: { firstResponseHours: number; resolveHours: number }) {
  return {
    firstResponseDueAt: new Date(createdAt.getTime() + sla.firstResponseHours * 3600000),
    resolveDueAt: new Date(createdAt.getTime() + sla.resolveHours * 3600000),
  };
}

const isOpen = (s: TicketStatus) => OPEN_TICKET.includes(s);

// ---- Tạo ----

const optId = z.string().trim().optional().transform((v) => v || undefined);
export const createTicketSchema = z.object({
  type: z.enum(TICKET_TYPES, { message: "Chọn loại sự cố" }),
  priority: z.enum(TICKET_PRIORITIES, { message: "Chọn mức ưu tiên" }),
  subject: z.string().trim().min(3, "Nhập tiêu đề (tối thiểu 3 ký tự)").max(200, "Tối đa 200 ký tự"),
  body: z.string().trim().min(1, "Mô tả sự cố").max(4000, "Tối đa 4000 ký tự"),
  customerId: optId,
  orderId: optId,
  ownerId: optId,
  idempotencyKey: z.string().trim().max(120).optional().transform((v) => v || undefined),
});

/** Số đơn giao thành công tối thiểu để coi là khách giá trị cao (D-24). ponytail: dùng số đơn đã giao lưu sẵn; ngưỡng theo thị trường để sau. */
export const VIP_MIN_DELIVERED = 3;

export async function createTicket(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "ticket.edit");
  const d = parse(createTicketSchema, input);
  if (d.idempotencyKey) {
    const prev = await db.ticket.findFirst({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true } });
    if (prev) return { id: prev.id, replayed: true };
  }
  const order = d.orderId
    ? await db.order.findFirst({ where: { id: d.orderId, ...(await orderScopeWhere(user)) }, select: { id: true, customerId: true, store: { select: { brandId: true } } } })
    : null;
  if (d.orderId && !order) throw new ValidationError({ orderId: "Không tìm thấy đơn trong phạm vi của bạn" });
  const customerId = d.customerId ?? order?.customerId ?? undefined;
  const customer = customerId
    ? await db.customer.findFirst({ where: { id: customerId, mergedIntoId: null, ...customerScopeWhere(user) }, select: { id: true, deliveredOrders: true } })
    : null;
  if (customerId && !customer) throw new ValidationError({ customerId: "Không tìm thấy khách trong phạm vi của bạn" });

  const ownerId = d.ownerId ?? user.id;
  const owner = await db.membership.findFirst({ where: { AND: [{ userId: ownerId }, ownerId === user.id ? { workspaceId: user.workspaceId } : assigneeWhere(user)], roles: { hasSome: ["MANAGER", "SALES_LEAD", "SALES", "FULFILLMENT"] } } });
  if (!owner) throw new ValidationError({ ownerId: "Người phụ trách không thuộc phạm vi bạn được giao" });

  const brandId = order?.store.brandId ?? null;
  const due = dueDates(now, await slaFor(db, brandId, d.priority));
  let ticket;
  for (let attempt = 0; ; attempt++) {
    const code = `TK-${String((await db.ticket.count()) + 1 + attempt).padStart(6, "0")}`;
    try {
      ticket = await db.$transaction(async (tx) => {
        const t = await tx.ticket.create({
          data: {
            code, type: d.type, priority: d.priority, subject: d.subject, customerId: customer?.id, orderId: order?.id, brandId,
            ownerId, teamId: owner.teamId, vip: (customer?.deliveredOrders ?? 0) >= VIP_MIN_DELIVERED, ...due,
            idempotencyKey: d.idempotencyKey, createdById: user.id, createdAt: now,
          } as Prisma.TicketUncheckedCreateInput,
        });
        await tx.ticketEvent.create({ data: { ticketId: t.id, type: "CREATED", body: d.body, actorId: user.id, createdAt: now } as never });
        // Ticket mở tạo việc cho người phụ trách (thiết kế Phase 5), hạn = hạn phản hồi đầu.
        await tx.task.create({ data: { type: "FOLLOW_UP", title: `Xử lý ticket ${code}: ${d.subject}`.slice(0, 200), dueAt: due.firstResponseDueAt, assigneeId: ownerId, ticketId: t.id, customerId: customer?.id, orderId: order?.id, createdById: user.id, idempotencyKey: `ticket-task:${t.id}` } as never });
        await audit(tx, { actorId: user.id, entity: "Ticket", entityId: t.id, action: "create", after: t });
        return t;
      });
      break;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      const target = String((e.meta as { target?: unknown })?.target ?? "");
      if (d.idempotencyKey && target.includes("idempotencyKey")) return { id: (await db.ticket.findFirstOrThrow({ where: { idempotencyKey: d.idempotencyKey } })).id, replayed: true };
      if (attempt >= 4) throw e; // mã trùng do tạo đồng thời → thử mã kế tiếp
    }
  }
  if (ownerId !== user.id) await notify(db, { userId: ownerId, title: `Ticket mới: ${ticket.code}`, body: d.subject, link: `/cham-soc/${ticket.id}`, key: `ticket-assigned:${ticket.id}:${ownerId}` });
  return { id: ticket.id, replayed: false };
}

// ---- Danh sách ----

export const ticketFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum([...TICKET_STATUSES, "open"]).optional().catch(undefined),
  priority: z.enum(TICKET_PRIORITIES).optional().catch(undefined),
  type: z.enum(TICKET_TYPES).optional().catch(undefined),
  owner: z.string().trim().max(40).optional().catch(undefined),
  overdue: z.coerce.boolean().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type TicketFilter = z.infer<typeof ticketFilterSchema>;
export const TICKET_PAGE_SIZE = 50;

export function parseTicketFilter(sp: Record<string, string | string[] | undefined>): TicketFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return ticketFilterSchema.parse({ q: one("q"), status: one("status"), priority: one("priority"), type: one("type"), owner: one("owner"), overdue: one("overdue") ? "1" : undefined, page: one("page") });
}

function toRow(user: SessionUser, t: Prisma.TicketGetPayload<{ include: { customer: { select: { id: true; displayName: true } }; owner: { select: { id: true; name: true } }; order: { select: { id: true; orderNumber: true } } } }>, now: Date) {
  const open = isOpen(t.status);
  return {
    id: t.id, code: t.code, type: t.type, priority: t.priority, status: t.status, subject: t.subject, vip: t.vip,
    customer: t.customer, order: t.order, owner: t.owner,
    firstResponseDueAt: t.firstResponseDueAt.toISOString(), resolveDueAt: t.resolveDueAt.toISOString(),
    firstRespondedAt: t.firstRespondedAt?.toISOString() ?? null, resolvedAt: t.resolvedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString(),
    /** Quá hạn phản hồi đầu / quá hạn xử lý (chỉ khi còn mở). */
    responseOverdue: open && !t.firstRespondedAt && t.firstResponseDueAt < now,
    resolveOverdue: open && t.resolveDueAt < now,
  };
}
export type TicketRow = ReturnType<typeof toRow>;

const rowInclude = { customer: { select: { id: true, displayName: true } }, owner: { select: { id: true, name: true } }, order: { select: { id: true, orderNumber: true } } } as const;

export async function listTickets(user: SessionUser, f: TicketFilter, now = new Date()) {
  requirePerm(user, "ticket.view");
  const and: Prisma.TicketWhereInput[] = [ticketWhere(user)];
  if (f.status === "open") and.push({ status: { in: OPEN_TICKET } });
  else if (f.status) and.push({ status: f.status });
  if (f.priority) and.push({ priority: f.priority });
  if (f.type) and.push({ type: f.type });
  if (f.owner === "me") and.push({ ownerId: user.id });
  else if (f.owner === "none") and.push({ ownerId: null });
  else if (f.owner) and.push({ ownerId: f.owner });
  if (f.overdue) and.push({ status: { in: OPEN_TICKET }, resolveDueAt: { lt: now } });
  if (f.q) and.push({ OR: [{ code: { equals: f.q.toUpperCase() } }, { subject: { contains: f.q, mode: "insensitive" } }, { customer: { displayName: { contains: f.q, mode: "insensitive" } } }] });
  const w = { AND: and };
  const [total, rows, overdue] = await Promise.all([
    db.ticket.count({ where: w }),
    db.ticket.findMany({ where: w, include: rowInclude, orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { vip: "desc" }, { resolveDueAt: "asc" }], skip: (f.page - 1) * TICKET_PAGE_SIZE, take: TICKET_PAGE_SIZE }),
    db.ticket.count({ where: { AND: [ticketWhere(user), { status: { in: OPEN_TICKET }, resolveDueAt: { lt: now } }] } }),
  ]);
  return { total, overdue, page: f.page, pageSize: TICKET_PAGE_SIZE, rows: rows.map((t) => toRow(user, t, now)), canEdit: can(user.roles, "ticket.edit"), canAssign: can(user.roles, "ticket.assign") };
}

// ---- Chi tiết ----

export async function getTicket(user: SessionUser, id: string, now = new Date()) {
  requirePerm(user, "ticket.view");
  const t = await db.ticket.findFirst({
    where: { AND: [{ id }, ticketWhere(user)] },
    include: {
      ...rowInclude,
      events: { orderBy: { createdAt: "asc" }, take: 500 },
      tasks: { orderBy: { dueAt: "asc" }, include: { assignee: { select: { name: true } } } },
      customer: { select: { id: true, displayName: true, primaryPhoneE164: true, primaryEmail: true, orderCount: true, deliveredOrders: true, marketId: true, locale: true } },
      order: { select: { id: true, orderNumber: true, status: true, fulfillmentStatus: true, bookedAt: true, shipments: { select: { carrier: true, trackingNo: true, events: { orderBy: { occurredAt: "desc" }, take: 3, select: { type: true, occurredAt: true, reasonCode: true } } } } } },
    },
  });
  if (!t) throw new HttpError(404, "Không tìm thấy ticket");
  const pii = piiFor(user);
  const actorIds = [...new Set(t.events.map((e) => e.actorId).filter(Boolean) as string[])];
  const names = new Map((await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const canAssign = can(user.roles, "ticket.assign") && (await db.ticket.count({ where: { AND: [{ id }, ticketAssignWhere(user)] } })) > 0;
  const articles = await suggestArticles(t.brandId, t.customer?.marketId ?? null);
  return {
    ...toRow(user, { ...t, customer: t.customer ? { id: t.customer.id, displayName: t.customer.displayName } : null, order: t.order ? { id: t.order.id, orderNumber: t.order.orderNumber } : null }, now),
    customerInfo: t.customer ? { id: t.customer.id, name: t.customer.displayName, phone: pii.phone(t.customer.primaryPhoneE164), email: pii.email(t.customer.primaryEmail), orderCount: t.customer.orderCount, deliveredOrders: t.customer.deliveredOrders } : null,
    orderInfo: t.order ? { id: t.order.id, orderNumber: t.order.orderNumber, status: t.order.status, fulfillmentStatus: t.order.fulfillmentStatus, bookedAt: t.order.bookedAt.toISOString(), shipments: t.order.shipments.map((s) => ({ carrier: s.carrier, trackingNo: s.trackingNo, events: s.events.map((e) => ({ type: e.type, at: e.occurredAt.toISOString(), reasonCode: e.reasonCode })) })) } : null,
    events: t.events.map((e) => ({ id: e.id, type: e.type, body: e.body, meta: e.meta, actor: e.actorId ? names.get(e.actorId) ?? null : null, at: e.createdAt.toISOString() })),
    tasks: t.tasks.map((k) => ({ id: k.id, title: k.title, dueAt: k.dueAt.toISOString(), status: k.status, assignee: k.assignee.name })),
    articles,
    canEdit: can(user.roles, "ticket.edit"),
    canAssign,
  };
}
export type TicketDetail = Awaited<ReturnType<typeof getTicket>>;

/** Bài tri thức đã xuất bản gợi ý cho ticket: khớp brand/market (null = áp mọi), cụ thể hơn xếp trước. */
async function suggestArticles(brandId: string | null, marketId: string | null) {
  const rows = await db.knowledgeArticle.findMany({
    where: { status: "PUBLISHED", AND: [{ OR: [{ brandId: null }, ...(brandId ? [{ brandId }] : [])] }, { OR: [{ marketId: null }, ...(marketId ? [{ marketId }] : [])] }] },
    select: { id: true, title: true, language: true, brandId: true, marketId: true }, take: 30,
  });
  return rows.sort((a, b) => Number(!!b.brandId) + Number(!!b.marketId) - Number(!!a.brandId) - Number(!!a.marketId)).slice(0, 6).map(({ id, title, language }) => ({ id, title, language }));
}

// ---- Thao tác ----

async function editable(user: SessionUser, id: string) {
  requirePerm(user, "ticket.edit");
  const t = await db.ticket.findFirst({ where: { AND: [{ id }, ticketWhere(user)] }, include: { customer: { select: { primaryEmail: true, primaryPhoneE164: true } } } });
  if (!t) throw new HttpError(404, "Không tìm thấy ticket hoặc ngoài phạm vi của bạn");
  return t;
}

export const replySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["REPLY", "NOTE"], { message: "Chọn trả lời khách hay ghi chú nội bộ" }),
  body: z.string().trim().min(1, "Nhập nội dung").max(4000, "Tối đa 4000 ký tự"),
  idempotencyKey: z.string().trim().max(120).optional().transform((v) => v || undefined),
});

/** Trả lời khách (Outbox SIMULATED, ghi nhận phản hồi đầu, Mới → Đang xử lý) hoặc ghi chú nội bộ. Gửi lặp cùng khóa không nhân đôi. */
export async function replyTicket(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(replySchema, input);
  const t = await editable(user, d.id);
  if (d.idempotencyKey && (await db.ticketEvent.findFirst({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true } }))) return { replayed: true };
  if (d.kind === "REPLY" && !t.customer?.primaryEmail && !t.customer?.primaryPhoneE164) throw new ValidationError({ kind: "Ticket chưa gắn khách có email/SĐT — chỉ ghi chú nội bộ được" });
  try {
    await db.$transaction(async (tx) => {
      await tx.ticketEvent.create({ data: { ticketId: t.id, type: d.kind, body: d.body, actorId: user.id, idempotencyKey: d.idempotencyKey, createdAt: now } as never });
      if (d.kind === "REPLY") {
        await enqueueOutbox(tx as never, { channel: t.customer!.primaryEmail ? "EMAIL" : "SMS", recipient: t.customer!.primaryEmail ?? t.customer!.primaryPhoneE164!, subject: `[${t.code}] ${t.subject}`, body: d.body, entity: "Ticket", entityId: t.id, key: `ticket-reply:${t.id}:${d.idempotencyKey ?? now.getTime()}` });
        await tx.ticket.update({ where: { id: t.id }, data: { ...(t.firstRespondedAt ? {} : { firstRespondedAt: now }), ...(t.status === "MOI" ? { status: "DANG_XU_LY" } : {}) } });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && d.idempotencyKey) return { replayed: true };
    throw e;
  }
  return { replayed: false };
}

export const statusSchema = z.object({ id: z.string().min(1), status: z.enum(TICKET_STATUSES, { message: "Chọn trạng thái" }), note: z.string().trim().max(500).optional().transform((v) => v || undefined) });

/** Đổi trạng thái. Đã giải quyết/Đóng ghi mốc và hoàn thành việc đang mở của ticket; mở lại xóa mốc. */
export async function setTicketStatus(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(statusSchema, input);
  const t = await editable(user, d.id);
  if (t.status === d.status) return t;
  const done = !isOpen(d.status);
  return db.$transaction(async (tx) => {
    const after = await tx.ticket.update({
      where: { id: t.id },
      data: { status: d.status, resolvedAt: done ? (t.resolvedAt ?? now) : null, closedAt: d.status === "DONG" ? now : null },
    });
    await tx.ticketEvent.create({ data: { ticketId: t.id, type: "STATUS", body: d.note, actorId: user.id, meta: { from: t.status, to: d.status }, createdAt: now } as never });
    if (done) await tx.task.updateMany({ where: { ticketId: t.id, status: "OPEN" }, data: { status: "DONE", completedAt: now } });
    await audit(tx, { actorId: user.id, entity: "Ticket", entityId: t.id, action: "status", before: { status: t.status }, after: { status: d.status } });
    return after;
  });
}

export const prioritySchema = z.object({ id: z.string().min(1), priority: z.enum(TICKET_PRIORITIES, { message: "Chọn mức ưu tiên" }) });

/** Đổi mức → tính lại hạn từ lúc tạo theo chính sách mới. */
export async function setTicketPriority(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(prioritySchema, input);
  const t = await editable(user, d.id);
  if (t.priority === d.priority) return t;
  const due = dueDates(t.createdAt, await slaFor(db, t.brandId, d.priority));
  return db.$transaction(async (tx) => {
    const after = await tx.ticket.update({ where: { id: t.id }, data: { priority: d.priority, ...due, dueSoonNotifiedAt: null, breachNotifiedAt: null } });
    await tx.ticketEvent.create({ data: { ticketId: t.id, type: "PRIORITY", actorId: user.id, meta: { from: t.priority, to: d.priority }, body: `Hạn xử lý mới: ${dateTime(due.resolveDueAt)}`, createdAt: now } as never });
    await audit(tx, { actorId: user.id, entity: "Ticket", entityId: t.id, action: "priority", before: { priority: t.priority }, after: { priority: d.priority, ...due } });
    return after;
  });
}

export const assignSchema = z.object({ id: z.string().min(1), toUserId: z.string().min(1, "Chọn người nhận"), reason: z.string().trim().min(3, "Nhập lý do (tối thiểu 3 ký tự)").max(300) });

export async function assignTicket(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "ticket.assign");
  const d = parse(assignSchema, input);
  const t = await db.ticket.findFirst({ where: { AND: [{ id: d.id }, ticketAssignWhere(user)] } });
  if (!t) throw new HttpError(404, "Không tìm thấy ticket trong phạm vi bạn được giao");
  if (t.ownerId === d.toUserId) throw new ValidationError({ toUserId: "Người này đang phụ trách" });
  const target = await db.membership.findFirst({ where: { AND: [{ userId: d.toUserId }, assigneeWhere(user)], roles: { hasSome: ["MANAGER", "SALES_LEAD", "SALES", "FULFILLMENT"] } }, include: { user: { select: { name: true } } } });
  if (!target) throw new ValidationError({ toUserId: "Người nhận không thuộc phạm vi bạn được giao" });
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: t.id }, data: { ownerId: d.toUserId, teamId: target.teamId ?? t.teamId } });
    await tx.task.updateMany({ where: { ticketId: t.id, status: "OPEN" }, data: { assigneeId: d.toUserId } });
    await tx.ticketEvent.create({ data: { ticketId: t.id, type: "ASSIGN", actorId: user.id, body: `Chuyển cho ${target.user.name}: ${d.reason}`, meta: { from: t.ownerId, to: d.toUserId }, createdAt: now } as never });
    await audit(tx, { actorId: user.id, entity: "Ticket", entityId: t.id, action: "assign", before: { ownerId: t.ownerId }, after: { ownerId: d.toUserId }, reason: d.reason });
  });
  await notify(db, { userId: d.toUserId, title: `Bạn được giao ticket ${t.code}`, body: d.reason, link: `/cham-soc/${t.id}`, key: `ticket-assigned:${t.id}:${d.toUserId}:${now.getTime()}` });
}

// ---- Worker ----

/**
 * Nhắc SLA một lần: còn ≤ 1 giờ tới hạn xử lý → báo người phụ trách; quá hạn → báo người phụ trách + Trưởng nhóm (hoặc Quản lý khi chưa có nhóm).
 * Đánh dấu dueSoonNotifiedAt / breachNotifiedAt, ghi theo lô (D-48).
 */
export async function remindTicketSla(client: Db, now = new Date()) {
  const open = { status: { in: OPEN_TICKET } };
  const soon = await client.ticket.findMany({ where: { ...open, ownerId: { not: null }, dueSoonNotifiedAt: null, resolveDueAt: { gte: now, lte: new Date(now.getTime() + 3600000) } }, select: { id: true, code: true, ownerId: true, resolveDueAt: true }, take: 1000 });
  if (soon.length) {
    await client.notification.createMany({ data: soon.map((t) => ({ userId: t.ownerId, title: `Sắp quá hạn: ${t.code}`, body: `Hạn xử lý ${dateTime(t.resolveDueAt)}`, link: `/cham-soc/${t.id}`, idempotencyKey: `ticket-soon:${t.id}` })) as never, skipDuplicates: true });
    await client.ticket.updateMany({ where: { id: { in: soon.map((t) => t.id) } }, data: { dueSoonNotifiedAt: now } });
  }
  const late = await client.ticket.findMany({ where: { ...open, breachNotifiedAt: null, resolveDueAt: { lt: now } }, select: { id: true, code: true, ownerId: true, teamId: true }, take: 1000 });
  if (late.length) {
    const leadsOf = new Map<string, string[]>();
    for (const team of new Set(late.map((t) => t.teamId ?? "none"))) {
      const ms = await client.membership.findMany({ where: team === "none" ? { active: true, roles: { has: "MANAGER" } } : { teamId: team, active: true, roles: { has: "SALES_LEAD" } }, select: { userId: true } });
      leadsOf.set(team, ms.map((m) => m.userId));
    }
    const rows = late.flatMap((t) => [...new Set([...(t.ownerId ? [t.ownerId] : []), ...(leadsOf.get(t.teamId ?? "none") ?? [])])].map((u) => ({ userId: u, title: `Quá hạn xử lý: ${t.code}`, link: `/cham-soc/${t.id}`, idempotencyKey: `ticket-breach:${t.id}:${u}` })));
    if (rows.length) await client.notification.createMany({ data: rows as never, skipDuplicates: true });
    await client.ticket.updateMany({ where: { id: { in: late.map((t) => t.id) } }, data: { breachNotifiedAt: now } });
  }
  return { dueSoon: soon.length, breached: late.length };
}

/** Ticket mở của người dùng cho hàng đợi (/hang-doi). Trưởng nhóm thấy thêm ticket chưa giao của nhóm. */
export async function queueTickets(user: SessionUser, now = new Date()) {
  if (!can(user.roles, "ticket.view")) return [];
  bindTenant(user);
  const [mine, pool] = await Promise.all([
    db.ticket.findMany({ where: { ownerId: user.id, status: { in: OPEN_TICKET } }, orderBy: { resolveDueAt: "asc" }, take: 100 }),
    user.roles.includes("SALES_LEAD") && user.teamId ? db.ticket.findMany({ where: { teamId: user.teamId, ownerId: null, status: { in: OPEN_TICKET } }, orderBy: { resolveDueAt: "asc" }, take: 100 }) : [],
  ]);
  const due = (t: (typeof mine)[number]) => (t.firstRespondedAt ? t.resolveDueAt : t.firstResponseDueAt);
  return [
    ...mine.map((t) => ({ kind: "ticket" as const, id: t.id, title: `${t.vip ? "★ " : ""}${t.code}: ${t.subject}`, detail: t.firstRespondedAt ? "Hạn xử lý" : "Hạn phản hồi đầu", dueAt: due(t).toISOString(), overdue: due(t) < now, link: `/cham-soc/${t.id}`, vip: t.vip })),
    ...pool.map((t) => ({ kind: "ticket_unassigned" as const, id: t.id, title: `Ticket chưa giao: ${t.code}`, detail: t.subject, dueAt: t.resolveDueAt.toISOString(), overdue: t.resolveDueAt < now, link: `/cham-soc/${t.id}`, vip: t.vip })),
  ];
}

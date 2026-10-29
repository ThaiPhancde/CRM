// Nhiệm vụ (Task): tạo (idempotent — bấm hai lần không nhân đôi), danh sách theo phạm vi, hoàn thành/hủy.
import { Prisma, type TaskStatus, type TaskType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { requirePerm, type SessionUser } from "@/lib/session";
import { assigneeWhere, customerScopeWhere, leadEditWhere, orderScopeWhere, taskWhere } from "./scope";

export const TASK_TYPES = ["CALL_BACK", "FOLLOW_UP", "MEETING", "OTHER"] as const satisfies readonly TaskType[];
export const TASK_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const satisfies readonly TaskStatus[];
export const TASK_PAGE_SIZE = 50;

const optId = z.string().trim().optional().transform((v) => v || undefined);

export const createTaskSchema = z.object({
  type: z.enum(TASK_TYPES, { message: "Chọn loại việc" }),
  title: z.string().trim().min(1, "Bắt buộc").max(200, "Tối đa 200 ký tự"),
  note: z.string().trim().max(2000, "Tối đa 2000 ký tự").optional().transform((v) => v || undefined),
  dueAt: z.string().trim().min(1, "Chọn hạn").transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Hạn không hợp lệ" });
      return z.NEVER;
    }
    return d;
  }),
  assigneeId: optId,
  leadId: optId,
  customerId: optId,
  orderId: optId,
  /** Form sinh một khóa mỗi lần mở; gửi lại cùng khóa → trả việc đã tạo. */
  idempotencyKey: z.string().trim().max(120).optional().transform((v) => v || undefined),
});

export async function createTask(user: SessionUser, input: unknown) {
  requirePerm(user, "task.manage");
  const d = parse(createTaskSchema, input);
  if (d.idempotencyKey) {
    const prev = await db.task.findFirst({ where: { idempotencyKey: d.idempotencyKey } });
    if (prev) return { task: prev, replayed: true };
  }
  const assigneeId = d.assigneeId ?? user.id;
  if (assigneeId !== user.id && !(await db.membership.findFirst({ where: { AND: [{ userId: assigneeId }, assigneeWhere(user)] } })))
    throw new ValidationError({ assigneeId: "Bạn chỉ giao việc trong phạm vi của mình" });
  const [lead, customer, order] = await Promise.all([
    d.leadId ? db.lead.findFirst({ where: { AND: [{ id: d.leadId }, leadEditWhere(user)] }, select: { id: true, customerId: true } }) : null,
    d.customerId ? db.customer.findFirst({ where: { id: d.customerId, mergedIntoId: null, ...customerScopeWhere(user) }, select: { id: true } }) : null,
    d.orderId ? db.order.findFirst({ where: { id: d.orderId, ...(await orderScopeWhere(user)) }, select: { id: true, customerId: true } }) : null,
  ]);
  if (d.leadId && !lead) throw new ValidationError({ leadId: "Không tìm thấy nhu cầu mua trong phạm vi của bạn" });
  if (d.customerId && !customer) throw new ValidationError({ customerId: "Không tìm thấy khách trong phạm vi của bạn" });
  if (d.orderId && !order) throw new ValidationError({ orderId: "Không tìm thấy đơn" });
  try {
    const task = await db.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          type: d.type, title: d.title, note: d.note, dueAt: d.dueAt, assigneeId,
          leadId: lead?.id, customerId: customer?.id ?? lead?.customerId ?? order?.customerId ?? undefined, orderId: order?.id,
          createdById: user.id, idempotencyKey: d.idempotencyKey,
        } as Prisma.TaskUncheckedCreateInput,
      });
      await audit(tx, { actorId: user.id, entity: "Task", entityId: t.id, action: "create", after: t });
      return t;
    });
    return { task, replayed: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && d.idempotencyKey)
      return { task: await db.task.findFirstOrThrow({ where: { idempotencyKey: d.idempotencyKey } }), replayed: true };
    throw e;
  }
}

export const taskFilterSchema = z.object({
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  /** "me" | "team" (mặc định theo phạm vi) */
  who: z.enum(["me", "all"]).optional().catch(undefined),
  /** overdue: quá hạn · today: hết hôm nay · week: 7 ngày tới */
  due: z.enum(["overdue", "today", "week"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export function parseTaskFilter(sp: Record<string, string | string[] | undefined>): TaskFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return taskFilterSchema.parse({ status: one("status"), who: one("who"), due: one("due"), page: one("page") });
}

/** Cuối ngày theo giờ Việt Nam (UTC+7, không có giờ mùa hè). */
export function endOfDayVN(now: Date) {
  const vn = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), 23, 59, 59, 999) - 7 * 3600000);
}

export async function listTasks(user: SessionUser, f: TaskFilter, now = new Date()) {
  requirePerm(user, "task.manage");
  const and: Prisma.TaskWhereInput[] = [taskWhere(user)];
  if (f.who === "me") and.push({ assigneeId: user.id });
  if (f.status) and.push({ status: f.status });
  if (f.due === "overdue") and.push({ status: "OPEN", dueAt: { lt: now } });
  if (f.due === "today") and.push({ dueAt: { lte: endOfDayVN(now) } });
  if (f.due === "week") and.push({ dueAt: { lte: new Date(now.getTime() + 7 * 86400000) } });
  const w = { AND: and };
  const [total, rows] = await Promise.all([
    db.task.count({ where: w }),
    db.task.findMany({
      where: w, orderBy: [{ status: "asc" }, { dueAt: "asc" }], skip: (f.page - 1) * TASK_PAGE_SIZE, take: TASK_PAGE_SIZE,
      include: { assignee: { select: { id: true, name: true } }, lead: { select: { id: true, contactName: true } }, customer: { select: { id: true, displayName: true } }, order: { select: { id: true, orderNumber: true } } },
    }),
  ]);
  return {
    total, page: f.page, pageSize: TASK_PAGE_SIZE,
    rows: rows.map((t) => ({
      id: t.id, type: t.type, title: t.title, note: t.note, dueAt: t.dueAt.toISOString(), status: t.status,
      overdue: t.status === "OPEN" && t.dueAt < now, completedAt: t.completedAt?.toISOString() ?? null,
      assignee: t.assignee, lead: t.lead, customer: t.customer, order: t.order, mine: t.assigneeId === user.id,
    })),
  };
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>["rows"][number];

/** Hoàn thành / hủy / mở lại. Việc gắn lead ghi một dòng vào dòng thời gian của lead. */
export async function setTaskStatus(user: SessionUser, id: string, status: TaskStatus, now = new Date()) {
  requirePerm(user, "task.manage");
  const t = await db.task.findFirst({ where: { AND: [{ id }, taskWhere(user)] } });
  if (!t) throw new HttpError(404, "Không tìm thấy việc");
  if (t.status === status) return t;
  return db.$transaction(async (tx) => {
    const after = await tx.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? now : null } });
    if (t.leadId && status !== "OPEN")
      await tx.activity.create({ data: { type: "SYSTEM", leadId: t.leadId, customerId: t.customerId, actorId: user.id, body: `${status === "DONE" ? "Hoàn thành" : "Hủy"} việc: ${t.title}`, occurredAt: now } as never });
    await audit(tx, { actorId: user.id, entity: "Task", entityId: id, action: "status", before: { status: t.status }, after: { status } });
    return after;
  });
}

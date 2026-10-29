// Hàng đợi của tôi (/hang-doi) + thông báo trong ứng dụng + job worker (giao lead còn treo, nhắc hạn).
import type { Prisma } from "@prisma/client";
import { db, type Db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { enqueueOutbox, notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { OPEN_STAGES, autoAssign } from "./routing";
import { endOfDayVN } from "./tasks";

export type QueueItem = {
  kind: "lead_response" | "lead_followup" | "lead_unassigned" | "task";
  id: string;
  title: string;
  detail: string | null;
  dueAt: string | null;
  overdue: boolean;
  link: string;
};

/**
 * Việc cần làm của người dùng, sắp theo ưu tiên: quá hạn trước, rồi hạn gần nhất. Gồm lead chưa phản hồi, lead đến hẹn
 * liên hệ lại, việc đến hạn trong 24 giờ; Trưởng nhóm thấy thêm lead chưa giao của nhóm. Ticket thêm ở Phase 5.
 */
export async function myQueue(user: SessionUser, now = new Date()) {
  if (!can(user.roles, "lead.view") && !can(user.roles, "task.manage")) throw new HttpError(403, "Không có quyền");
  const open = { stage: { in: [...OPEN_STAGES] } } satisfies Prisma.LeadWhereInput;
  const lead = can(user.roles, "lead.edit");
  const [noReply, followUp, tasks, pool] = await Promise.all([
    lead ? db.lead.findMany({ where: { ...open, ownerId: user.id, firstRespondedAt: null }, orderBy: { firstResponseDueAt: "asc" }, take: 100 }) : [],
    lead ? db.lead.findMany({ where: { ...open, ownerId: user.id, firstRespondedAt: { not: null }, nextActionAt: { lte: endOfDayVN(now) } }, orderBy: { nextActionAt: "asc" }, take: 100 }) : [],
    can(user.roles, "task.manage") ? db.task.findMany({ where: { assigneeId: user.id, status: "OPEN", dueAt: { lte: new Date(now.getTime() + 86400000) } }, orderBy: { dueAt: "asc" }, take: 100, include: { lead: { select: { contactName: true } }, customer: { select: { displayName: true } } } }) : [],
    user.roles.includes("SALES_LEAD") && user.teamId ? db.lead.findMany({ where: { ...open, teamId: user.teamId, ownerId: null }, orderBy: { createdAt: "asc" }, take: 100 }) : [],
  ]);
  const at = (d: Date | null) => d?.toISOString() ?? null;
  const items: QueueItem[] = [
    ...noReply.map((l) => ({ kind: "lead_response" as const, id: l.id, title: `Phản hồi lead: ${l.contactName}`, detail: l.interest, dueAt: at(l.firstResponseDueAt), overdue: !!l.firstResponseDueAt && l.firstResponseDueAt < now, link: `/nhu-cau/${l.id}` })),
    ...followUp.map((l) => ({ kind: "lead_followup" as const, id: l.id, title: `Liên hệ lại: ${l.contactName}`, detail: l.interest, dueAt: at(l.nextActionAt), overdue: !!l.nextActionAt && l.nextActionAt < now, link: `/nhu-cau/${l.id}` })),
    ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, detail: t.lead?.contactName ?? t.customer?.displayName ?? null, dueAt: at(t.dueAt), overdue: t.dueAt < now, link: t.leadId ? `/nhu-cau/${t.leadId}` : `/nhiem-vu` })),
    ...pool.map((l) => ({ kind: "lead_unassigned" as const, id: l.id, title: `Chưa giao: ${l.contactName}`, detail: l.interest, dueAt: at(l.firstResponseDueAt), overdue: !!l.firstResponseDueAt && l.firstResponseDueAt < now, link: `/nhu-cau/${l.id}` })),
  ];
  items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  return { items, overdue: items.filter((i) => i.overdue).length };
}

export async function listNotifications(user: SessionUser, take = 20) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { unread, rows: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt.toISOString() })) };
}

/** Đánh dấu đã đọc (một hoặc tất cả) — chỉ thông báo của chính mình. */
export async function markNotificationsRead(user: SessionUser, id?: string, now = new Date()) {
  const r = await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: now } });
  return r.count;
}

// ---- Job worker (chạy với workspaceDb của từng team) ----

/** Giao các lead mở còn chưa có người (tạo lúc phân công lỗi, nhóm hết chỗ, Sales mới vào nhóm…). */
export async function assignPendingLeads(client: Db, now = new Date(), limit = 200) {
  const pending = await client.lead.findMany({ where: { ownerId: null, stage: { in: [...OPEN_STAGES] } }, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit });
  let assigned = 0;
  for (const l of pending) if (await autoAssign(client, l.id, now)) assigned++;
  return { pending: pending.length, assigned };
}

/** Nhắc việc sắp đến hạn (≤ 30 phút) và lead quá hạn phản hồi. Thông báo trong app + email vào Outbox (SIMULATED). Không nhắc lại. */
export async function remindDue(client: Db, now = new Date()) {
  const soon = new Date(now.getTime() + 30 * 60000);
  const tasks = await client.task.findMany({ where: { status: "OPEN", remindedAt: null, dueAt: { lte: soon } }, include: { assignee: { select: { email: true } } }, take: 500 });
  for (const t of tasks) {
    await notify(client, { userId: t.assigneeId, title: `Đến hạn: ${t.title}`, body: `Hạn ${t.dueAt.toISOString()}`, link: t.leadId ? `/nhu-cau/${t.leadId}` : "/nhiem-vu", key: `task-due:${t.id}` });
    await enqueueOutbox(client, { channel: "EMAIL", recipient: t.assignee.email, subject: `Nhắc việc: ${t.title}`, body: `Việc "${t.title}" đến hạn lúc ${t.dueAt.toISOString()}.`, entity: "Task", entityId: t.id, key: `task-due:${t.id}` });
    await client.task.update({ where: { id: t.id }, data: { remindedAt: now } });
  }
  const late = await client.lead.findMany({ where: { stage: { in: [...OPEN_STAGES] }, firstRespondedAt: null, firstResponseDueAt: { lt: now }, ownerId: { not: null } }, take: 500 });
  let leadAlerts = 0;
  for (const l of late) {
    const to = [l.ownerId!, ...(l.teamId ? (await client.membership.findMany({ where: { teamId: l.teamId, active: true, roles: { has: "SALES_LEAD" } }, select: { userId: true } })).map((m) => m.userId) : [])];
    for (const u of new Set(to)) if (await notify(client, { userId: u, title: `Quá hạn phản hồi: ${l.contactName}`, link: `/nhu-cau/${l.id}`, key: `lead-overdue:${l.id}:${u}` })) leadAlerts++;
  }
  return { taskReminders: tasks.length, leadAlerts };
}

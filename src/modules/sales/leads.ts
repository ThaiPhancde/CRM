// Nhu cầu mua (Lead): tạo, danh sách/kanban, chi tiết, đổi giai đoạn, ghi tương tác, chuyển phụ trách, nhận lead.
// Mọi hàm kiểm quyền + phạm vi ở server (scope.ts); ghi audit; thao tác lặp có khóa idempotency.
import { Prisma, type LeadStage } from "@prisma/client";
import { z } from "zod";
import { bindTenant, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { normalizeEmail, normalizePhone } from "@/lib/phone";
import { piiFor } from "@/lib/pii";
import { requirePerm, type SessionUser } from "@/lib/session";
import { OPEN_STAGES, autoAssign, loadRouting } from "./routing";
import { assigneeWhere, leadAssignWhere, leadEditWhere, leadViewWhere } from "./scope";

import { LANGUAGES, LEAD_STAGES, STAGE_LABEL } from "./labels";

export { LANGUAGES, LEAD_STAGES, STAGE_LABEL };
/** Đóng không thành đơn → bắt buộc lý do (HLD §6 "lý do chưa mua"). */
const NEED_REASON: LeadStage[] = ["TU_CHOI", "MAT_LIEN_LAC"];
const CLOSED: LeadStage[] = ["DA_MUA", "TU_CHOI", "MAT_LIEN_LAC"];
export const LEAD_PAGE_SIZE = 50;

const opt = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`).optional().transform((v) => v || undefined);
const optId = z.string().trim().optional().transform((v) => v || undefined);
const optDate = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Ngày giờ không hợp lệ" });
    return z.NEVER;
  }
  return d;
});

export const createLeadSchema = z.object({
  contactName: z.string().trim().min(1, "Bắt buộc").max(120, "Tối đa 120 ký tự"),
  phone: opt(40),
  email: opt(200),
  language: z.enum(LANGUAGES).optional().or(z.literal("").transform(() => undefined)),
  source: z.string().trim().min(1, "Bắt buộc").max(60, "Tối đa 60 ký tự"),
  brandId: optId,
  marketId: optId,
  interest: opt(500),
  budgetAmount: z.string().trim().optional().transform((v) => v || undefined).refine((v) => !v || /^\d+(\.\d{1,4})?$/.test(v), "Số tiền không hợp lệ"),
  budgetCurrency: z.string().trim().toUpperCase().optional().transform((v) => v || undefined).refine((v) => !v || /^[A-Z]{3}$/.test(v), "Mã tiền tệ 3 chữ"),
  note: opt(2000),
  idempotencyKey: opt(120),
});

/** Tạo lead. Sales tự tạo thì tự nhận; vai khác → phân công tự động theo nhóm. Gửi lại cùng khóa → trả lead đã có. */
export async function createLead(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "lead.edit");
  const d = parse(createLeadSchema, input);
  if (!d.phone && !d.email) throw new ValidationError({ phone: "Cần SĐT hoặc email để liên hệ" });
  if (d.budgetAmount && !d.budgetCurrency) throw new ValidationError({ budgetCurrency: "Nhập tiền tệ của ngân sách" });
  const [brand, market] = await Promise.all([
    d.brandId ? db.brand.findFirst({ where: { id: d.brandId } }) : null,
    d.marketId ? db.market.findFirst({ where: { id: d.marketId } }) : null,
  ]);
  if (d.brandId && !brand) throw new ValidationError({ brandId: "Brand không thuộc team này" });
  if (d.marketId && !market) throw new ValidationError({ marketId: "Thị trường không thuộc team này" });
  const phone = d.phone ? normalizePhone(d.phone, market?.code) : null;
  if (d.phone && !phone) throw new ValidationError({ phone: "SĐT không hợp lệ (thêm mã quốc gia, ví dụ +971…)" });
  const email = normalizeEmail(d.email);

  if (d.idempotencyKey) {
    const prev = await db.lead.findFirst({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true } });
    if (prev) return { id: prev.id, replayed: true, merged: false };
  }
  // Chống lead trùng (D-49): còn lead mở cùng SĐT/email + cùng brand, có tương tác trong `dedupeDays` ngày → ghi vào lead cũ.
  const routing = await loadRouting(db);
  if (routing.dedupeDays && (phone || email)) {
    const dup = await db.lead.findFirst({
      where: {
        stage: { in: [...OPEN_STAGES] }, brandId: brand?.id ?? null, lastActivityAt: { gte: new Date(now.getTime() - routing.dedupeDays * 86400000) },
        OR: [...(phone ? [{ contactPhoneE164: phone.e164 }] : []), ...(email ? [{ contactEmail: email }] : [])],
      },
      orderBy: { lastActivityAt: "desc" },
    });
    if (dup) {
      if (d.idempotencyKey && (await db.activity.findFirst({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true } }))) return { id: dup.id, replayed: true, merged: true };
      const body = d.note ?? `Khách liên hệ lại qua ${d.source}${d.interest ? `: ${d.interest}` : ""}`;
      await db.$transaction(async (tx) => {
        await tx.activity.create({ data: { type: "MESSAGE", direction: "IN", channel: d.source, leadId: dup.id, customerId: dup.customerId, actorId: user.id, body, occurredAt: now, idempotencyKey: d.idempotencyKey } as never });
        await tx.lead.update({ where: { id: dup.id }, data: { lastActivityAt: now } });
        await audit(tx, { actorId: user.id, entity: "Lead", entityId: dup.id, action: "dedupe", after: { source: d.source, contactName: d.contactName } });
      });
      if (dup.ownerId && dup.ownerId !== user.id)
        await notify(db, { userId: dup.ownerId, title: `Khách liên hệ lại: ${dup.contactName}`, body, link: `/nhu-cau/${dup.id}`, key: `lead-again:${dup.id}:${Math.floor(now.getTime() / 3600000)}` });
      return { id: dup.id, replayed: false, merged: true };
    }
  }
  // Gắn hồ sơ khách chỉ khi SĐT E.164 khớp đúng một khách (bằng chứng D-08); không khớp/nhiều khớp → để trống.
  const matches = phone ? await db.customer.findMany({ where: { mergedIntoId: null, OR: [{ primaryPhoneE164: phone.e164 }, { identities: { some: { phoneE164: phone.e164 } } }] }, select: { id: true }, take: 2 }) : [];
  const selfOwn = user.roles.includes("SALES") && !user.roles.some((r) => r === "MANAGER" || r === "SALES_LEAD");

  let lead;
  try {
    lead = await db.$transaction(async (tx) => {
      const l = await tx.lead.create({
        data: {
          contactName: d.contactName, contactPhoneE164: phone?.e164, contactEmail: email ?? undefined, language: d.language, source: d.source,
          brandId: brand?.id, marketId: market?.id, interest: d.interest, budgetAmount: d.budgetAmount, budgetCurrency: d.budgetCurrency,
          customerId: matches.length === 1 ? matches[0].id : null, idempotencyKey: d.idempotencyKey, createdById: user.id, createdAt: now, lastActivityAt: now,
          ...(selfOwn ? { ownerId: user.id, teamId: user.teamId } : {}),
        } as Prisma.LeadUncheckedCreateInput,
      });
      if (selfOwn) await tx.assignment.create({ data: { leadId: l.id, toUserId: user.id, teamId: user.teamId, reason: "Người tạo tự nhận", byId: user.id } as never });
      if (d.note) await tx.activity.create({ data: { type: "NOTE", leadId: l.id, customerId: l.customerId, actorId: user.id, body: d.note, occurredAt: now } as never });
      await audit(tx, { actorId: user.id, entity: "Lead", entityId: l.id, action: "create", after: l });
      return l;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && d.idempotencyKey) {
      const prev = await db.lead.findFirstOrThrow({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true } });
      return { id: prev.id, replayed: true, merged: false };
    }
    throw e;
  }
  // Ngoài transaction: phân công lỗi thì lead vẫn còn, worker giao lại (assignPendingLeads).
  if (selfOwn) await db.lead.update({ where: { id: lead.id }, data: { firstResponseDueAt: new Date(lead.createdAt.getTime() + routing.firstResponseHours * 3600000) } });
  else await autoAssign(db, lead.id, now);
  return { id: lead.id, replayed: false, merged: false };
}

export const leadFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  stage: z.enum(LEAD_STAGES).optional().catch(undefined),
  /** "me" | "none" | userId */
  owner: z.string().trim().max(40).optional().catch(undefined),
  brand: z.string().trim().max(40).optional().catch(undefined),
  market: z.string().trim().max(40).optional().catch(undefined),
  overdue: z.coerce.boolean().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type LeadFilter = z.infer<typeof leadFilterSchema>;

export function parseLeadFilter(sp: Record<string, string | string[] | undefined>): LeadFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return leadFilterSchema.parse({ q: one("q"), stage: one("stage"), owner: one("owner"), brand: one("brand"), market: one("market"), overdue: one("overdue") ? "1" : undefined, page: one("page") });
}

function leadWhere(user: SessionUser, f: LeadFilter, now: Date): Prisma.LeadWhereInput {
  const pii = piiFor(user);
  const and: Prisma.LeadWhereInput[] = [leadViewWhere(user)];
  if (f.stage) and.push({ stage: f.stage });
  if (f.owner === "me") and.push({ ownerId: user.id });
  else if (f.owner === "none") and.push({ ownerId: null });
  else if (f.owner) and.push({ ownerId: f.owner });
  if (f.brand) and.push({ brandId: f.brand });
  if (f.market) and.push({ marketId: f.market });
  if (f.overdue) and.push({ firstRespondedAt: null, firstResponseDueAt: { lt: now }, stage: { in: [...OPEN_STAGES] } });
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    and.push({ OR: [
      { contactName: { contains: f.q, mode: "insensitive" } },
      { interest: { contains: f.q, mode: "insensitive" } },
      ...(pii.full && digits.length >= 4 ? [{ contactPhoneE164: { contains: digits } }] : []),
      ...(pii.full && f.q.includes("@") ? [{ contactEmail: { contains: f.q.toLowerCase() } }] : []),
    ] });
  }
  return { AND: and };
}

const listInclude = {
  owner: { select: { id: true, name: true } }, team: { select: { name: true } },
  brand: { select: { code: true, name: true } }, market: { select: { code: true, name: true } },
} satisfies Prisma.LeadInclude;

type LeadRow = Prisma.LeadGetPayload<{ include: typeof listInclude }>;

function toRow(user: SessionUser, l: LeadRow, now: Date) {
  const pii = piiFor(user);
  const open = (OPEN_STAGES as readonly string[]).includes(l.stage);
  return {
    id: l.id, contactName: l.contactName, phone: pii.phone(l.contactPhoneE164), email: pii.email(l.contactEmail), language: l.language,
    source: l.source, interest: l.interest, budget: l.budgetAmount ? { amount: l.budgetAmount.toString(), currency: l.budgetCurrency } : null,
    stage: l.stage, lostReason: l.lostReason, customerId: l.customerId,
    owner: l.owner, team: l.team?.name ?? null, brand: l.brand, market: l.market,
    firstResponseDueAt: l.firstResponseDueAt?.toISOString() ?? null, firstRespondedAt: l.firstRespondedAt?.toISOString() ?? null,
    nextActionAt: l.nextActionAt?.toISOString() ?? null, createdAt: l.createdAt.toISOString(),
    /** Quá hạn phản hồi đầu tiên. */
    overdue: open && !l.firstRespondedAt && !!l.firstResponseDueAt && l.firstResponseDueAt < now,
  };
}
export type LeadListRow = ReturnType<typeof toRow>;

export async function listLeads(user: SessionUser, f: LeadFilter, now = new Date()) {
  requirePerm(user, "lead.view");
  const w = leadWhere(user, f, now);
  const [total, rows] = await Promise.all([
    db.lead.count({ where: w }),
    db.lead.findMany({ where: w, include: listInclude, orderBy: [{ createdAt: "desc" }], skip: (f.page - 1) * LEAD_PAGE_SIZE, take: LEAD_PAGE_SIZE }),
  ]);
  return { total, page: f.page, pageSize: LEAD_PAGE_SIZE, rows: rows.map((l) => toRow(user, l, now)), canEdit: can(user.roles, "lead.edit"), canAssign: can(user.roles, "lead.assign") };
}

/**
 * Kanban "pipeline" (D-49): chỉ giai đoạn MỞ có thẻ (tối đa `perStage`, kèm tổng để hiện "còn N"); giai đoạn ĐÓNG chỉ trả số đóng trong
 * 30 ngày qua — là ô thả để đóng lead, không tải thẻ (lead đóng tích lũy mãi, hiện thành thẻ chỉ làm chậm và rối). Cùng bộ lọc với danh sách.
 */
export async function leadBoard(user: SessionUser, f: LeadFilter, now = new Date(), perStage = 50) {
  requirePerm(user, "lead.view");
  const since = new Date(now.getTime() - 30 * 86400000);
  const columns = await Promise.all(LEAD_STAGES.map(async (stage) => {
    const closed = CLOSED.includes(stage);
    const w = leadWhere(user, { ...f, stage }, now);
    if (closed) return { stage, closed, total: await db.lead.count({ where: { AND: [w, { closedAt: { gte: since } }] } }), rows: [] as LeadListRow[] };
    const [total, rows] = await Promise.all([
      db.lead.count({ where: w }),
      db.lead.findMany({ where: w, include: listInclude, orderBy: [{ updatedAt: "desc" }], take: perStage }),
    ]);
    return { stage, closed, total, rows: rows.map((l) => toRow(user, l, now)) };
  }));
  return { columns, canEdit: can(user.roles, "lead.edit") };
}

export async function getLead(user: SessionUser, id: string, now = new Date()) {
  requirePerm(user, "lead.view");
  const l = await db.lead.findFirst({
    where: { AND: [{ id }, leadViewWhere(user)] },
    include: {
      ...listInclude,
      customer: { select: { id: true, displayName: true, orderCount: true, lastOrderAt: true } },
      activities: { orderBy: { occurredAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } },
      assignments: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueAt: "asc" }, include: { assignee: { select: { name: true } } } },
    },
  });
  if (!l) throw new HttpError(404, "Không tìm thấy nhu cầu mua");
  const userIds = [...new Set(l.assignments.flatMap((a) => [a.fromUserId, a.toUserId, a.byId]).filter(Boolean) as string[])];
  const names = new Map((await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const [editable, assignable] = await Promise.all([
    can(user.roles, "lead.edit") ? db.lead.count({ where: { AND: [{ id }, leadEditWhere(user)] } }) : 0,
    can(user.roles, "lead.assign") ? db.lead.count({ where: { AND: [{ id }, leadAssignWhere(user)] } }) : 0,
  ]);
  const scripts = await listScripts(user, { brandId: l.brandId, marketId: l.marketId, stage: l.stage, language: l.language });
  return {
    ...toRow(user, l, now),
    customer: l.customer ? { ...l.customer, lastOrderAt: l.customer.lastOrderAt?.toISOString() ?? null } : null,
    activities: l.activities.map((a) => ({ id: a.id, type: a.type, direction: a.direction, channel: a.channel, body: a.body, outcome: a.outcome, durationSec: a.durationSec, language: a.language, occurredAt: a.occurredAt.toISOString(), actor: a.actor?.name ?? null })),
    assignments: l.assignments.map((a) => ({ id: a.id, from: a.fromUserId ? names.get(a.fromUserId) ?? null : null, to: a.toUserId ? names.get(a.toUserId) ?? null : null, by: a.byId ? names.get(a.byId) ?? null : null, reason: a.reason, at: a.createdAt.toISOString() })),
    tasks: l.tasks.map((t) => ({ id: t.id, type: t.type, title: t.title, dueAt: t.dueAt.toISOString(), status: t.status, assignee: t.assignee.name })),
    scripts,
    canEdit: editable > 0,
    canAssign: assignable > 0,
    /** Sales nhận lead chưa giao của nhóm. */
    canClaim: editable > 0 && !l.ownerId && user.roles.includes("SALES"),
  };
}
export type LeadDetail = Awaited<ReturnType<typeof getLead>>;

async function editableLead(user: SessionUser, id: string) {
  requirePerm(user, "lead.edit");
  const l = await db.lead.findFirst({ where: { AND: [{ id }, leadEditWhere(user)] } });
  if (!l) throw new HttpError(404, "Không tìm thấy nhu cầu mua hoặc bạn không phụ trách");
  return l;
}

export const stageSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(LEAD_STAGES, { message: "Chọn giai đoạn" }),
  lostReason: opt(500),
  nextActionAt: optDate,
});

/** Đổi giai đoạn (kanban kéo thả gọi hàm này). Từ chối/mất liên lạc cần lý do. */
export async function changeStage(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(stageSchema, input);
  const l = await editableLead(user, d.id);
  if (NEED_REASON.includes(d.stage) && !d.lostReason) throw new ValidationError({ lostReason: "Nhập lý do khi chuyển sang Từ chối / Mất liên lạc" });
  if (l.stage === d.stage && !d.nextActionAt) return l;
  return db.$transaction(async (tx) => {
    const after = await tx.lead.update({
      where: { id: l.id },
      data: {
        stage: d.stage, lostReason: NEED_REASON.includes(d.stage) ? d.lostReason : null,
        closedAt: CLOSED.includes(d.stage) ? (l.closedAt ?? now) : null,
        ...(CLOSED.includes(l.stage) && !CLOSED.includes(d.stage) ? { lastActivityAt: now } : {}),
        ...(d.nextActionAt ? { nextActionAt: d.nextActionAt } : {}),
      },
    });
    if (l.stage !== d.stage) {
      await tx.activity.create({ data: { type: "SYSTEM", leadId: l.id, customerId: l.customerId, actorId: user.id, body: `Chuyển giai đoạn: ${STAGE_LABEL[l.stage]} → ${STAGE_LABEL[d.stage]}${d.lostReason ? ` (${d.lostReason})` : ""}`, occurredAt: now } as never });
    }
    await audit(tx, { actorId: user.id, entity: "Lead", entityId: l.id, action: "stage", before: { stage: l.stage }, after: { stage: d.stage, lostReason: d.lostReason, nextActionAt: d.nextActionAt } });
    return after;
  });
}

export const activitySchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(["CALL", "MESSAGE", "MEETING", "NOTE"], { message: "Chọn loại tương tác" }),
  direction: z.enum(["IN", "OUT"]).optional().or(z.literal("").transform(() => undefined)),
  channel: opt(30),
  body: z.string().trim().min(1, "Bắt buộc").max(4000, "Tối đa 4000 ký tự"),
  outcome: opt(200),
  durationSec: z.coerce.number().int().min(0).max(86400).optional().or(z.literal("").transform(() => undefined)),
  occurredAt: optDate,
  idempotencyKey: opt(120),
});

/** Ghi tương tác. Lần liên hệ ra đầu tiên (gọi/hẹn/nhắn đi) ghi nhận đã phản hồi và chuyển Mới → Đang tư vấn. */
export async function logActivity(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(activitySchema, input);
  const l = await editableLead(user, d.leadId);
  const outbound = d.type === "CALL" || d.type === "MEETING" || (d.type === "MESSAGE" && d.direction === "OUT");
  try {
    return await db.$transaction(async (tx) => {
      const a = await tx.activity.create({
        data: { type: d.type, direction: d.direction ?? (outbound ? "OUT" : undefined), channel: d.channel, leadId: l.id, customerId: l.customerId, actorId: user.id, body: d.body, outcome: d.outcome, durationSec: d.durationSec, occurredAt: d.occurredAt ?? now, idempotencyKey: d.idempotencyKey } as never,
      });
      await tx.lead.update({
        where: { id: l.id },
        data: { lastActivityAt: now, ...(outbound && !l.firstRespondedAt ? { firstRespondedAt: now, ...(l.stage === "MOI" ? { stage: "DANG_TU_VAN" as const } : {}) } : {}) },
      });
      return a;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && d.idempotencyKey) return db.activity.findFirstOrThrow({ where: { idempotencyKey: d.idempotencyKey } });
    throw e;
  }
}

export const reassignSchema = z.object({
  id: z.string().min(1),
  toUserId: z.string().min(1, "Chọn người nhận"),
  reason: z.string().trim().min(3, "Nhập lý do chuyển (tối thiểu 3 ký tự)").max(300, "Tối đa 300 ký tự"),
});

/** Chuyển phụ trách: ghi Assignment (chỉ thêm), dòng thời gian, audit, báo người nhận. */
export async function reassignLead(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "lead.assign");
  const d = parse(reassignSchema, input);
  const l = await db.lead.findFirst({ where: { AND: [{ id: d.id }, leadAssignWhere(user)] } });
  if (!l) throw new HttpError(404, "Không tìm thấy nhu cầu mua trong phạm vi bạn được chuyển");
  return transfer(user, l, d.toUserId, d.reason, now);
}

/** Sales nhận lead chưa giao của nhóm mình. */
export async function claimLead(user: SessionUser, id: string, now = new Date()) {
  const l = await editableLead(user, id);
  if (l.ownerId) throw new HttpError(409, "Lead đã có người phụ trách");
  return transfer(user, l, user.id, "Tự nhận từ hàng chờ của nhóm", now);
}

async function transfer(user: SessionUser, l: { id: string; ownerId: string | null; customerId: string | null; contactName: string }, toUserId: string, reason: string, now: Date) {
  if (l.ownerId === toUserId) throw new ValidationError({ toUserId: "Người này đang phụ trách" });
  const target = await db.membership.findFirst({ where: { AND: [{ userId: toUserId }, assigneeWhere(user)], roles: { hasSome: ["SALES", "SALES_LEAD", "MANAGER"] } }, include: { user: { select: { name: true } } } });
  if (!target) throw new ValidationError({ toUserId: "Người nhận không thuộc phạm vi bạn được giao" });
  const res = await db.$transaction(async (tx) => {
    const after = await tx.lead.update({ where: { id: l.id }, data: { ownerId: toUserId, ...(target.teamId ? { teamId: target.teamId } : {}) } });
    await tx.assignment.create({ data: { leadId: l.id, fromUserId: l.ownerId, toUserId, teamId: target.teamId, reason, byId: user.id } as never });
    await tx.activity.create({ data: { type: "SYSTEM", leadId: l.id, customerId: l.customerId, actorId: user.id, body: `Chuyển phụ trách cho ${target.user.name}: ${reason}`, occurredAt: now } as never });
    await audit(tx, { actorId: user.id, entity: "Lead", entityId: l.id, action: "assign", before: { ownerId: l.ownerId }, after: { ownerId: toUserId }, reason });
    return after;
  });
  if (toUserId !== user.id) await notify(db, { userId: toUserId, title: `Bạn được giao lead: ${l.contactName}`, body: reason, link: `/nhu-cau/${l.id}`, key: `lead-assigned:${l.id}:${toUserId}:${now.getTime()}` });
  return res;
}

export const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Chọn ít nhất một lead").max(200, "Tối đa 200 lead mỗi lần"),
  action: z.enum(["assign", "stage"], { message: "Chọn thao tác" }),
  toUserId: z.string().optional().transform((v) => v || undefined),
  stage: z.enum(LEAD_STAGES).optional().or(z.literal("").transform(() => undefined)),
  lostReason: z.string().trim().max(500).optional().transform((v) => v || undefined),
  reason: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

/**
 * Thao tác hàng loạt trên danh sách (D-49): chuyển phụ trách hoặc đổi giai đoạn tối đa 200 lead. Mỗi lead đi qua đúng hàm đơn lẻ
 * (quyền, phạm vi, lý do, lịch sử, audit) — lead nào lỗi thì bỏ qua và đếm, không làm hỏng cả lô.
 */
export async function bulkLeads(user: SessionUser, input: unknown, now = new Date()) {
  const d = parse(bulkSchema, input);
  if (d.action === "assign") {
    requirePerm(user, "lead.assign");
    if (!d.toUserId) throw new ValidationError({ toUserId: "Chọn người nhận" });
    if (!d.reason || d.reason.length < 3) throw new ValidationError({ reason: "Nhập lý do chuyển (tối thiểu 3 ký tự)" });
  } else {
    requirePerm(user, "lead.edit");
    if (!d.stage) throw new ValidationError({ stage: "Chọn giai đoạn" });
    if (NEED_REASON.includes(d.stage) && !d.lostReason) throw new ValidationError({ lostReason: "Nhập lý do khi chuyển sang Từ chối / Mất liên lạc" });
  }
  let done = 0;
  const failed: string[] = [];
  for (const id of [...new Set(d.ids)]) {
    try {
      if (d.action === "assign") await reassignLead(user, { id, toUserId: d.toUserId, reason: d.reason }, now);
      else await changeStage(user, { id, stage: d.stage, lostReason: d.lostReason }, now);
      done++;
    } catch {
      failed.push(id);
    }
  }
  return { done, failed };
}

/** Người có thể nhận lead/việc từ người dùng hiện tại (cho ô chọn ở drawer chuyển phụ trách / form việc). */
export async function assignableUsers(user: SessionUser) {
  bindTenant(user);
  const ms = await db.membership.findMany({ where: { AND: [assigneeWhere(user)], user: { active: true } }, include: { user: { select: { id: true, name: true } }, team: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
  return ms.map((m) => ({ id: m.user.id, name: m.user.name, team: m.team?.name ?? null, roles: m.roles }));
}

/** Kịch bản khớp brand/market/giai đoạn/ngôn ngữ; trường để trống ở kịch bản = áp mọi giá trị. Cụ thể hơn xếp trước. */
export async function listScripts(user: SessionUser, f: { brandId?: string | null; marketId?: string | null; stage?: LeadStage | null; language?: string | null }) {
  requirePerm(user, "lead.view");
  const rows = await db.script.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ brandId: null }, ...(f.brandId ? [{ brandId: f.brandId }] : [])] },
        { OR: [{ marketId: null }, ...(f.marketId ? [{ marketId: f.marketId }] : [])] },
        { OR: [{ stage: null }, ...(f.stage ? [{ stage: f.stage }] : [])] },
        ...(f.language ? [{ language: f.language }] : []),
      ],
    },
    take: 50,
  });
  const score = (s: (typeof rows)[number]) => Number(!!s.brandId) + Number(!!s.marketId) + Number(!!s.stage);
  return rows.sort((a, b) => score(b) - score(a)).slice(0, 10).map((s) => ({ id: s.id, title: s.title, body: s.body, language: s.language, stage: s.stage }));
}

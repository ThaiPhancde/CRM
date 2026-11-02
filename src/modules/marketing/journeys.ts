// Hành trình chăm sóc (Phase 7, HLD §8.5): đưa khách trong phân khúc vào, chạy các bước tuyến tính theo lô, kiểm điều kiện ra trước mỗi bước.
// An toàn: gửi tin chỉ vào Outbox (SIMULATED khi EXTERNAL_WRITES_ENABLED≠true — D-13); mỗi (lượt, bước) có một dòng nhật ký duy nhất →
// chạy lại không gửi/tạo việc trùng; giới hạn liên hệ xuyên hành trình/chiến dịch (ContactCap + ContactLog); quyền nhận tin; giờ địa phương.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, type JourneyStatus } from "@prisma/client";
import { z } from "zod";
import { getInventory } from "@/adapters/inventory";
import { bindTenant, db, type Db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { enqueueOutbox } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";
import { groupSchema, segmentWhere, type Group } from "./segments";

const DAY = 86400000;

// ---- Định nghĩa bước ----

export const stepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("WAIT"), days: z.coerce.number().min(0, "≥ 0").max(365, "≤ 365") }),
  z.object({ type: z.literal("CONDITION"), label: z.string().trim().min(1).max(120), rules: groupSchema }),
  z.object({ type: z.literal("STOCK_CHECK") }),
  z.object({ type: z.literal("SEND"), channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]), template: z.string().trim().min(1).max(60) }),
  z.object({ type: z.literal("TASK"), title: z.string().trim().min(3).max(200), dueDays: z.coerce.number().int().min(0).max(60) }),
  z.object({ type: z.literal("TAG"), tag: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal("EXIT") }),
]);
export type Step = z.infer<typeof stepSchema>;
export const exitRulesSchema = z.object({ purchased: z.boolean().default(true), optOut: z.boolean().default(true), openTicket: z.boolean().default(true), expireDays: z.coerce.number().int().min(1).max(365).default(30) });
export type ExitRules = z.infer<typeof exitRulesSchema>;

export const STEP_LABEL: Record<Step["type"], string> = { WAIT: "Chờ", CONDITION: "Điều kiện", STOCK_CHECK: "Kiểm tồn", SEND: "Gửi tin", TASK: "Tạo việc", TAG: "Gán thẻ", EXIT: "Thoát" };

// ---- Quy tắc liên hệ (D-55) ----

/** Thị trường bắt buộc khách đồng ý trước khi nhận tin marketing (GDPR — EU). Thị trường khác: được gửi trừ khi khách đã từ chối. */
export const OPT_IN_MARKETS = ["DE", "FR"];
/** Khung giờ được gửi theo giờ địa phương của thị trường khách. */
export const QUIET = { from: 9, to: 20 };
/** Giới hạn mặc định khi team chưa cấu hình ContactCap (Q-24): 2 tin / 7 ngày / kênh. */
export const DEFAULT_CAP = { maxCount: 2, windowDays: 7 };

const localHour = (at: Date, tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(at));
/** Thời điểm gửi được gần nhất ≥ at theo giờ địa phương (dời tới 9:00 kế tiếp nếu đang ngoài khung). Hàm thuần — có test. */
export function nextSendable(at: Date, tz: string): Date {
  const h = localHour(at, tz);
  if (h >= QUIET.from && h < QUIET.to) return at;
  const t = new Date(at);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 26; i++) {
    t.setUTCHours(t.getUTCHours() + 1);
    if (localHour(t, tz) === QUIET.from) return t;
  }
  return at;
}

/** Mẫu tin theo khóa + ngôn ngữ (fixtures/message-templates.json; thiếu thì dùng câu mặc định). ponytail: mẫu trong file, Phase 11 chuyển vào Cấu hình. */
type Template = { key: string; language: string; subject?: string; body: string };
let templates: Template[] | null = null;
function render(key: string, language: string, vars: Record<string, string>) {
  if (!templates) {
    const f = path.join(process.cwd(), "fixtures", "message-templates.json");
    templates = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Template[]) : [];
  }
  const t = templates.find((x) => x.key === key && x.language === language) ?? templates.find((x) => x.key === key && x.language === "en") ?? { key, language, body: "Xin chào {{name}}, {{brand}} có ưu đãi dành cho bạn." };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
  return { subject: t.subject ? fill(t.subject) : undefined, body: fill(t.body), language: t.language };
}

// ---- Máy chạy ----

/** Đưa khách thỏa phân khúc vào hành trình đang bật (bỏ qua người đang chạy hoặc vừa ra trong reentryDays). Tối đa `limit` khách/lượt. */
export async function enrollJourney(client: Db, journeyId: string, now = new Date(), limit = 5000) {
  const j = await client.journey.findFirst({ where: { id: journeyId, status: "ACTIVE" }, include: { segment: true } });
  if (!j) return { enrolled: 0 };
  const since = new Date(now.getTime() - j.reentryDays * DAY);
  const where: Prisma.CustomerWhereInput = {
    AND: [segmentWhere(j.segment.rules as Group, { now, money: true }), { journeyRuns: { none: { journeyId, OR: [{ status: "RUNNING" }, { enteredAt: { gte: since } }, { exitedAt: { gte: since } }] } } }],
  };
  const ids = (await client.customer.findMany({ where, select: { id: true }, take: limit })).map((c) => c.id);
  const entryKey = now.toISOString().slice(0, 10);
  const r = await client.journeyRun.createMany({ data: ids.map((customerId) => ({ journeyId, customerId, entryKey, nextAt: now, enteredAt: now })) as never, skipDuplicates: true });
  return { enrolled: r.count };
}

type RunCtx = { client: Db; now: Date; caps: { channel: string; brandId: string | null; maxCount: number; windowDays: number }[] };

/** Lý do ra khỏi hành trình (kiểm trước mỗi bước) hoặc null. */
async function exitReason(c: Db, run: { customerId: string; enteredAt: Date }, rules: ExitRules, now: Date): Promise<string | null> {
  if (now.getTime() - run.enteredAt.getTime() > rules.expireDays * DAY) return `Hết hạn ${rules.expireDays} ngày`;
  if (rules.purchased && (await c.order.count({ where: { customerId: run.customerId, status: { not: "CANCELLED" }, bookedAt: { gt: run.enteredAt } } }))) return "Khách đã mua";
  if (rules.optOut) {
    const last = await c.contactPreference.findFirst({ where: { customerId: run.customerId, purpose: "MARKETING" }, orderBy: { changedAt: "desc" } });
    if (last && !last.optIn) return "Khách từ chối nhận tin";
  }
  if (rules.openTicket && (await c.ticket.count({ where: { customerId: run.customerId, status: { in: ["MOI", "DANG_XU_LY", "CHO_KHACH"] } } }))) return "Đang có khiếu nại cần xử lý";
  return null;
}

/** Chạy một lượt tới bước chờ / kết thúc / ra. Trả kết quả cuối để thống kê. */
async function advance(ctx: RunCtx, run: { id: string; journeyId: string; customerId: string; stepIndex: number; enteredAt: Date }, j: { steps: Step[]; exitRules: ExitRules; brandId: string | null; createdById: string | null; name: string }) {
  const { client: c, now } = ctx;
  let idx = run.stepIndex;
  const log = (stepType: string, outcome: string, detail?: string) => c.journeyStepLog.createMany({ data: [{ runId: run.id, stepIndex: idx, stepType, outcome, detail }] as never, skipDuplicates: true });
  const finish = (status: "COMPLETED" | "EXITED", reason?: string) => c.journeyRun.update({ where: { id: run.id }, data: { status, stepIndex: idx, exitedAt: now, exitReason: reason ?? null } });
  for (let guard = 0; guard < 50; guard++) {
    const reason = await exitReason(c, run, j.exitRules, now);
    if (reason) return finish("EXITED", reason).then(() => "EXITED");
    if (idx >= j.steps.length) return finish("COMPLETED").then(() => "COMPLETED");
    const step = j.steps[idx];
    // Bước đã có nhật ký = đã chạy (kể cả lượt trước bị ngắt) → bỏ qua, không làm lại.
    const done = await c.journeyStepLog.findUnique({ where: { runId_stepIndex: { runId: run.id, stepIndex: idx } } });
    if (done) { idx++; continue; }
    const cust = await c.customer.findUniqueOrThrow({ where: { id: run.customerId }, select: { displayName: true, primaryEmail: true, primaryPhoneE164: true, locale: true, tags: true, market: { select: { code: true, timezone: true, locale: true } } } });
    switch (step.type) {
      case "WAIT": {
        await log("WAIT", "WAITING", `Tới ${new Date(now.getTime() + step.days * DAY).toISOString()}`);
        await c.journeyRun.update({ where: { id: run.id }, data: { stepIndex: idx + 1, nextAt: new Date(now.getTime() + step.days * DAY) } });
        return "WAITING";
      }
      case "CONDITION": {
        const ok = await c.customer.count({ where: { AND: [{ id: run.customerId }, segmentWhere(step.rules as Group, { now, money: true })] } });
        await log("CONDITION", ok ? "PASSED" : "FAILED", step.label);
        if (!ok) { idx++; return finish("EXITED", `Không thỏa điều kiện: ${step.label}`).then(() => "EXITED"); }
        break;
      }
      case "STOCK_CHECK": {
        const item = await c.orderItem.findFirst({ where: { order: { customerId: run.customerId, status: { not: "CANCELLED" } }, qtyDelivered: { gt: 0 } }, orderBy: { order: { bookedAt: "desc" } }, select: { sourceSku: true, name: true } });
        const qty = item ? (await getInventory().available([item.sourceSku])).get(item.sourceSku) ?? 0 : 0;
        await log("STOCK_CHECK", qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK", item ? `${item.sourceSku}: ${qty}` : "Không xác định sản phẩm");
        if (qty <= 0) { idx++; return finish("EXITED", item ? `Hết hàng ${item.sourceSku}` : "Không xác định sản phẩm khách mua").then(() => "EXITED"); }
        break;
      }
      case "SEND": {
        const tz = cust.market?.timezone ?? "UTC";
        const when = nextSendable(now, tz);
        if (when > now) { await c.journeyRun.update({ where: { id: run.id }, data: { stepIndex: idx, nextAt: when } }); return "QUIET_HOURS"; }
        const recipient = step.channel === "EMAIL" ? cust.primaryEmail : cust.primaryPhoneE164;
        const prefChannel = step.channel === "WHATSAPP" ? "WHATSAPP" : step.channel;
        const pref = await c.contactPreference.findFirst({ where: { customerId: run.customerId, purpose: "MARKETING", channel: prefChannel as never }, orderBy: { changedAt: "desc" } });
        const needOptIn = OPT_IN_MARKETS.includes(cust.market?.code ?? "");
        const cap = ctx.caps.find((x) => x.channel === step.channel && x.brandId === j.brandId) ?? ctx.caps.find((x) => x.channel === step.channel && x.brandId === null) ?? { ...DEFAULT_CAP, channel: step.channel, brandId: null };
        const sent = await c.contactLog.count({ where: { customerId: run.customerId, channel: step.channel, createdAt: { gte: new Date(now.getTime() - cap.windowDays * DAY) }, ...(cap.brandId ? { brandId: cap.brandId } : {}) } });
        if (!recipient) await log("SEND", "SKIPPED_NO_RECIPIENT", `Thiếu ${step.channel === "EMAIL" ? "email" : "SĐT"}`);
        else if (pref ? !pref.optIn : needOptIn) await log("SEND", "SKIPPED_NO_CONSENT", needOptIn && !pref ? `Thị trường ${cust.market?.code} cần khách đồng ý trước` : "Khách đã từ chối kênh này");
        else if (sent >= cap.maxCount) await log("SEND", "SKIPPED_CAP", `Đã nhận ${sent}/${cap.maxCount} tin ${step.channel} trong ${cap.windowDays} ngày`);
        else {
          const brand = j.brandId ? (await c.brand.findFirst({ where: { id: j.brandId }, select: { name: true } }))?.name ?? "" : "";
          const lang = (cust.locale ?? cust.market?.locale ?? "en").slice(0, 2);
          const msg = render(step.template, lang, { name: cust.displayName, brand });
          await c.$transaction(async (tx) => {
            await enqueueOutbox(tx as never, { channel: step.channel, recipient, subject: msg.subject, body: msg.body, entity: "JourneyRun", entityId: run.id, key: `journey:${run.id}:${idx}` });
            await tx.contactLog.create({ data: { customerId: run.customerId, channel: step.channel, brandId: j.brandId, source: "journey", refId: run.id } as never });
            await tx.journeyStepLog.create({ data: { runId: run.id, stepIndex: idx, stepType: "SEND", outcome: "SENT", detail: `${step.template} (${msg.language}) → ${step.channel}` } as never });
          });
        }
        break;
      }
      case "TASK": {
        const lead = await c.lead.findFirst({ where: { customerId: run.customerId, ownerId: { not: null } }, orderBy: { createdAt: "desc" }, select: { ownerId: true } });
        const assigneeId = lead?.ownerId ?? j.createdById;
        if (!assigneeId) await log("TASK", "SKIPPED_NO_ASSIGNEE");
        else {
          await c.task.createMany({ data: [{ type: "FOLLOW_UP", title: step.title, note: `Từ hành trình "${j.name}"`, dueAt: new Date(now.getTime() + step.dueDays * DAY), assigneeId, customerId: run.customerId, idempotencyKey: `journey:${run.id}:${idx}` }] as never, skipDuplicates: true });
          await log("TASK", "TASK_CREATED", step.title);
        }
        break;
      }
      case "TAG": {
        if (!cust.tags.includes(step.tag)) await c.customer.update({ where: { id: run.customerId }, data: { tags: { push: step.tag } } });
        await log("TAG", "TAGGED", step.tag);
        break;
      }
      case "EXIT": {
        await log("EXIT", "EXITED");
        idx++;
        return finish("EXITED", "Kết thúc theo bước Thoát").then(() => "EXITED");
      }
    }
    idx++;
    await c.journeyRun.update({ where: { id: run.id }, data: { stepIndex: idx } });
  }
  return "GUARD";
}

/** Chạy các lượt đến hạn (nextAt ≤ now). ponytail: tuần tự ~vài truy vấn/lượt, 500 lượt/vòng; gom theo lô khi hành trình > ~50k khách/ngày. */
export async function processDueRuns(client: Db, now = new Date(), limit = 500) {
  const runs = await client.journeyRun.findMany({ where: { status: "RUNNING", nextAt: { lte: now }, journey: { status: "ACTIVE" } }, orderBy: { nextAt: "asc" }, take: limit });
  if (!runs.length) return { processed: 0, outcomes: {} as Record<string, number> };
  const journeys = new Map((await client.journey.findMany({ where: { id: { in: [...new Set(runs.map((r) => r.journeyId))] } } })).map((j) => [j.id, { ...j, steps: j.steps as Step[], exitRules: exitRulesSchema.parse(j.exitRules) }]));
  const caps = await client.contactCap.findMany();
  const outcomes: Record<string, number> = {};
  for (const r of runs) {
    const o = await advance({ client, now, caps }, r, journeys.get(r.journeyId)!);
    outcomes[o] = (outcomes[o] ?? 0) + 1;
  }
  return { processed: runs.length, outcomes };
}

/** Job worker: với mỗi hành trình đang bật — đưa khách mới vào rồi chạy các lượt đến hạn. */
export async function journeyJobs(client: Db, now = new Date()) {
  const active = await client.journey.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  let enrolled = 0;
  for (const j of active) enrolled += (await enrollJourney(client, j.id, now)).enrolled;
  const due = await processDueRuns(client, now);
  return { enrolled, ...due };
}

// ---- Service cho giao diện ----

export const saveJourneySchema = z.object({
  id: z.string().optional().transform((v) => v || undefined),
  name: z.string().trim().min(2, "Nhập tên").max(120),
  description: z.string().trim().max(500).optional().transform((v) => v || undefined),
  segmentId: z.string().min(1, "Chọn phân khúc"),
  brandId: z.string().optional().transform((v) => v || undefined),
  steps: z.array(stepSchema).min(1, "Cần ít nhất một bước").max(20, "Tối đa 20 bước"),
  exitRules: exitRulesSchema,
  reentryDays: z.coerce.number().int().min(1).max(365).default(30),
});

/** Lưu hành trình. Đang bật thì không sửa bước (phải tạm dừng) — tránh khách đang chạy nhảy sai bước. */
export async function saveJourney(user: SessionUser, input: unknown) {
  requirePerm(user, "journey.manage");
  const d = parse(saveJourneySchema, input);
  if (!(await db.segment.findFirst({ where: { id: d.segmentId } }))) throw new ValidationError({ segmentId: "Phân khúc không thuộc team này" });
  if (!d.steps.some((s) => s.type === "SEND" || s.type === "TASK")) throw new ValidationError({ steps: "Cần ít nhất một bước Gửi tin hoặc Tạo việc" });
  return db.$transaction(async (tx) => {
    const before = d.id ? await tx.journey.findFirst({ where: { id: d.id } }) : null;
    if (d.id && !before) throw new HttpError(404, "Không tìm thấy hành trình");
    if (before?.status === "ACTIVE") throw new ValidationError({ steps: "Tạm dừng hành trình trước khi sửa" });
    const data = { name: d.name, description: d.description ?? null, segmentId: d.segmentId, brandId: d.brandId ?? null, steps: d.steps as Prisma.InputJsonValue, exitRules: d.exitRules as Prisma.InputJsonValue, reentryDays: d.reentryDays };
    const j = before ? await tx.journey.update({ where: { id: before.id }, data }) : await tx.journey.create({ data: { ...data, createdById: user.id } as never });
    await audit(tx, { actorId: user.id, entity: "Journey", entityId: j.id, action: before ? "update" : "create", before: before ? { steps: before.steps, exitRules: before.exitRules } : undefined, after: { steps: j.steps, exitRules: j.exitRules } });
    return j;
  });
}

/** Bật cần journey.activate (Quản lý); tạm dừng/nháp cần journey.manage. */
export async function setJourneyStatus(user: SessionUser, id: string, status: JourneyStatus, now = new Date()) {
  requirePerm(user, status === "ACTIVE" ? "journey.activate" : "journey.manage");
  const j = await db.journey.findFirst({ where: { id } });
  if (!j) throw new HttpError(404, "Không tìm thấy hành trình");
  return db.$transaction(async (tx) => {
    const after = await tx.journey.update({ where: { id }, data: { status, ...(status === "ACTIVE" ? { activatedById: user.id, activatedAt: now } : {}) } });
    await audit(tx, { actorId: user.id, entity: "Journey", entityId: id, action: "status", before: { status: j.status }, after: { status } });
    return after;
  });
}

export async function listJourneys(user: SessionUser) {
  requirePerm(user, "journey.manage");
  const [rows, counts] = await Promise.all([
    db.journey.findMany({ orderBy: { updatedAt: "desc" }, include: { segment: { select: { id: true, name: true } } } }),
    db.journeyRun.groupBy({ by: ["journeyId", "status"], _count: { _all: true } }),
  ]);
  const c = (id: string, s: string) => counts.find((x) => x.journeyId === id && x.status === s)?._count._all ?? 0;
  return rows.map((j) => ({ id: j.id, name: j.name, status: j.status, segment: j.segment, steps: (j.steps as Step[]).length, running: c(j.id, "RUNNING"), completed: c(j.id, "COMPLETED"), exited: c(j.id, "EXITED"), activatedAt: j.activatedAt?.toISOString() ?? null, updatedAt: j.updatedAt.toISOString() }));
}

export async function getJourney(user: SessionUser, id: string) {
  requirePerm(user, "journey.manage");
  const j = await db.journey.findFirst({ where: { id }, include: { segment: { select: { id: true, name: true, lastCount: true } } } });
  if (!j) throw new HttpError(404, "Không tìm thấy hành trình");
  const [status, perStep, reasons] = await Promise.all([
    db.journeyRun.groupBy({ by: ["status"], where: { journeyId: id }, _count: { _all: true } }),
    db.journeyStepLog.groupBy({ by: ["stepIndex", "outcome"], where: { run: { journeyId: id } }, _count: { _all: true } }),
    db.journeyRun.groupBy({ by: ["exitReason"], where: { journeyId: id, status: "EXITED" }, _count: { _all: true } }),
  ]);
  return {
    id: j.id, name: j.name, description: j.description, status: j.status, segment: j.segment, brandId: j.brandId, steps: j.steps as Step[], exitRules: exitRulesSchema.parse(j.exitRules), reentryDays: j.reentryDays,
    activatedAt: j.activatedAt?.toISOString() ?? null,
    stats: Object.fromEntries(status.map((s) => [s.status, s._count._all])) as Record<string, number>,
    perStep: perStep.map((p) => ({ stepIndex: p.stepIndex, outcome: p.outcome, count: p._count._all })),
    exitReasons: reasons.map((r) => ({ reason: r.exitReason ?? "—", count: r._count._all })).sort((a, b) => b.count - a.count),
    canActivate: can(user.roles, "journey.activate"),
  };
}
export type JourneyDetail = Awaited<ReturnType<typeof getJourney>>;

export async function listJourneyRuns(user: SessionUser, journeyId: string, f: { status?: string; page?: number }) {
  requirePerm(user, "journey.manage");
  bindTenant(user);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.JourneyRunWhereInput = { journeyId, ...(f.status ? { status: f.status as never } : {}) };
  const [total, rows] = await Promise.all([
    db.journeyRun.count({ where }),
    db.journeyRun.findMany({ where, orderBy: { enteredAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { customer: { select: { id: true, displayName: true } }, logs: { orderBy: { stepIndex: "asc" } } } }),
  ]);
  return {
    total, page, pageSize: 50,
    rows: rows.map((r) => ({ id: r.id, customer: r.customer, status: r.status, stepIndex: r.stepIndex, enteredAt: r.enteredAt.toISOString(), nextAt: r.nextAt.toISOString(), exitedAt: r.exitedAt?.toISOString() ?? null, exitReason: r.exitReason, logs: r.logs.map((l) => ({ stepIndex: l.stepIndex, type: l.stepType, outcome: l.outcome, detail: l.detail, at: l.createdAt.toISOString() })) })),
  };
}

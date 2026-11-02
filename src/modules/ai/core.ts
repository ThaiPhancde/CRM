// Lõi Trung tâm AI (Phase 8): ghi mọi lần chạy (AgentRun + AiCost), tool qua service có requirePerm (ToolCall), hàng chờ duyệt (Approval).
// AI chạy với quyền của người gọi: mọi dữ liệu vào ngữ cảnh đều đi qua service đã lọc phạm vi + che PII/tiền (docs/permissions.md mục 3).
import { Prisma, type AgentRunStatus } from "@prisma/client";
import { z } from "zod";
import { getLlm, type AiFeature, type Evidence, type Llm, type LlmRequest, type LlmResult, type ToolSpec } from "@/adapters/llm";
import { costUsd, DEFAULT_PRICES, type Price } from "@/adapters/llm/pricing";
import { getWarehouse } from "@/adapters/warehouse";
import { audit } from "@/lib/audit";
import { bindTenant, db } from "@/lib/db";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";
import { customerFilter, getCustomer360, listCustomers } from "@/modules/customers/service";
import { listOrders, orderFilter } from "@/modules/orders/service";
import { leadEditWhere } from "@/modules/sales/scope";
import { createTask } from "@/modules/sales/tasks";
import { getCustomerScores } from "@/modules/scoring/service";
import { reportScope } from "@/modules/reports/scope";
import { redactDeep, redactText } from "./redact";

const isDenied = (e: unknown) => e instanceof HttpError && e.status === 403;
const errMsg = (e: unknown) => (e instanceof ValidationError ? Object.values(e.fields ?? {}).join("; ") || e.message : e instanceof Error ? e.message : String(e));

// ---- Tool ----

type ToolDef<A> = {
  spec: ToolSpec;
  schema: z.ZodType<A>;
  /** Lý do cần duyệt (null = chạy ngay). Q-32: giao việc cho người khác khi không có quyền phân công. */
  approval?: (u: SessionUser, a: A) => string | null;
  run: (u: SessionUser, a: A) => Promise<unknown>;
};
const tool = <A,>(d: ToolDef<A>) => d;
const iso = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Thời điểm không hợp lệ");

export const TOOLS = {
  tim_khach: tool({
    spec: { name: "tim_khach", description: "Tìm khách trong phạm vi người dùng theo tên/SĐT/email.", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } },
    schema: z.object({ q: z.string().trim().min(2, "Cần ít nhất 2 ký tự").max(100) }),
    run: async (u, a) => (await listCustomers(u, customerFilter.parse({ q: a.q }))).rows.slice(0, 5).map((c) => ({ id: c.id, name: c.name, phone: c.phone, market: c.market })),
  }),
  tim_don: tool({
    spec: { name: "tim_don", description: "Tìm đơn trong phạm vi theo bộ lọc (q, fulfillment, market, from, to).", inputSchema: { type: "object", properties: { q: { type: "string" }, fulfillment: { type: "string" }, market: { type: "string" }, from: { type: "string" }, to: { type: "string" } } } },
    schema: orderFilter.omit({ page: true }).partial(),
    run: async (u, a) => {
      const r = await listOrders(u, orderFilter.parse({ ...a, page: 1 }));
      return { total: r.total, rows: r.rows.slice(0, 10).map((o) => ({ id: o.id, orderNumber: o.orderNumber, customer: o.customerName, fulfillment: o.fulfillmentStatus, bookedAt: o.bookedAt })) };
    },
  }),
  tom_tat_360: tool({
    spec: { name: "tom_tat_360", description: "Lấy hồ sơ 360 + điểm của một khách (đã lọc quyền).", inputSchema: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
    schema: z.object({ customerId: z.string().min(1) }),
    run: async (u, a) => {
      const c = await getCustomer360(u, a.customerId);
      if ("redirectTo" in c) return { redirectTo: c.redirectTo };
      return { c, scores: await getCustomerScores(u, a.customerId) };
    },
  }),
  tao_nhiem_vu: tool({
    spec: { name: "tao_nhiem_vu", description: "Tạo nhiệm vụ gọi lại/theo dõi cho khách hoặc nhu cầu mua.", inputSchema: { type: "object", properties: { title: { type: "string" }, dueAt: { type: "string" }, customerId: { type: "string" }, leadId: { type: "string" }, assigneeId: { type: "string" }, note: { type: "string" } }, required: ["title", "dueAt"] } },
    schema: z.object({ title: z.string().trim().min(3).max(200), dueAt: iso, customerId: z.string().optional(), leadId: z.string().optional(), assigneeId: z.string().optional(), note: z.string().max(2000).optional(), idempotencyKey: z.string().max(120).optional() }),
    approval: (u, a) => (a.assigneeId && a.assigneeId !== u.id && !can(u.roles, "lead.assign") ? "Giao việc cho người khác cần Trưởng nhóm/Quản lý duyệt" : null),
    run: async (u, a) => { const r = await createTask(u, { type: "FOLLOW_UP", ...a }); return { taskId: r.task.id, title: r.task.title, dueAt: r.task.dueAt.toISOString(), replayed: r.replayed }; },
  }),
  tao_lich_hen: tool({
    spec: { name: "tao_lich_hen", description: "Tạo lịch hẹn (gặp/gọi) với khách vào thời điểm cho trước.", inputSchema: { type: "object", properties: { title: { type: "string" }, at: { type: "string" }, customerId: { type: "string" }, leadId: { type: "string" } }, required: ["title", "at"] } },
    schema: z.object({ title: z.string().trim().min(3).max(200), at: iso, customerId: z.string().optional(), leadId: z.string().optional(), note: z.string().max(2000).optional(), idempotencyKey: z.string().max(120).optional() }),
    run: async (u, a) => { const r = await createTask(u, { type: "MEETING", title: a.title, dueAt: a.at, customerId: a.customerId, leadId: a.leadId, note: a.note, idempotencyKey: a.idempotencyKey }); return { taskId: r.task.id, title: r.task.title, dueAt: r.task.dueAt.toISOString(), replayed: r.replayed }; },
  }),
  hoi_bao_cao: tool({
    spec: { name: "hoi_bao_cao", description: "Tổng REV-01..04 kỳ 12 tháng (chỉ số chuẩn) theo thị trường hoặc cả team.", inputSchema: { type: "object", properties: { metric: { type: "string", enum: ["REV-01", "REV-02", "REV-03", "REV-04"] }, groupBy: { type: "string", enum: ["market", "none"] } }, required: ["metric"] } },
    schema: z.object({ metric: z.enum(["REV-01", "REV-02", "REV-03", "REV-04"]), groupBy: z.enum(["market", "none"]).default("none") }),
    run: async (u, a) => {
      requirePerm(u, "report.sales");
      if (reportScope(u) !== "team") throw new HttpError(403, "Báo cáo doanh thu cấp team cần vai Quản lý/Trưởng nhóm/Marketing/Kế toán");
      const wh = getWarehouse();
      const col = `rev0${a.metric.slice(-1)}` as "rev01";
      const [rows, asOf] = await Promise.all([wh.revenueSummary(u.workspaceId, col, a.groupBy), wh.freshness(u.workspaceId)]);
      const money = can(u.roles, "finance.view");
      return { metric: a.metric, groupBy: a.groupBy, asOf: asOf?.toISOString() ?? null, moneyHidden: !money, rows: rows.map((r) => ({ key: r.key, value: money ? r.value : null, customers: r.customers })) };
    },
  }),
} as const;
export type ToolName = keyof typeof TOOLS;
export const toolSpecs = (names: ToolName[]) => names.map((n) => TOOLS[n].spec);

// ---- Lần chạy ----

export type RunOut = { status?: AgentRunStatus; output: unknown; evidence?: Evidence[] };

export class Runner {
  inputTokens = 0;
  outputTokens = 0;
  constructor(readonly user: SessionUser, readonly runId: string, readonly llm: Llm, readonly pii: boolean) {}
  private clean(req: LlmRequest): LlmRequest {
    return { system: req.system, prompt: redactText(req.prompt, { pii: this.pii }), context: redactDeep(req.context, { pii: this.pii }) };
  }
  private count(r: LlmResult) { this.inputTokens += r.usage.inputTokens; this.outputTokens += r.usage.outputTokens; return r; }
  complete(feature: AiFeature, req: LlmRequest) { return this.llm.complete(feature, this.clean(req)).then((r) => this.count(r)); }
  completeWithTools(feature: AiFeature, req: LlmRequest, tools: ToolName[]) { return this.llm.completeWithTools(feature, this.clean(req), toolSpecs(tools)).then((r) => this.count(r)); }

  /** Gọi tool: kiểm đầu vào → (cần duyệt? tạo Approval) → service có requirePerm. Luôn ghi ToolCall; thiếu quyền → DENIED, không tác dụng phụ. */
  async tool<N extends ToolName>(name: N, input: unknown): Promise<{ ok: true; result: unknown } | { ok: false; status: "DENIED" | "ERROR" | "PENDING_APPROVAL"; message: string; approvalId?: string }> {
    const def = TOOLS[name] as unknown as ToolDef<Record<string, unknown>>;
    const parsed = def.schema.safeParse(input);
    const args = (parsed.success ? parsed.data : input) as Prisma.InputJsonValue;
    const log = (status: "OK" | "DENIED" | "ERROR" | "PENDING_APPROVAL", extra: { result?: unknown; error?: string }) =>
      db.toolCall.create({ data: { runId: this.runId, tool: name, args, status, result: (extra.result ?? undefined) as Prisma.InputJsonValue | undefined, error: extra.error } as never });
    if (!parsed.success) { const m = parsed.error.issues.map((i) => i.message).join("; "); await log("ERROR", { error: m }); return { ok: false, status: "ERROR", message: m }; }
    const reason = def.approval?.(this.user, parsed.data);
    if (reason) {
      const call = await log("PENDING_APPROVAL", {});
      const ap = await db.approval.create({ data: { toolCallId: call.id, requestedById: this.user.id, reason } as never });
      return { ok: false, status: "PENDING_APPROVAL", message: reason, approvalId: ap.id };
    }
    try {
      const result = await def.run(this.user, parsed.data);
      await log("OK", { result: summarizeResult(result) });
      return { ok: true, result };
    } catch (e) {
      const status = isDenied(e) ? "DENIED" : "ERROR";
      await log(status, { error: errMsg(e) });
      return { ok: false, status, message: status === "DENIED" ? "Bạn không có quyền thực hiện thao tác này." : errMsg(e) };
    }
  }
}

/** Kết quả tool lưu vào nhật ký ở dạng gọn (không chép cả hồ sơ 360). */
function summarizeResult(r: unknown): unknown {
  const s = JSON.stringify(r ?? null);
  return s.length <= 4000 ? JSON.parse(s) : { truncated: true, size: s.length };
}

async function prices(): Promise<Record<string, Price>> {
  const s = await db.setting.findFirst({ where: { key: "aiPricing" } });
  return { ...DEFAULT_PRICES, ...((s?.value as Record<string, Price> | null) ?? {}) };
}

/** Chi phí tháng hiện tại (USD) và ngân sách (Setting aiBudget.monthlyUsd; null = không giới hạn). */
export async function budgetState(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [sum, s] = await Promise.all([db.aiCost.aggregate({ where: { createdAt: { gte: from } }, _sum: { usd: true } }), db.setting.findFirst({ where: { key: "aiBudget" } })]);
  const limit = (s?.value as { monthlyUsd?: number } | null)?.monthlyUsd ?? null;
  return { spent: Number(sum._sum.usd ?? 0), limit };
}

/** Bọc một chức năng AI: kiểm quyền + ngân sách, ghi AgentRun/AiCost dù thành công hay lỗi. */
export async function aiRun<T extends RunOut>(user: SessionUser, feature: AiFeature, input: string, fn: (r: Runner) => Promise<T>): Promise<Omit<T, "status"> & { status: AgentRunStatus; runId: string }> {
  requirePerm(user, "ai.run");
  bindTenant(user);
  const b = await budgetState();
  if (b.limit != null && b.spent >= b.limit) throw new HttpError(429, `Đã dùng hết ngân sách AI tháng này (${b.spent.toFixed(2)}/${b.limit} USD). Quản lý chỉnh ở /ai.`);
  const llm = getLlm();
  const pii = can(user.roles, "customer.pii");
  const t = Date.now();
  const run = await db.agentRun.create({ data: { userId: user.id, feature, provider: llm.provider, model: llm.model, status: "ERROR", input: redactText(input, { pii }).slice(0, 2000), ms: 0 } as never });
  const r = new Runner(user, run.id, llm, pii);
  const finish = async (status: AgentRunStatus, output: unknown, evidence: Evidence[] | undefined, error?: string) => {
    const usd = costUsd(llm.model, r.inputTokens, r.outputTokens, await prices());
    await db.$transaction([
      db.agentRun.update({ where: { id: run.id }, data: { status, output: (output ?? undefined) as Prisma.InputJsonValue | undefined, evidence: (evidence ?? []) as Prisma.InputJsonValue, error, ms: Date.now() - t } }),
      db.aiCost.create({ data: { runId: run.id, feature, provider: llm.provider, model: llm.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, usd } as never }),
    ]);
  };
  try {
    const out = await fn(r);
    await finish(out.status ?? "OK", out.output, out.evidence);
    return { ...out, status: out.status ?? "OK", runId: run.id };
  } catch (e) {
    await finish(isDenied(e) ? "DENIED" : "ERROR", null, undefined, errMsg(e).slice(0, 500));
    throw e;
  }
}

// ---- Đề xuất + duyệt ----

/** Áp đề xuất "cập nhật nhu cầu" lên lead trong phạm vi sửa của người duyệt. */
async function applySuggestion(approver: SessionUser, s: { kind: string; entityId: string; payload: unknown }) {
  if (s.kind !== "lead.interest") throw new ValidationError({ kind: `Loại đề xuất ${s.kind} chưa hỗ trợ` });
  requirePerm(approver, "lead.edit");
  const interest = String((s.payload as { interest?: unknown }).interest ?? "").slice(0, 300);
  const lead = await db.lead.findFirst({ where: { AND: [{ id: s.entityId }, leadEditWhere(approver)] }, select: { id: true, interest: true } });
  if (!lead) throw new HttpError(404, "Không tìm thấy nhu cầu mua trong phạm vi của bạn");
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { interest } });
    await audit(tx, { actorId: approver.id, entity: "Lead", entityId: lead.id, action: "ai.suggestion", before: { interest: lead.interest }, after: { interest } });
  });
}

/** Điều kiện yêu cầu duyệt mà người này được thấy/quyết: Quản lý mọi yêu cầu; Trưởng nhóm của thành viên cùng nhóm. */
export async function approvalScope(u: SessionUser): Promise<Prisma.ApprovalWhereInput> {
  if (can(u.roles, "ai.budget")) return {};
  if (!u.teamId) return { id: "__none__" };
  const members = await db.membership.findMany({ where: { teamId: u.teamId }, select: { userId: true } });
  return { requestedById: { in: members.map((m) => m.userId) } };
}

/** Duyệt / từ chối. Chuyển trạng thái có điều kiện (PENDING → …) nên bấm hai lần không chạy hai lần; không tự duyệt yêu cầu của mình. */
export async function decideApproval(user: SessionUser, input: unknown) {
  requirePerm(user, "ai.approve");
  const d = parse(z.object({ id: z.string().min(1), approve: z.boolean(), note: z.string().trim().max(500).optional() }), input);
  const ap = await db.approval.findFirst({ where: { AND: [{ id: d.id }, await approvalScope(user)] }, include: { toolCall: true, suggestion: true } });
  if (!ap) throw new HttpError(404, "Không tìm thấy yêu cầu duyệt");
  if (ap.requestedById === user.id) throw new HttpError(403, "Không tự duyệt yêu cầu của chính mình");
  const moved = await db.approval.updateMany({ where: { id: ap.id, status: "PENDING" }, data: { status: d.approve ? "APPROVED" : "REJECTED", decidedById: user.id, decidedAt: new Date(), note: d.note } });
  if (!moved.count) throw new HttpError(409, "Yêu cầu này đã được xử lý");
  if (!d.approve) {
    if (ap.suggestion) await db.suggestion.update({ where: { id: ap.suggestion.id }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date() } });
    if (ap.toolCall) await db.toolCall.update({ where: { id: ap.toolCall.id }, data: { status: "DENIED", error: "Người duyệt từ chối" } });
    return { approved: false };
  }
  try {
    if (ap.toolCall) {
      const def = TOOLS[ap.toolCall.tool as ToolName] as unknown as ToolDef<Record<string, unknown>> | undefined;
      if (!def) throw new ValidationError({ tool: "Tool không còn tồn tại" });
      // Chạy với quyền NGƯỜI DUYỆT; khóa idempotency theo yêu cầu duyệt.
      const result = await def.run(user, { ...(def.schema.parse(ap.toolCall.args) as Record<string, unknown>), idempotencyKey: `approval:${ap.id}` });
      await db.toolCall.update({ where: { id: ap.toolCall.id }, data: { status: "OK", result: summarizeResult(result) as Prisma.InputJsonValue } });
    }
    if (ap.suggestion) {
      await applySuggestion(user, ap.suggestion);
      await db.suggestion.update({ where: { id: ap.suggestion.id }, data: { status: "ACCEPTED", decidedById: user.id, decidedAt: new Date() } });
    }
    return { approved: true };
  } catch (e) {
    // Không áp được (vd ngoài phạm vi người duyệt) → trả về chờ duyệt để người khác xử lý, không mất yêu cầu.
    await db.approval.update({ where: { id: ap.id }, data: { status: "PENDING", decidedById: null, decidedAt: null } });
    throw e;
  }
}

/** Đề xuất cần duyệt (kèm Approval). */
export async function suggest(r: Runner, s: { kind: string; entity: string; entityId: string; payload: Record<string, unknown>; reason: string }) {
  const sug = await db.suggestion.create({ data: { runId: r.runId, kind: s.kind, entity: s.entity, entityId: s.entityId, payload: s.payload as Prisma.InputJsonValue, reason: s.reason } as never });
  await db.approval.create({ data: { suggestionId: sug.id, requestedById: r.user.id, reason: s.reason } as never });
  return sug;
}

export async function setBudget(user: SessionUser, input: unknown) {
  requirePerm(user, "ai.budget");
  const d = parse(z.object({ monthlyUsd: z.coerce.number().min(0, "≥ 0").max(100000).nullable() }), input);
  const value = (d.monthlyUsd == null ? {} : { monthlyUsd: d.monthlyUsd }) as Prisma.InputJsonValue;
  const prev = await db.setting.findFirst({ where: { key: "aiBudget" } });
  await db.$transaction(async (tx) => {
    if (prev) await tx.setting.update({ where: { id: prev.id }, data: { value } });
    else await tx.setting.create({ data: { key: "aiBudget", value } as never });
    await audit(tx, { actorId: user.id, entity: "Setting", entityId: "aiBudget", action: "update", before: prev?.value ?? undefined, after: value });
  });
}

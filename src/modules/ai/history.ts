// Trang /ai: lịch sử lần chạy (AI-01), hàng chờ duyệt, chi phí theo tính năng / model / người (D-56).
// Phạm vi: người có ai.approve hoặc ai.budget xem lần chạy của cả team; người khác chỉ thấy của mình.
// Trưởng nhóm duyệt yêu cầu của thành viên nhóm mình; Quản lý duyệt mọi yêu cầu (docs/permissions.md "ai.approve ✓ team").
import type { AgentRunStatus, ApprovalStatus, Prisma } from "@prisma/client";
import { bindTenant, db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";
import { approvalScope, budgetState } from "./core";

const PAGE = 50;
const seesAll = (u: SessionUser) => can(u.roles, "ai.budget") || can(u.roles, "ai.approve");


export async function listRuns(user: SessionUser, f: { page?: number; feature?: string; status?: string }) {
  requirePerm(user, "ai.run");
  bindTenant(user);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.AgentRunWhereInput = { ...(seesAll(user) ? {} : { userId: user.id }), ...(f.feature ? { feature: f.feature } : {}), ...(f.status ? { status: f.status as AgentRunStatus } : {}) };
  const [total, rows] = await Promise.all([
    db.agentRun.count({ where }),
    db.agentRun.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true } }, cost: true, toolCalls: { select: { tool: true, status: true } } } }),
  ]);
  return {
    total, page, pageSize: PAGE, seesAll: seesAll(user),
    rows: rows.map((r) => ({
      id: r.id, feature: r.feature, status: r.status, user: r.user.name, provider: r.provider, model: r.model, ms: r.ms, input: r.input, error: r.error,
      inputTokens: r.cost?.inputTokens ?? 0, outputTokens: r.cost?.outputTokens ?? 0, usd: r.cost?.usd.toString() ?? "0",
      evidenceCount: Array.isArray(r.evidence) ? r.evidence.length : 0, tools: r.toolCalls, createdAt: r.createdAt.toISOString(),
    })),
  };
}
export type RunRow = Awaited<ReturnType<typeof listRuns>>["rows"][number];

export async function getRun(user: SessionUser, id: string) {
  requirePerm(user, "ai.run");
  bindTenant(user);
  const r = await db.agentRun.findFirst({ where: { id, ...(seesAll(user) ? {} : { userId: user.id }) }, include: { user: { select: { name: true } }, cost: true, toolCalls: { orderBy: { createdAt: "asc" } }, suggestions: true } });
  if (!r) throw new HttpError(404, "Không tìm thấy lần chạy");
  return {
    id: r.id, feature: r.feature, status: r.status, user: r.user.name, provider: r.provider, model: r.model, ms: r.ms, input: r.input, output: r.output, evidence: (r.evidence ?? []) as { id: string; kind: string; label: string; href?: string }[], error: r.error,
    cost: r.cost ? { inputTokens: r.cost.inputTokens, outputTokens: r.cost.outputTokens, usd: r.cost.usd.toString() } : null,
    toolCalls: r.toolCalls.map((t) => ({ id: t.id, tool: t.tool, status: t.status, args: t.args, result: t.result, error: t.error, createdAt: t.createdAt.toISOString() })),
    suggestions: r.suggestions.map((s) => ({ id: s.id, kind: s.kind, status: s.status, payload: s.payload, reason: s.reason })),
    createdAt: r.createdAt.toISOString(),
  };
}
export type RunDetail = Awaited<ReturnType<typeof getRun>>;

export async function listApprovals(user: SessionUser, status: ApprovalStatus | "ALL" = "PENDING") {
  requirePerm(user, "ai.approve");
  bindTenant(user);
  const where: Prisma.ApprovalWhereInput = { AND: [await approvalScope(user), status === "ALL" ? {} : { status }] };
  const rows = await db.approval.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { toolCall: { select: { tool: true, args: true, runId: true } }, suggestion: { select: { kind: true, payload: true, entity: true, entityId: true, runId: true } } } });
  const names = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.requestedById, r.decidedById ?? ""]))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((a) => ({
    id: a.id, status: a.status, reason: a.reason, note: a.note, createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null,
    requestedBy: names.get(a.requestedById) ?? "—", decidedBy: a.decidedById ? names.get(a.decidedById) ?? "—" : null, mine: a.requestedById === user.id,
    kind: a.toolCall ? ("tool" as const) : ("suggestion" as const),
    tool: a.toolCall?.tool ?? null, args: a.toolCall?.args ?? null,
    suggestion: a.suggestion ? { kind: a.suggestion.kind, payload: a.suggestion.payload, entity: a.suggestion.entity, entityId: a.suggestion.entityId } : null,
    runId: a.toolCall?.runId ?? a.suggestion?.runId ?? null,
  }));
}
export type ApprovalRow = Awaited<ReturnType<typeof listApprovals>>[number];

/** Chi phí + chỉ số AI-01..03 tháng hiện tại (UTC). */
export async function aiStats(user: SessionUser, now = new Date()) {
  requirePerm(user, "ai.budget");
  bindTenant(user);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const w = { createdAt: { gte: from } };
  const [byFeature, byModel, byUser, sugg, calls, budget] = await Promise.all([
    db.aiCost.groupBy({ by: ["feature"], where: w, _count: { _all: true }, _sum: { usd: true, inputTokens: true, outputTokens: true } }),
    db.aiCost.groupBy({ by: ["provider", "model"], where: w, _count: { _all: true }, _sum: { usd: true, inputTokens: true, outputTokens: true } }),
    db.agentRun.groupBy({ by: ["userId"], where: w, _count: { _all: true } }),
    db.suggestion.groupBy({ by: ["status"], where: w, _count: { _all: true } }),
    db.toolCall.groupBy({ by: ["status"], where: w, _count: { _all: true } }),
    budgetState(now),
  ]);
  const names = new Map((await db.user.findMany({ where: { id: { in: byUser.map((u) => u.userId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const n = (arr: { status: string; _count: { _all: number } }[], s?: string) => arr.filter((x) => !s || x.status === s).reduce((a, x) => a + x._count._all, 0);
  const runs = byFeature.reduce((a, x) => a + x._count._all, 0);
  const row = (x: { _count: { _all: number }; _sum: { usd: Prisma.Decimal | null; inputTokens: number | null; outputTokens: number | null } }) => ({ runs: x._count._all, usd: x._sum.usd?.toString() ?? "0", inputTokens: x._sum.inputTokens ?? 0, outputTokens: x._sum.outputTokens ?? 0 });
  return {
    month: from.toISOString().slice(0, 7), budget,
    ai01: { runs, usd: budget.spent.toFixed(6), tokens: byFeature.reduce((a, x) => a + (x._sum.inputTokens ?? 0) + (x._sum.outputTokens ?? 0), 0) },
    ai02: { accepted: n(sugg, "ACCEPTED"), total: n(sugg) },
    ai03: { denied: n(calls, "DENIED"), total: n(calls) },
    byFeature: byFeature.map((x) => ({ feature: x.feature, ...row(x) })),
    byModel: byModel.map((x) => ({ provider: x.provider, model: x.model, ...row(x) })),
    byUser: byUser.map((x) => ({ user: names.get(x.userId) ?? "—", runs: x._count._all })).sort((a, b) => b.runs - a.runs),
  };
}
export type AiStats = Awaited<ReturnType<typeof aiStats>>;

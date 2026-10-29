// Điểm + chỉ số cho giao diện (Phase 6): đọc theo quyền/phạm vi, che tiền khi thiếu finance.view, phiên bản trọng số (score.config).
import type { ScoreType } from "@prisma/client";
import { z } from "zod";
import { getWarehouse } from "@/adapters/warehouse";
import { bindTenant, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";
import { customerScopeWhere, leadViewWhere } from "@/modules/sales/scope";
import { activeVersions, refreshAndScoreCustomers, SCORE_TYPES } from "./engine";
import { DEFAULT_WEIGHTS, type Reason } from "./formulas";

export const SCORE_LABEL: Record<ScoreType, string> = { SALES_PRIORITY: "Ưu tiên sales", RFM: "RFM", TXN_RISK: "Rủi ro giao dịch", SUPPORT_NEED: "Nhu cầu hỗ trợ" };

type ScoreView = { type: ScoreType; version: number; value: number | null; band: string; reasons: Reason[]; missingData: string[]; suggestedAction: string | null; computedAt: string };

const view = (s: { type: ScoreType; value: number | null; band: string; reasons: unknown; missingData: string[]; suggestedAction: string | null; computedAt: Date; version: { version: number } }, money: boolean): ScoreView => ({
  type: s.type, version: s.version.version, value: s.value, band: s.band, missingData: s.missingData, suggestedAction: s.suggestedAction, computedAt: s.computedAt.toISOString(),
  reasons: (s.reasons as Reason[]).map((r) => (!money && r.part.startsWith("M —") ? { ...r, evidence: "REV-03 12 tháng (cần quyền xem tiền)" } : r)),
});

/** Điểm hiện hành (phiên bản đang dùng) + chỉ số R12M của một khách. Tiền che khi thiếu finance.view. */
export async function getCustomerScores(user: SessionUser, customerId: string) {
  requirePerm(user, "customer.view");
  if (!(await db.customer.findFirst({ where: { id: customerId, ...customerScopeWhere(user) }, select: { id: true } }))) throw new HttpError(404, "Không tìm thấy khách");
  const money = can(user.roles, "finance.view");
  const [scores, m] = await Promise.all([
    db.score.findMany({ where: { customerId, version: { active: true } }, include: { version: { select: { version: true } } } }),
    db.customerMetric.findFirst({ where: { customerId, period: "R12M" } }),
  ]);
  const order: ScoreType[] = ["RFM", "TXN_RISK", "SUPPORT_NEED"];
  return {
    scores: order.map((t) => scores.find((s) => s.type === t)).filter(Boolean).map((s) => view(s!, money)),
    metric: m ? {
      asOf: m.asOf.toISOString(), orders: m.orders, deliveredOrders: m.deliveredOrders, confirmedOrders: m.confirmedOrders, failedByCustomer: m.failedByCustomer,
      recencyDays: m.recencyDays, avgCycleDays: m.avgCycleDays, repurchase60: m.repurchase60, openTickets: m.openTickets,
      rev01: money ? m.rev01.toString() : null, rev02: money ? m.rev02.toString() : null, rev03: money ? m.rev03.toString() : null, rev04: money ? m.rev04.toString() : null,
      grossProfit: money && m.grossProfit ? m.grossProfit.toString() : null,
    } : null,
    showMoney: money,
  };
}
export type CustomerScores = Awaited<ReturnType<typeof getCustomerScores>>;

export async function getLeadScore(user: SessionUser, leadId: string) {
  requirePerm(user, "lead.view");
  if (!(await db.lead.findFirst({ where: { AND: [{ id: leadId }, leadViewWhere(user)] }, select: { id: true } }))) throw new HttpError(404, "Không tìm thấy nhu cầu mua");
  const s = await db.score.findFirst({ where: { leadId, version: { active: true } }, include: { version: { select: { version: true } } } });
  return s ? view(s, true) : null;
}

/** Điểm hiện hành theo lô cho danh sách (lead hoặc khách) — chỉ value + band. */
export async function scoresFor(kind: "lead" | "customer", ids: string[], type: ScoreType) {
  if (!ids.length) return new Map<string, { value: number | null; band: string }>();
  const rows = await db.score.findMany({ where: { type, version: { active: true }, ...(kind === "lead" ? { leadId: { in: ids } } : { customerId: { in: ids } }) }, select: { leadId: true, customerId: true, value: true, band: true } });
  return new Map(rows.map((r) => [(kind === "lead" ? r.leadId : r.customerId)!, { value: r.value, band: r.band }]));
}

// ---- Cấu hình phiên bản (score.config) ----

export async function listScoreVersions(user: SessionUser) {
  requirePerm(user, "score.config");
  await activeVersions(db);
  const [versions, counts, fresh] = await Promise.all([
    db.scoreVersion.findMany({ orderBy: [{ type: "asc" }, { version: "desc" }] }),
    db.score.groupBy({ by: ["versionId"], _count: { _all: true } }),
    getWarehouse().freshness(user.workspaceId),
  ]);
  const n = new Map(counts.map((c) => [c.versionId, c._count._all]));
  return {
    metricsAsOf: fresh?.toISOString() ?? null,
    types: SCORE_TYPES.map((type) => ({
      type, label: SCORE_LABEL[type], defaults: DEFAULT_WEIGHTS[type] as Record<string, number>,
      versions: versions.filter((v) => v.type === type).map((v) => ({ id: v.id, version: v.version, weights: v.weights as Record<string, number>, note: v.note, active: v.active, createdAt: v.createdAt.toISOString(), scored: n.get(v.id) ?? 0 })),
    })),
  };
}

export const versionSchema = z.object({
  type: z.enum(["SALES_PRIORITY", "TXN_RISK", "SUPPORT_NEED"], { message: "Loại điểm có trọng số" }),
  weights: z.record(z.string(), z.coerce.number().int("Số nguyên").min(0, "≥ 0").max(100, "≤ 100")),
  note: z.string().trim().min(3, "Ghi lý do đổi trọng số (tối thiểu 3 ký tự)").max(300),
});

/** Đổi trọng số = tạo phiên bản mới (đang dùng), phiên bản cũ thôi dùng nhưng điểm của nó giữ nguyên. Tổng trọng số phải 100. */
export async function createScoreVersion(user: SessionUser, input: unknown) {
  requirePerm(user, "score.config");
  const d = parse(versionSchema, input);
  const keys = Object.keys(DEFAULT_WEIGHTS[d.type]);
  if (keys.some((k) => d.weights[k] == null) || Object.keys(d.weights).some((k) => !keys.includes(k))) throw new ValidationError({ weights: `Cần đủ các thành phần: ${keys.join(", ")}` });
  const sum = keys.reduce((s, k) => s + d.weights[k], 0);
  if (sum !== 100) throw new ValidationError({ weights: `Tổng trọng số phải bằng 100 (đang ${sum})` });
  return db.$transaction(async (tx) => {
    const last = await tx.scoreVersion.findFirst({ where: { type: d.type }, orderBy: { version: "desc" } });
    await tx.scoreVersion.updateMany({ where: { type: d.type, active: true }, data: { active: false } });
    const v = await tx.scoreVersion.create({ data: { type: d.type, version: (last?.version ?? 0) + 1, weights: Object.fromEntries(keys.map((k) => [k, d.weights[k]])), note: d.note, active: true, createdById: user.id } as never });
    await audit(tx, { actorId: user.id, entity: "ScoreVersion", entityId: v.id, action: "create", before: last ? { version: last.version, weights: last.weights } : undefined, after: { version: v.version, weights: v.weights }, reason: d.note });
    return v;
  });
}

/** Nút "Tính lại ngay" (Quản lý): dựng chỉ số + chấm điểm khách của team ngay, không chờ job hằng ngày. */
export async function recomputeNow(user: SessionUser) {
  requirePerm(user, "score.config");
  return refreshAndScoreCustomers(db, user.workspaceId);
}

export async function listMetricDefinitions(user: SessionUser) {
  requirePerm(user, "catalog.view");
  bindTenant(user);
  return db.metricDefinition.findMany({ orderBy: [{ group: "asc" }, { code: "asc" }] });
}

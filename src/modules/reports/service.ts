// Báo cáo 6 nhóm (HLD §9.2, thiết kế Phase 9) — mọi số liệu đơn/khách/lead đi qua Warehouse (SQL tổng hợp, chỉ đọc, D-05/D-48).
// Quyền theo nhóm; số tiền chỉ hiện khi có finance.view. Đổi tiền tệ báo cáo theo FxRate hiệu lực ngày cuối kỳ, hiện tỷ giá đã dùng.
import { getWarehouse } from "@/adapters/warehouse";
import { cohortSql, failureReasonsSql, fulfillmentSql, leadByGroupSql, leadStageSql, rfmSql } from "@/adapters/warehouse/reports";
import { bindTenant, db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { can, type Permission } from "@/lib/permissions";
import { FAILURE_REASON } from "@/lib/status-badge";
import { requirePerm, type SessionUser } from "@/lib/session";
import { aiStats } from "@/modules/ai/history";
import { RFM_OPTIONS } from "@/modules/marketing/segments";
import { STAGE_LABEL } from "@/modules/sales/labels";
import { pct, pivotCohort, rangeParams, todayVN, toReportCurrency, type CohortRow, type ReportFilter } from "./period";
import { labels, n, nn, params, revenueCube, revenueRows, type RevenueRow } from "./revenue";
import { reportScope } from "./scope";

export const REPORT_GROUP_KEYS = ["sales", "khach-hang", "marketing", "van-don", "tai-chinh", "ai"] as const;
export type ReportGroupKey = (typeof REPORT_GROUP_KEYS)[number];
export const REPORT_PERM: Record<ReportGroupKey, Permission> = {
  sales: "report.sales", "khach-hang": "report.customer", marketing: "report.marketing", "van-don": "report.fulfillment", "tai-chinh": "report.finance", ai: "report.ai",
};
/** Nhóm người này được xem (tài chính cần thêm finance.view). */
export const visibleGroups = (u: SessionUser) => REPORT_GROUP_KEYS.filter((g) => can(u.roles, REPORT_PERM[g]) && (g !== "tai-chinh" || can(u.roles, "finance.view")));

function guard(u: SessionUser, g: ReportGroupKey) {
  requirePerm(u, REPORT_PERM[g]);
  if (g === "tai-chinh") requirePerm(u, "finance.view");
  bindTenant(u);
}

/** Bối cảnh chung của một trang báo cáo: lựa chọn bộ lọc, độ mới, tỷ giá tiền tệ báo cáo, định nghĩa chỉ số. */
export async function reportContext(u: SessionUser, g: ReportGroupKey, f: ReportFilter) {
  guard(u, g);
  const [brands, stores, markets, fx, defs, fresh] = await Promise.all([
    db.brand.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    db.store.findMany({ where: { active: true }, select: { id: true, code: true, name: true, brandId: true }, orderBy: { code: "asc" } }),
    db.market.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    db.fxRate.findMany({ where: { validFrom: { lte: new Date(`${f.to}T23:59:59Z`) } }, orderBy: [{ currency: "asc" }, { validFrom: "desc" }] }),
    db.metricDefinition.findMany({ select: { code: true, nameVi: true, formula: true, timeAnchor: true } }),
    getWarehouse().freshness(u.workspaceId),
  ]);
  const latest = new Map<string, { rate: number; validFrom: string }>();
  for (const r of fx) if (!latest.has(r.currency)) latest.set(r.currency, { rate: Number(r.rateToBase), validFrom: r.validFrom.toISOString().slice(0, 10) });
  const rate = f.currency === "VND" ? null : latest.get(f.currency) ?? null;
  return {
    brands, stores, markets,
    currencies: ["VND", ...[...latest.keys()].filter((c) => c !== "VND")],
    currency: rate || f.currency === "VND" ? f.currency : "VND",
    rate: rate ? { currency: f.currency, rateToBase: rate.rate, validFrom: rate.validFrom } : null,
    definitions: Object.fromEntries(defs.map((d) => [d.code, `${d.nameVi}: ${d.formula} (mốc: ${d.timeAnchor})`])) as Record<string, string>,
    freshness: fresh?.toISOString() ?? null,
    showMoney: can(u.roles, "finance.view"),
    canExport: can(u.roles, "report.export"),
    scope: g === "sales" ? reportScope(u) : "team",
  };
}
export type ReportContext = Awaited<ReturnType<typeof reportContext>>;


const sumRows = (rows: RevenueRow[]) => {
  const s = (k: keyof RevenueRow) => (rows.some((r) => r[k] != null) ? rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) : null);
  return { orders: s("orders") ?? 0, confirmed: s("confirmed") ?? 0, delivered: s("delivered") ?? 0, rev01: s("rev01"), rev02: s("rev02"), rev03: s("rev03"), rev04: s("rev04"), refunds: s("refunds") };
};

export async function financeReport(u: SessionUser, f: ReportFilter, ctx: ReportContext) {
  guard(u, "tai-chinh");
  const rate = ctx.rate?.rateToBase ?? null;
  const cube = await revenueCube(u, f, f.group);
  const [rows, byCurrency] = await Promise.all([revenueRows(u, f, f.group, rate, cube), revenueRows(u, f, f.group, rate, cube, true)]);
  const total = sumRows(rows);
  return {
    rows, byCurrency, total,
    // Tỷ lệ chuyển mốc (docs/metrics.md): REV-02/REV-01, REV-03/REV-02, REV-04/REV-03.
    ratios: { r21: total.rev01 ? pct(total.rev02 ?? 0, total.rev01) : null, r32: total.rev02 ? pct(total.rev03 ?? 0, total.rev02) : null, r43: total.rev03 ? pct(total.rev04 ?? 0, total.rev03) : null },
  };
}

// ---- Bán hàng ----

type LeadRaw = { key: string; leads: unknown; won: unknown; lost: unknown; overdue: unknown; contacted: unknown; avgFirstMin: unknown; withSla: unknown; onTime: unknown };
const leadRow = (r: LeadRaw, label: string) => ({
  key: r.key, label, leads: n(r.leads), won: n(r.won), lost: n(r.lost), overdue: n(r.overdue), contacted: n(r.contacted),
  winRate: pct(n(r.won), n(r.leads)), contactRate: pct(n(r.contacted), n(r.leads)), avgFirstMin: r.avgFirstMin == null ? null : Math.round(Number(r.avgFirstMin)),
  onTimeRate: pct(n(r.onTime), n(r.withSla)),
});

export async function salesReport(u: SessionUser, f: ReportFilter, now = new Date()) {
  guard(u, "sales");
  const scope = reportScope(u);
  const wh = getWarehouse();
  const p = params(u, f, { now, owner: scope === "self" ? u.id : null });
  const [stages, owners] = await Promise.all([
    wh.read<{ key: string; n: unknown }>(leadStageSql(wh.dialect), p),
    wh.read<LeadRaw>(leadByGroupSql(wh.dialect, "owner"), p),
  ]);
  const names = await labels("user", owners.map((o) => o.key));
  const rows = owners.map((o) => leadRow(o, o.key === "—" ? "Chưa giao" : names.get(o.key) ?? "—"));
  const order = Object.keys(STAGE_LABEL);
  const t = rows.reduce((a, r) => ({ leads: a.leads + r.leads, won: a.won + r.won, contacted: a.contacted + r.contacted, overdue: a.overdue + r.overdue }), { leads: 0, won: 0, contacted: 0, overdue: 0 });
  return {
    scope,
    stages: order.map((k) => ({ key: k, label: STAGE_LABEL[k as keyof typeof STAGE_LABEL], n: n(stages.find((s) => s.key === k)?.n) })),
    rows,
    total: { ...t, winRate: pct(t.won, t.leads), contactRate: pct(t.contacted, t.leads) },
  };
}

// ---- Khách hàng ----

export async function customerReport(u: SessionUser, f: ReportFilter, ctx: ReportContext, today = todayVN()) {
  guard(u, "khach-hang");
  const wh = getWarehouse();
  const [rfm, cohort] = await Promise.all([
    wh.read<{ key: string; customers: unknown; rev03: unknown; grossProfit: unknown; missingCost: unknown }>(rfmSql(wh.dialect), { ws: u.workspaceId }),
    wh.read<{ cohort: string; k: unknown; customers: unknown; repeat60: unknown }>(cohortSql(wh.dialect), params(u, f)),
  ]);
  const money = ctx.showMoney;
  const rate = ctx.rate?.rateToBase ?? null;
  const conv = (v: unknown) => (money ? toReportCurrency(nn(v), f.currency, rate) : null);
  const totalCust = rfm.reduce((a, r) => a + n(r.customers), 0);
  return {
    rfm: rfm.map((r) => ({ key: r.key, label: RFM_OPTIONS.find((o) => o.value === r.key)?.label ?? r.key, customers: n(r.customers), share: pct(n(r.customers), totalCust), rev03: conv(r.rev03), grossProfit: conv(r.grossProfit), missingCost: n(r.missingCost) })),
    cohort: pivotCohort(cohort.map((c): CohortRow => ({ cohort: c.cohort, k: n(c.k), customers: n(c.customers), repeat60: n(c.repeat60) })), today),
  };
}

// ---- Marketing ----

export async function marketingReport(u: SessionUser, f: ReportFilter, ctx: ReportContext, now = new Date()) {
  guard(u, "marketing");
  const wh = getWarehouse();
  const r = rangeParams(f);
  const [sources, campaigns, tps] = await Promise.all([
    wh.read<LeadRaw>(leadByGroupSql(wh.dialect, "source"), params(u, f, { now, owner: null })),
    db.campaign.findMany({ where: { OR: [{ startAt: null }, { startAt: { lt: r.to } }], AND: [{ OR: [{ endAt: null }, { endAt: { gte: r.from } }] }], ...(f.brand ? { brandId: f.brand } : {}) }, select: { id: true, name: true, channel: true, status: true, costBase: true }, orderBy: { name: "asc" }, take: 100 }),
    db.touchpoint.groupBy({ by: ["campaignId"], where: { occurredAt: { gte: r.from, lt: r.to } }, _count: { _all: true } }),
  ]);
  const leadTp = await db.touchpoint.groupBy({ by: ["campaignId"], where: { occurredAt: { gte: r.from, lt: r.to }, leadId: { not: null } }, _count: { _all: true } });
  const rate = ctx.rate?.rateToBase ?? null;
  const conv = (v: unknown) => (ctx.showMoney ? toReportCurrency(nn(v), f.currency, rate) : null);
  return {
    sources: sources.map((s) => leadRow(s, s.key)),
    campaigns: campaigns.map((c) => {
      const leads = leadTp.find((x) => x.campaignId === c.id)?._count._all ?? 0;
      const cost = conv(c.costBase);
      return { id: c.id, name: c.name, channel: c.channel, status: c.status, touchpoints: tps.find((x) => x.campaignId === c.id)?._count._all ?? 0, leads, cost, costPerLead: cost != null && leads ? cost / leads : null };
    }),
  };
}

// ---- Vận đơn ----

export async function fulfillmentReport(u: SessionUser, f: ReportFilter, ctx: ReportContext) {
  guard(u, "van-don");
  const wh = getWarehouse();
  const p = params(u, f);
  const [rows, reasons] = await Promise.all([
    wh.read<{ key: string; confirmed: unknown; delivered: unknown; partial: unknown; failed: unknown; returned: unknown; pending: unknown; avgDays: unknown; codCollected: unknown; codValue: unknown }>(fulfillmentSql(wh.dialect), p),
    wh.read<{ key: string; n: unknown }>(failureReasonsSql(wh.dialect), p),
  ]);
  const ml = await labels("market", rows.map((r) => r.key));
  const rate = ctx.rate?.rateToBase ?? null;
  const out = rows.map((r) => ({
    key: r.key, label: ml.get(r.key) ?? "—", confirmed: n(r.confirmed), delivered: n(r.delivered), partial: n(r.partial), failed: n(r.failed), returned: n(r.returned), pending: n(r.pending),
    deliveredRate: pct(n(r.delivered), n(r.confirmed)), failRate: pct(n(r.failed) + n(r.returned), n(r.confirmed)),
    avgDays: r.avgDays == null ? null : Math.round(Number(r.avgDays) * 10) / 10, codCollected: n(r.codCollected), codValue: ctx.showMoney ? toReportCurrency(nn(r.codValue), f.currency, rate) : null,
  }));
  const t = out.reduce((a, r) => ({ confirmed: a.confirmed + r.confirmed, delivered: a.delivered + r.delivered, failed: a.failed + r.failed + r.returned }), { confirmed: 0, delivered: 0, failed: 0 });
  return { rows: out, reasons: reasons.map((r) => ({ key: r.key, label: FAILURE_REASON[r.key] ?? (r.key === "unknown" ? "Không rõ lý do" : r.key), n: n(r.n) })), total: { ...t, deliveredRate: pct(t.delivered, t.confirmed), failRate: pct(t.failed, t.confirmed) } };
}

// ---- AI ----

export async function aiReport(u: SessionUser, f: ReportFilter) {
  guard(u, "ai");
  const r = rangeParams(f);
  // ponytail: đọc từng dòng chi phí trong kỳ rồi gộp theo ngày ở JS — đủ cho vài chục nghìn lần chạy/tháng; nhiều hơn thì gộp bằng SQL.
  const [costs, runs, stats] = await Promise.all([
    db.aiCost.findMany({ where: { createdAt: { gte: r.from, lt: r.to } }, select: { createdAt: true, usd: true, inputTokens: true, outputTokens: true } }),
    db.agentRun.groupBy({ by: ["feature", "status"], where: { createdAt: { gte: r.from, lt: r.to } }, _count: { _all: true }, _avg: { ms: true } }),
    can(u.roles, "ai.budget") ? aiStats(u) : null,
  ]);
  const byDay = new Map<string, { runs: number; usd: number; tokens: number }>();
  for (const c of costs) {
    const d = new Date(c.createdAt.getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const x = byDay.get(d) ?? { runs: 0, usd: 0, tokens: 0 };
    byDay.set(d, { runs: x.runs + 1, usd: x.usd + Number(c.usd), tokens: x.tokens + c.inputTokens + c.outputTokens });
  }
  const features = [...new Set(runs.map((x) => x.feature))].map((feature) => {
    const rs = runs.filter((x) => x.feature === feature);
    const total = rs.reduce((a, x) => a + x._count._all, 0);
    const ok = rs.find((x) => x.status === "OK")?._count._all ?? 0;
    const denied = rs.find((x) => x.status === "DENIED")?._count._all ?? 0;
    const errors = rs.find((x) => x.status === "ERROR")?._count._all ?? 0;
    const clarify = rs.find((x) => x.status === "NEEDS_CLARIFICATION")?._count._all ?? 0;
    const ms = rs.reduce((a, x) => a + (x._avg.ms ?? 0) * x._count._all, 0) / (total || 1);
    return { feature, total, ok, denied, errors, clarify, okRate: pct(ok, total), avgMs: Math.round(ms) };
  });
  return { byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })), features, stats };
}

// ---- Xuất Excel: bảng giống hệt bảng trên trang ----

export type Sheet = { name: string; columns: { key: string; header: string; money?: boolean; pct?: boolean }[]; rows: Record<string, unknown>[] };

export async function reportSheets(u: SessionUser, g: ReportGroupKey, f: ReportFilter): Promise<{ title: string; sheets: Sheet[] }> {
  requirePerm(u, "report.export");
  const ctx = await reportContext(u, g, f);
  const cur = ctx.currency;
  const m = (k: string, h: string) => ({ key: k, header: `${h} (${cur})`, money: true });
  switch (g) {
    case "tai-chinh": {
      const d = await financeReport(u, f, ctx);
      return { title: "Tài chính quản trị", sheets: [
        { name: "Doanh thu", columns: [{ key: "label", header: "Nhóm" }, { key: "orders", header: "Số đơn đặt" }, m("rev01", "REV-01"), m("rev02", "REV-02"), m("rev03", "REV-03"), m("rev04", "REV-04"), m("refunds", "Hoàn")], rows: d.rows },
        { name: "Theo nguyên tệ", columns: [{ key: "label", header: "Tiền tệ" }, { key: "orig01", header: "REV-01 nguyên tệ" }, { key: "fx01", header: "Tỷ giá TB đã dùng (VND)" }, m("rev01", "REV-01"), { key: "orig03", header: "REV-03 nguyên tệ" }, m("rev03", "REV-03")], rows: d.byCurrency },
      ] };
    }
    case "sales": {
      const d = await salesReport(u, f);
      return { title: "Bán hàng", sheets: [
        { name: "Theo người phụ trách", columns: [{ key: "label", header: "Người phụ trách" }, { key: "leads", header: "Nhu cầu mua" }, { key: "contacted", header: "Đã liên hệ" }, { key: "contactRate", header: "Tỷ lệ liên hệ %", pct: true }, { key: "won", header: "Đã mua" }, { key: "winRate", header: "Tỷ lệ chốt %", pct: true }, { key: "avgFirstMin", header: "Phản hồi đầu TB (phút)" }, { key: "onTimeRate", header: "Đúng hạn phản hồi %", pct: true }, { key: "overdue", header: "Quá hạn hành động" }], rows: d.rows },
        { name: "Phễu", columns: [{ key: "label", header: "Giai đoạn" }, { key: "n", header: "Số nhu cầu" }], rows: d.stages },
      ] };
    }
    case "khach-hang": {
      const d = await customerReport(u, f, ctx);
      return { title: "Khách hàng", sheets: [
        { name: "RFM", columns: [{ key: "label", header: "Hạng" }, { key: "customers", header: "Khách" }, { key: "share", header: "Tỷ trọng %", pct: true }, m("rev03", "REV-03 12 tháng"), m("grossProfit", "CM-01 12 tháng")], rows: d.rfm },
        { name: "Cohort", columns: [{ key: "cohort", header: "Tháng đầu mua" }, { key: "size", header: "Khách" }, ...[0, 1, 2, 3, 4, 5, 6].map((k) => ({ key: `m${k}`, header: `Tháng ${k} %`, pct: true })), { key: "repeat60Pct", header: "Mua lại 60 ngày % (CUS-03)", pct: true }],
          rows: d.cohort.map((c) => ({ cohort: c.cohort, size: c.size, repeat60Pct: c.repeat60Pct, ...Object.fromEntries(c.retention.map((v, k) => [`m${k}`, v])) })) },
      ] };
    }
    case "marketing": {
      const d = await marketingReport(u, f, ctx);
      return { title: "Marketing", sheets: [
        { name: "Nguồn lead", columns: [{ key: "label", header: "Nguồn" }, { key: "leads", header: "Lead (MKT-01)" }, { key: "won", header: "Đã mua" }, { key: "winRate", header: "Tỷ lệ chốt %", pct: true }], rows: d.sources },
        { name: "Chiến dịch", columns: [{ key: "name", header: "Chiến dịch" }, { key: "channel", header: "Kênh" }, { key: "touchpoints", header: "Điểm chạm" }, { key: "leads", header: "Lead" }, m("cost", "Chi phí"), m("costPerLead", "Chi phí/lead (MKT-02)")], rows: d.campaigns },
      ] };
    }
    case "van-don": {
      const d = await fulfillmentReport(u, f, ctx);
      return { title: "Vận đơn", sheets: [
        { name: "Theo thị trường", columns: [{ key: "label", header: "Thị trường" }, { key: "confirmed", header: "Đơn xác nhận" }, { key: "delivered", header: "Giao thành công" }, { key: "deliveredRate", header: "OPS-01 %", pct: true }, { key: "failed", header: "Thất bại" }, { key: "returned", header: "Hoàn" }, { key: "failRate", header: "OPS-02 %", pct: true }, { key: "avgDays", header: "OPS-03 ngày" }, { key: "codCollected", header: "COD đã thu (đơn)" }, m("codValue", "COD đã thu")], rows: d.rows },
        { name: "Lý do thất bại", columns: [{ key: "label", header: "Lý do (OPS-04)" }, { key: "n", header: "Số lần" }], rows: d.reasons },
      ] };
    }
    case "ai": {
      const d = await aiReport(u, f);
      return { title: "AI", sheets: [
        { name: "Theo tính năng", columns: [{ key: "feature", header: "Tính năng" }, { key: "total", header: "Lượt chạy" }, { key: "okRate", header: "Thành công %", pct: true }, { key: "clarify", header: "Cần làm rõ" }, { key: "denied", header: "Bị từ chối" }, { key: "errors", header: "Lỗi" }, { key: "avgMs", header: "Thời gian TB (ms)" }], rows: d.features },
        { name: "Theo ngày", columns: [{ key: "day", header: "Ngày" }, { key: "runs", header: "Lượt chạy" }, { key: "tokens", header: "Token" }, { key: "usd", header: "Chi phí (USD)" }], rows: d.byDay },
      ] };
    }
    default: throw new HttpError(404, "Không có nhóm báo cáo này");
  }
}

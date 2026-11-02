// Dashboard theo vai (trang /, thiết kế Phase 9): mỗi khối chỉ có khi người xem có quyền tương ứng; số lấy từ cùng hàm của /bao-cao.
import { bindTenant, db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { myQueue } from "@/modules/sales/queue";
import { OPEN_TICKET } from "@/modules/service/labels";
import { addDays, parseReportFilter, pct, todayVN } from "./period";
import { dsum, revenueRows } from "./revenue";
import { customerReport, marketingReport, reportContext, salesReport } from "./service";

export async function dashboardFor(u: SessionUser, now = new Date()) {
  bindTenant(u);
  const today = todayVN(now);
  // 30 ngày gần nhất (không phải "tháng này": đầu tháng sẽ gần như trống).
  const f = parseReportFilter({ from: addDays(today, -29), to: today }, today, "brand_market");
  const finance = can(u.roles, "report.finance") && can(u.roles, "finance.view");
  const [revenue, sales, queue, tickets, reviews, approvals, marketing] = await Promise.all([
    finance ? revenueRows(u, f, "brand_market", null) : null,
    can(u.roles, "report.sales") ? salesReport(u, f, now) : null,
    can(u.roles, "lead.edit") || can(u.roles, "task.manage") ? myQueue(u, now) : null,
    can(u.roles, "ticket.view") ? Promise.all([
      db.ticket.count({ where: { status: { in: OPEN_TICKET }, resolveDueAt: { lt: now } } }),
      db.ticket.count({ where: { status: { in: OPEN_TICKET }, firstRespondedAt: null, firstResponseDueAt: { lt: now } } }),
      db.ticket.count({ where: { status: { in: OPEN_TICKET } } }),
    ]).then(([resolveOverdue, responseOverdue, open]) => ({ resolveOverdue, responseOverdue, open })) : null,
    can(u.roles, "order.link") ? db.orderLinkReview.count({ where: { status: "PENDING" } }) : null,
    can(u.roles, "ai.approve") ? db.approval.count({ where: { status: "PENDING" } }) : null,
    can(u.roles, "report.marketing") ? (async () => {
      const ctx = await reportContext(u, "marketing", f);
      const m = await marketingReport(u, f, ctx, now);
      // Mua lại: 3 cohort gần nhất có thể đo 60 ngày (từ 6 tháng trước).
      const cf = parseReportFilter({ from: `${addMonths(today, -6)}-01`, to: today }, today);
      const cu = can(u.roles, "report.customer") ? await customerReport(u, cf, await reportContext(u, "khach-hang", cf)) : null;
      return { sources: m.sources.slice(0, 5), cohort: cu?.cohort.slice(-4) ?? null };
    })() : null,
  ]);
  const total = revenue ? { rev01: dsum(revenue.map((r) => r.rev01)) ?? 0, rev02: dsum(revenue.map((r) => r.rev02)) ?? 0, rev03: dsum(revenue.map((r) => r.rev03)) ?? 0, rev04: dsum(revenue.map((r) => r.rev04)) ?? 0, orders: revenue.reduce((a, r) => a + r.orders, 0) } : null;
  const alerts = [
    sales && sales.total.overdue ? { tone: "warning" as const, text: `${sales.total.overdue} nhu cầu mua quá hạn hành động`, href: "/nhu-cau?overdue=1" } : null,
    tickets?.responseOverdue ? { tone: "danger" as const, text: `${tickets.responseOverdue} ticket quá hạn phản hồi đầu`, href: "/cham-soc?status=open&overdue=1" } : null,
    reviews ? { tone: "warning" as const, text: `${reviews} cặp đơn nghi trùng chờ xác minh`, href: "/xac-minh" } : null,
    approvals ? { tone: "info" as const, text: `${approvals} thao tác AI chờ duyệt`, href: "/ai?tab=duyet" } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  return {
    period: { from: f.from, to: f.to },
    revenue: revenue && total ? { rows: revenue.filter((r) => r.rev01 || r.rev03), total, r21: pct(total.rev02, total.rev01), r32: pct(total.rev03, total.rev02) } : null,
    sales, queue: queue ? { count: queue.items.length, overdue: queue.overdue } : null, tickets, marketing, alerts,
  };
}
export type Dashboard = Awaited<ReturnType<typeof dashboardFor>>;

function addMonths(ymd: string, n: number) {
  const d = new Date(`${ymd.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

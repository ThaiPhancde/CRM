// Báo cáo bán hàng: phễu theo giai đoạn + kết quả theo người phụ trách (Sales chỉ thấy của mình — reportScope).
import { StatCard } from "@/components/ui";
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import { salesReport, type ReportContext } from "@/modules/reports/service";
import { ReportChart } from "../../report-chart";
import { ReportTable } from "../../report-ui";

export async function SalesSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const d = await salesReport(user, f);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nhu cầu mua tạo trong kỳ" value={d.total.leads.toLocaleString("vi-VN")} hint={d.scope === "self" ? "Của tôi" : "Cả team"} />
        <StatCard label="Liên hệ được" value={d.total.contactRate == null ? "—" : `${d.total.contactRate}%`} hint={`${d.total.contacted.toLocaleString("vi-VN")} đã phản hồi đầu`} />
        <StatCard label="Tỷ lệ chốt" value={d.total.winRate == null ? "—" : `${d.total.winRate}%`} hint={`${d.total.won.toLocaleString("vi-VN")} đã mua`} />
        <StatCard label="Quá hạn hành động" value={d.total.overdue.toLocaleString("vi-VN")} hint="Đang mở, đã qua hạn hành động kế tiếp" />
      </div>
      <div className="rounded-[var(--radius-md)] border border-border bg-bg">
        <ReportChart caption="Phễu nhu cầu mua theo giai đoạn" data={d.stages} x="label" series={[{ key: "n", label: "Số nhu cầu" }]} />
      </div>
      <ReportTable title="Phễu theo giai đoạn" caption="Số nhu cầu mua theo giai đoạn" currency={ctx.currency} rows={d.stages} cols={[{ key: "label", header: "Giai đoạn" }, { key: "n", header: "Số nhu cầu", fmt: "number" }]} />
      <ReportTable title="Kết quả theo người phụ trách" caption="Kết quả bán hàng theo người phụ trách" currency={ctx.currency} rows={d.rows}
        total={{ leads: d.total.leads, contacted: d.total.contacted, contactRate: d.total.contactRate, won: d.total.won, winRate: d.total.winRate, overdue: d.total.overdue }}
        cols={[
          { key: "label", header: "Người phụ trách" },
          { key: "leads", header: "Nhu cầu", fmt: "number" },
          { key: "contacted", header: "Đã liên hệ", fmt: "number" },
          { key: "contactRate", header: "Liên hệ được", fmt: "pct" },
          { key: "avgFirstMin", header: "Phản hồi đầu TB", cell: (r) => (r.avgFirstMin == null ? "—" : `${r.avgFirstMin.toLocaleString("vi-VN")} phút`), align: "right" },
          { key: "onTimeRate", header: "Đúng hạn phản hồi", fmt: "pct" },
          { key: "won", header: "Đã mua", fmt: "number" },
          { key: "winRate", header: "Tỷ lệ chốt", fmt: "pct" },
          { key: "overdue", header: "Quá hạn", fmt: "number" },
        ]} />
    </>
  );
}

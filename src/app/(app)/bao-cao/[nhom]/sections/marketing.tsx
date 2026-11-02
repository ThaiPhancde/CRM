// Báo cáo marketing: lead theo nguồn (MKT-01) + chiến dịch: điểm chạm, lead, chi phí, chi phí/lead (MKT-02).
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import { marketingReport, type ReportContext } from "@/modules/reports/service";
import { ReportChart } from "../../report-chart";
import { Metric, ReportTable } from "../../report-ui";

export async function MarketingSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const d = await marketingReport(user, f, ctx);
  const top = d.sources.slice(0, 5);
  return (
    <>
      <div className="rounded-[var(--radius-md)] border border-border bg-bg">
        <ReportChart caption="Lead và lead đã mua theo nguồn" data={top} x="label" series={[{ key: "leads", label: "Lead" }, { key: "won", label: "Đã mua" }]} />
      </div>
      <ReportTable title={<span className="inline-flex items-center gap-1.5">Lead theo nguồn <Metric code="MKT-01" defs={ctx.definitions} /></span>} caption="Lead theo nguồn" currency={ctx.currency} rows={d.sources}
        cols={[
          { key: "label", header: "Nguồn" },
          { key: "leads", header: "Lead", fmt: "number" },
          { key: "contactRate", header: "Liên hệ được", fmt: "pct" },
          { key: "won", header: "Đã mua", fmt: "number" },
          { key: "winRate", header: "Tỷ lệ chốt", fmt: "pct" },
          { key: "lost", header: "Từ chối / mất liên lạc", fmt: "number" },
        ]} />
      <ReportTable title={<span className="inline-flex items-center gap-1.5">Chiến dịch trong kỳ <Metric code="MKT-02" defs={ctx.definitions} /></span>} caption="Chiến dịch, chi phí và chi phí trên lead" currency={ctx.currency} rows={d.campaigns}
        empty="Không có chiến dịch chạy trong kỳ."
        cols={[
          { key: "name", header: "Chiến dịch" },
          { key: "channel", header: "Kênh" },
          { key: "touchpoints", header: "Điểm chạm", fmt: "number" },
          { key: "leads", header: "Lead", fmt: "number" },
          { key: "cost", header: "Chi phí", fmt: "money" },
          { key: "costPerLead", header: "Chi phí / lead", fmt: "money" },
        ]} />
    </>
  );
}

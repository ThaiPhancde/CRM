// Báo cáo khách hàng: phân bố hạng RFM + giá trị/biên theo hạng; cohort mua lại theo tháng đầu mua (CUS-03).
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import { customerReport, type ReportContext } from "@/modules/reports/service";
import { Card, SectionTitle, cx } from "@/components/ui";
import { ReportChart } from "../../report-chart";
import { Metric, ReportTable } from "../../report-ui";

export async function CustomerSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const d = await customerReport(user, f, ctx);
  return (
    <>
      <div className="rounded-[var(--radius-md)] border border-border bg-bg">
        <ReportChart caption="Số khách theo hạng RFM" data={d.rfm} x="label" series={[{ key: "customers", label: "Khách" }]} />
      </div>
      <ReportTable title={<span className="inline-flex items-center gap-1.5">Hạng RFM (phiên bản đang dùng) <Metric code="CUS-01" defs={ctx.definitions} /></span>} caption="Khách và giá trị theo hạng RFM" currency={ctx.currency} rows={d.rfm}
        cols={[
          { key: "label", header: "Hạng" },
          { key: "customers", header: "Khách", fmt: "number" },
          { key: "share", header: "Tỷ trọng", fmt: "pct" },
          { key: "rev03", header: <span className="inline-flex items-center gap-1.5">REV-03 12 tháng <Metric code="REV-03" defs={ctx.definitions} /></span>, fmt: "money" },
          { key: "grossProfit", header: <span className="inline-flex items-center gap-1.5">Biên cấp 1 <Metric code="CM-01" defs={ctx.definitions} /></span>, fmt: "money" },
          { key: "missingCost", header: "Khách thiếu giá vốn", fmt: "number" },
        ]} />
      <Card>
        <SectionTitle actions={<Metric code="CUS-03" defs={ctx.definitions} />}>Cohort mua lại theo tháng đầu mua</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">% khách của cohort có đơn giao thành công ở tháng thứ k sau tháng đầu mua (tháng 0 = 100%). Ô trống: tháng chưa tới. Cohort bắt đầu trong kỳ đã chọn.</p>
        {d.cohort.length === 0 ? <p className="px-4 py-6 text-sm text-fg-muted">Chưa có khách mua lần đầu trong kỳ — chọn kỳ dài hơn (tối đa 12 tháng).</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Cohort mua lại theo tháng</caption>
              <thead className="bg-bg-subtle text-xs text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4 text-left">Tháng đầu mua</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Khách</th>
                  {[0, 1, 2, 3, 4, 5, 6].map((k) => <th key={k} scope="col" className="h-10 border-b border-border px-3 text-right">T{k}</th>)}
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Mua lại 60 ngày</th>
                </tr>
              </thead>
              <tbody>
                {d.cohort.map((c) => (
                  <tr key={c.cohort} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{c.cohort.split("-").reverse().join("/")}</td>
                    <td className="tabular px-4 py-2 text-right">{c.size.toLocaleString("vi-VN")}</td>
                    {c.retention.map((v, k) => (
                      // Sắc độ cam tăng theo % (thang tuần tự một màu); số luôn hiện, không chỉ dựa vào màu.
                      <td key={k} className={cx("tabular px-3 py-2 text-right", v == null && "text-fg-subtle")}
                        style={v != null && k > 0 ? { background: `color-mix(in oklab, var(--chart-1) ${Math.min(60, Math.round(v * 1.2))}%, transparent)` } : undefined}>
                        {v == null ? "" : `${v.toLocaleString("vi-VN")}%`}
                      </td>
                    ))}
                    <td className="tabular px-4 py-2 text-right font-medium">{c.repeat60Pct == null ? "—" : `${c.repeat60Pct.toLocaleString("vi-VN")}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

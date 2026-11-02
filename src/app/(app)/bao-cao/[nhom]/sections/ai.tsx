// Báo cáo AI: lượt chạy, token, chi phí USD (AI-01), tỷ lệ chấp nhận đề xuất (AI-02) và lượt bị từ chối quyền (AI-03).
import { StatCard } from "@/components/ui";
import type { SessionUser } from "@/lib/session";
import { FEATURE_LABEL, type AiFeatureKey } from "@/modules/ai/labels";
import { pct, type ReportFilter } from "@/modules/reports/period";
import { aiReport, type ReportContext } from "@/modules/reports/service";
import { ReportChart } from "../../report-chart";
import { Metric, ReportTable } from "../../report-ui";

const fmtUsd = (x: number | string) =>
  `${Number(x).toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD`;

export async function AiSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const d = await aiReport(user, f);
  const totalRuns = d.features.reduce((a, r) => a + r.total, 0);
  const totalOk = d.features.reduce((a, r) => a + r.ok, 0);
  const totalClarify = d.features.reduce((a, r) => a + r.clarify, 0);
  const totalDenied = d.features.reduce((a, r) => a + r.denied, 0);
  const okRate = pct(totalOk, totalRuns);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lượt chạy"
          metric="AI-01"
          value={totalRuns.toLocaleString("vi-VN")}
          hint="Tổng lượt gọi trợ lý AI trong kỳ"
        />
        <StatCard
          label="Thành công"
          value={okRate == null ? "—" : `${okRate.toLocaleString("vi-VN")}%`}
          hint={`${totalOk.toLocaleString("vi-VN")} lượt hoàn tất`}
        />
        <StatCard
          label="Cần làm rõ"
          value={totalClarify.toLocaleString("vi-VN")}
          hint="AI yêu cầu bổ sung thông tin"
        />
        <StatCard
          label="Bị từ chối quyền"
          metric="AI-03"
          value={totalDenied.toLocaleString("vi-VN")}
          hint="Chặn bởi phân quyền phía server"
        />
        {d.stats && (
          <>
            <StatCard
              label="Chi phí tháng"
              metric="AI-01"
              value={fmtUsd(d.stats.ai01.usd)}
              hint={`${d.stats.ai01.runs.toLocaleString("vi-VN")} lượt · ${d.stats.ai01.tokens.toLocaleString("vi-VN")} token`}
            />
            <StatCard
              label="Chấp nhận đề xuất"
              metric="AI-02"
              value={`${d.stats.ai02.accepted.toLocaleString("vi-VN")}/${d.stats.ai02.total.toLocaleString("vi-VN")}`}
              hint={
                <span className="inline-flex items-center gap-1">
                  Đề xuất được duyệt <Metric code="AI-02" defs={ctx.definitions} />
                </span>
              }
            />
          </>
        )}
      </div>
      <div className="rounded-[var(--radius-md)] border border-border bg-bg">
        <ReportChart
          kind="line"
          caption="Lượt chạy AI theo ngày"
          data={d.byDay}
          x="day"
          series={[{ key: "runs", label: "Lượt chạy" }]}
        />
      </div>
      <ReportTable
        title={
          <span className="inline-flex items-center gap-1.5">
            Theo ngày <Metric code="AI-01" defs={ctx.definitions} />
          </span>
        }
        caption="Lượt chạy, token và chi phí AI theo ngày"
        currency={ctx.currency}
        rows={d.byDay}
        empty="Không có lượt chạy AI phát sinh chi phí trong kỳ."
        cols={[
          { key: "day", header: "Ngày", cell: (r) => r.day.split("-").reverse().join("/") },
          {
            key: "runs",
            header: (
              <span className="inline-flex items-center justify-end gap-1.5">
                Lượt chạy <Metric code="AI-01" defs={ctx.definitions} />
              </span>
            ),
            fmt: "number",
          },
          { key: "tokens", header: "Token", fmt: "number" },
          { key: "usd", header: "Chi phí (USD)", align: "right", cell: (r) => fmtUsd(r.usd) },
        ]}
      />
      <ReportTable
        title={
          <span className="inline-flex items-center gap-1.5">
            Theo tính năng <Metric code="AI-01" defs={ctx.definitions} /> <Metric code="AI-02" defs={ctx.definitions} />{" "}
            <Metric code="AI-03" defs={ctx.definitions} />
          </span>
        }
        caption="Hiệu quả và kiểm soát quyền AI theo từng tính năng"
        currency={ctx.currency}
        rows={d.features}
        empty="Không có lượt chạy AI theo tính năng trong kỳ."
        cols={[
          { key: "feature", header: "Tính năng", cell: (r) => FEATURE_LABEL[r.feature as AiFeatureKey] ?? r.feature },
          { key: "total", header: "Lượt chạy", fmt: "number" },
          { key: "okRate", header: "Thành công %", fmt: "pct" },
          { key: "clarify", header: "Cần làm rõ", fmt: "number" },
          {
            key: "denied",
            header: (
              <span className="inline-flex items-center justify-end gap-1.5">
                Bị từ chối <Metric code="AI-03" defs={ctx.definitions} />
              </span>
            ),
            fmt: "number",
          },
          { key: "errors", header: "Lỗi", fmt: "number" },
          { key: "avgMs", header: "Thời gian TB (ms)", fmt: "number" },
        ]}
      />
    </>
  );
}

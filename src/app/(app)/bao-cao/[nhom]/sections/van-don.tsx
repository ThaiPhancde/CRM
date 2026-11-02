// Báo cáo vận đơn: tỷ lệ giao thành công (OPS-01), thất bại/hoàn (OPS-02), thời gian giao TB (OPS-03), lý do thất bại (OPS-04) và COD đã thu.
import { StatCard } from "@/components/ui";
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import { fulfillmentReport, type ReportContext } from "@/modules/reports/service";
import { ReportChart } from "../../report-chart";
import { Metric, ReportTable } from "../../report-ui";

export async function FulfillmentSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const d = await fulfillmentReport(user, f, ctx);
  const topReason = d.reasons[0];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Đơn xác nhận" value={d.total.confirmed.toLocaleString("vi-VN")} hint="Đơn xác nhận trong kỳ" />
        <StatCard
          label="Giao thành công"
          metric="OPS-01"
          value={d.total.deliveredRate == null ? "—" : `${d.total.deliveredRate.toLocaleString("vi-VN")}%`}
          hint={`${d.total.delivered.toLocaleString("vi-VN")} đơn đã giao`}
        />
        <StatCard
          label="Thất bại + hoàn"
          metric="OPS-02"
          value={d.total.failRate == null ? "—" : `${d.total.failRate.toLocaleString("vi-VN")}%`}
          hint={`${d.total.failed.toLocaleString("vi-VN")} đơn thất bại / hoàn`}
        />
        <StatCard
          label="Lý do thất bại hàng đầu"
          metric="OPS-04"
          value={topReason?.label ?? "—"}
          hint={topReason ? `${topReason.n.toLocaleString("vi-VN")} lần` : "Không có đơn thất bại trong kỳ"}
        />
      </div>
      <p className="text-xs text-fg-muted">
        Kỳ theo ngày xác nhận đơn; COD đã thu theo trạng thái thanh toán của đơn (đối soát COD ở Phase 10).
      </p>
      <div className="rounded-[var(--radius-md)] border border-border bg-bg">
        <ReportChart
          kind="stacked"
          caption="Trạng thái vận đơn theo thị trường"
          data={d.rows}
          x="label"
          series={[
            { key: "delivered", label: "Giao thành công" },
            { key: "failed", label: "Thất bại" },
            { key: "returned", label: "Hoàn" },
            { key: "pending", label: "Đang xử lý" },
          ]}
        />
      </div>
      <ReportTable
        title="Theo thị trường"
        caption="Kết quả vận đơn và thu hộ COD theo thị trường"
        currency={ctx.currency}
        rows={d.rows}
        empty="Không có đơn xác nhận trong kỳ và phạm vi đã chọn."
        total={{
          confirmed: d.total.confirmed,
          delivered: d.total.delivered,
          deliveredRate: d.total.deliveredRate,
          failRate: d.total.failRate,
        }}
        cols={[
          { key: "label", header: "Thị trường" },
          { key: "confirmed", header: "Đơn xác nhận", fmt: "number" },
          { key: "delivered", header: "Giao thành công", fmt: "number" },
          {
            key: "deliveredRate",
            header: (
              <span className="inline-flex items-center justify-end gap-1.5">
                OPS-01 % <Metric code="OPS-01" defs={ctx.definitions} />
              </span>
            ),
            fmt: "pct",
          },
          { key: "partial", header: "Giao một phần", fmt: "number" },
          { key: "failed", header: "Thất bại", fmt: "number" },
          { key: "returned", header: "Hoàn", fmt: "number" },
          {
            key: "failRate",
            header: (
              <span className="inline-flex items-center justify-end gap-1.5">
                OPS-02 % <Metric code="OPS-02" defs={ctx.definitions} />
              </span>
            ),
            fmt: "pct",
          },
          {
            key: "avgDays",
            header: (
              <span className="inline-flex items-center justify-end gap-1.5">
                Thời gian giao TB <Metric code="OPS-03" defs={ctx.definitions} />
              </span>
            ),
            fmt: "days",
          },
          { key: "codCollected", header: "COD đã thu (đơn)", fmt: "number" },
          { key: "codValue", header: "COD đã thu", fmt: "money" },
        ]}
      />
      <ReportTable
        title={
          <span className="inline-flex items-center gap-1.5">
            Lý do thất bại <Metric code="OPS-04" defs={ctx.definitions} />
          </span>
        }
        caption="Thống kê lý do giao hàng thất bại"
        currency={ctx.currency}
        rows={d.reasons}
        empty="Không có đơn giao thất bại trong kỳ."
        cols={[
          { key: "label", header: "Lý do" },
          { key: "n", header: "Số lần", fmt: "number" },
        ]}
      />
    </>
  );
}

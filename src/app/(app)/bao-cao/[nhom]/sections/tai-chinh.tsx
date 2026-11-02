// Báo cáo tài chính quản trị: REV-01..04 theo nhóm đã chọn, tỷ lệ chuyển mốc, bảng nguyên tệ + tỷ giá bình quân đã dùng.
import { StatCard } from "@/components/ui";
import { money } from "@/lib/format";
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import { financeReport, type ReportContext } from "@/modules/reports/service";
import { codSummary } from "@/modules/fulfillment/cod";
import { ReportChart } from "../../report-chart";
import { Metric, ReportTable } from "../../report-ui";

export async function FinanceSection({ user, f, ctx }: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  const [d, cod] = await Promise.all([financeReport(user, f, ctx), codSummary(user, f, ctx.rate?.rateToBase ?? null)]);
  const cur = ctx.currency;
  const m = (code: string, label: string) => <span className="inline-flex items-center gap-1.5">{label} <Metric code={code} defs={ctx.definitions} /></span>;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Giá trị đặt" metric="REV-01" value={money(d.total.rev01, cur)} hint={`${d.total.orders.toLocaleString("vi-VN")} đơn chưa hủy`} />
        <StatCard label="Giá trị xác nhận" metric="REV-02" value={money(d.total.rev02, cur)} hint={d.ratios.r21 != null ? `${d.ratios.r21}% của REV-01` : undefined} />
        <StatCard label="Giao thành công" metric="REV-03" value={money(d.total.rev03, cur)} hint={d.ratios.r32 != null ? `${d.ratios.r32}% của REV-02 · ${d.total.delivered.toLocaleString("vi-VN")} đơn giao` : undefined} />
        <StatCard label="Thực thu" metric="REV-04" value={money(d.total.rev04, cur)} hint={`Hoàn trong kỳ ${money(d.total.refunds, cur)}`} />
      </div>
      <ReportTable title="REV-01…04 theo nhóm" caption="Doanh thu theo nhóm đã chọn" currency={cur} rows={d.rows} total={d.total}
        cols={[
          { key: "label", header: "Nhóm" },
          { key: "orders", header: "Đơn đặt", fmt: "number" },
          { key: "rev01", header: m("REV-01", "Đặt"), fmt: "money" },
          { key: "rev02", header: m("REV-02", "Xác nhận"), fmt: "money" },
          { key: "rev03", header: m("REV-03", "Giao thành công"), fmt: "money" },
          { key: "rev04", header: m("REV-04", "Thực thu"), fmt: "money" },
          { key: "refunds", header: "Hoàn", fmt: "money" },
        ]}
        actions={<span className="text-xs text-fg-muted">{cur}</span>} />
      {d.rows.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg">
          <ReportChart caption="REV-01 và REV-03 theo nhóm" data={d.rows.slice(0, 24)} x="label" fmt="money" currency={cur} kind={f.group === "month" ? "line" : "bar"}
            series={[{ key: "rev01", label: "REV-01 Đặt" }, { key: "rev03", label: "REV-03 Giao thành công" }]} />
        </div>
      )}
      <ReportTable title="Theo nguyên tệ và tỷ giá đã dùng" caption="Doanh thu theo đồng tiền gốc" currency={cur} rows={d.byCurrency}
        cols={[
          { key: "label", header: "Tiền tệ" },
          { key: "orig01", header: "REV-01 nguyên tệ", cell: (r) => money(r.orig01, r.key) },
          { key: "fx01", header: "Tỷ giá TB đã dùng (₫)", cell: (r) => (r.fx01 == null ? "—" : r.fx01.toLocaleString("vi-VN", { maximumFractionDigits: 2 })), align: "right" },
          { key: "rev01", header: `REV-01 (${cur})`, fmt: "money" },
          { key: "orig03", header: "REV-03 nguyên tệ", cell: (r) => money(r.orig03, r.key) },
          { key: "rev03", header: `REV-03 (${cur})`, fmt: "money" },
        ]} />
      <ReportTable title="COD theo hãng vận chuyển" caption="COD đã thu, đã về trong kỳ và đang kẹt cuối kỳ theo hãng" currency={cur} rows={cod.byCarrier} total={cod.total ?? undefined}
        cols={[
          { key: "key", header: "Hãng" },
          { key: "n01", header: "Vận đơn đã thu", fmt: "number" },
          { key: "cash01", header: m("CASH-01", "Đã thu"), fmt: "money" },
          { key: "cash02", header: m("CASH-02", "Đã về"), fmt: "money" },
          { key: "cash03", header: m("CASH-03", "Đang kẹt cuối kỳ"), fmt: "money" },
          { key: "age61", header: "Kẹt > 60 ngày", fmt: "money" },
        ]}
        empty="Không có COD trong kỳ và phạm vi đã chọn."
        actions={<span className="text-xs text-fg-muted">CASH-02 là phần COD của REV-04; CASH-03 là số tồn tại cuối kỳ</span>} />
    </>
  );
}

// Dashboard theo vai (Phase 9): Quản lý — REV-01..04 brand × thị trường, phễu, SLA, cảnh báo; Sales — hàng đợi + kết quả cá nhân;
// Marketing — nguồn lead + mua lại. Mỗi khối chỉ hiện khi có quyền; số liệu từ cùng hàm với /bao-cao.
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { currentUserOrRedirect } from "@/lib/current-user";
import { base, num } from "@/lib/format";
import { dashboardFor } from "@/modules/reports/dashboard";
import { ReportChart } from "./bao-cao/report-chart";

export default async function HomePage() {
  const user = await currentUserOrRedirect();
  const d = await dashboardFor(user);
  const period = `${d.period.from.split("-").reverse().join("/")} – ${d.period.to.split("-").reverse().join("/")}`;
  const nothing = !d.revenue && !d.sales && !d.queue && !d.tickets && !d.marketing;

  return (
    <>
      <PageHeader title={`Xin chào, ${user.name.split(" ").slice(-1)[0]}`} description={`${user.workspace.name} · 30 ngày gần nhất (${period})`}
        actions={<ButtonLink href="/bao-cao">Mở báo cáo</ButtonLink>} />

      {d.alerts.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2" aria-label="Cảnh báo">
          {d.alerts.map((a) => (
            <li key={a.text}><Link href={a.href} className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-sm hover:border-brand"><Badge tone={a.tone}>!</Badge>{a.text}</Link></li>
          ))}
        </ul>
      )}

      {d.revenue && (
        <section className="mb-6 space-y-4" aria-labelledby="dash-rev">
          <h2 id="dash-rev" className="sr-only">Doanh thu 30 ngày gần nhất</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Giá trị đặt" metric="REV-01" value={base(d.revenue.total.rev01)} hint={`${num(d.revenue.total.orders)} đơn chưa hủy`} href="/bao-cao/tai-chinh" />
            <StatCard label="Xác nhận" metric="REV-02" value={base(d.revenue.total.rev02)} hint={d.revenue.r21 != null ? `${d.revenue.r21}% của REV-01` : undefined} />
            <StatCard label="Giao thành công" metric="REV-03" value={base(d.revenue.total.rev03)} hint={d.revenue.r32 != null ? `${d.revenue.r32}% của REV-02` : undefined} />
            <StatCard label="Thực thu" metric="REV-04" value={base(d.revenue.total.rev04)} hint="Chưa gồm COD đối soát" />
          </div>
          <Card>
            <SectionTitle actions={<Link href="/bao-cao/tai-chinh?group=brand_market" className="text-xs text-fg-muted hover:text-brand">Chi tiết</Link>}>REV-01 và REV-03 theo thương hiệu × thị trường</SectionTitle>
            {d.revenue.rows.length === 0 ? <p className="px-4 py-6 text-sm text-fg-muted">Chưa có đơn trong 30 ngày qua.</p> : (
              <>
                <ReportChart caption="REV-01 và REV-03 theo thương hiệu × thị trường 30 ngày qua" data={d.revenue.rows} x="label" fmt="money" series={[{ key: "rev01", label: "REV-01 Đặt" }, { key: "rev03", label: "REV-03 Giao thành công" }]} height={240} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">REV-01..04 theo thương hiệu và thị trường</caption>
                    <thead className="bg-bg-subtle text-left text-xs text-fg-muted"><tr><th scope="col" className="px-4 py-2">Thương hiệu · thị trường</th><th scope="col" className="px-4 py-2 text-right">Đơn</th><th scope="col" className="px-4 py-2 text-right">REV-01</th><th scope="col" className="px-4 py-2 text-right">REV-02</th><th scope="col" className="px-4 py-2 text-right">REV-03</th><th scope="col" className="px-4 py-2 text-right">REV-04</th></tr></thead>
                    <tbody>{d.revenue.rows.map((r) => (
                      <tr key={r.key} className="border-t border-border"><td className="px-4 py-2">{r.label}</td><td className="tabular px-4 py-2 text-right">{num(r.orders)}</td><td className="tabular px-4 py-2 text-right">{base(r.rev01)}</td><td className="tabular px-4 py-2 text-right">{base(r.rev02)}</td><td className="tabular px-4 py-2 text-right">{base(r.rev03)}</td><td className="tabular px-4 py-2 text-right">{base(r.rev04)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {d.sales && (
          <Card className="xl:col-span-2">
            <SectionTitle actions={<Link href="/bao-cao/sales" className="text-xs text-fg-muted hover:text-brand">Báo cáo bán hàng</Link>}>{d.sales.scope === "self" ? "Kết quả của tôi" : "Phễu nhu cầu mua"}</SectionTitle>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {[["Nhu cầu tạo trong 30 ngày", num(d.sales.total.leads)], ["Liên hệ được", d.sales.total.contactRate == null ? "—" : `${d.sales.total.contactRate}%`], ["Tỷ lệ chốt", d.sales.total.winRate == null ? "—" : `${d.sales.total.winRate}%`], ["Quá hạn hành động", num(d.sales.total.overdue)]].map(([k, v]) => (
                <div key={k} className="bg-bg px-4 py-3"><p className="text-xs text-fg-muted">{k}</p><p className="tabular text-xl font-semibold text-fg">{v}</p></div>
              ))}
            </div>
            {d.sales.total.leads > 0 ? <ReportChart caption="Số nhu cầu mua theo giai đoạn 30 ngày qua" data={d.sales.stages} x="label" series={[{ key: "n", label: "Số nhu cầu" }]} height={200} /> : <p className="px-4 py-6 text-sm text-fg-muted">Chưa có nhu cầu mua trong 30 ngày qua.</p>}
          </Card>
        )}
        <div className="space-y-4">
          {d.queue && (
            <Card>
              <SectionTitle actions={<Link href="/hang-doi" className="text-xs text-fg-muted hover:text-brand">Mở hàng đợi</Link>}>Hàng đợi của tôi</SectionTitle>
              <div className="flex gap-6 px-4 py-3"><div><p className="text-xs text-fg-muted">Việc cần làm</p><p className="tabular text-2xl font-semibold">{num(d.queue.count)}</p></div><div><p className="text-xs text-fg-muted">Đã quá hạn</p><p className="tabular text-2xl font-semibold text-danger">{num(d.queue.overdue)}</p></div></div>
            </Card>
          )}
          {d.tickets && (
            <Card>
              <SectionTitle actions={<Link href="/cham-soc" className="text-xs text-fg-muted hover:text-brand">Ticket</Link>}>SLA chăm sóc</SectionTitle>
              <dl className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
                <div><dt className="text-xs text-fg-muted">Đang mở</dt><dd className="tabular text-xl font-semibold">{num(d.tickets.open)}</dd></div>
                <div><dt className="text-xs text-fg-muted">Quá hạn phản hồi</dt><dd className="tabular text-xl font-semibold text-danger">{num(d.tickets.responseOverdue)}</dd></div>
                <div><dt className="text-xs text-fg-muted">Quá hạn xử lý</dt><dd className="tabular text-xl font-semibold text-warning">{num(d.tickets.resolveOverdue)}</dd></div>
              </dl>
            </Card>
          )}
        </div>
        {d.marketing && (
          <Card className="xl:col-span-3">
            <SectionTitle actions={<Link href="/bao-cao/marketing" className="text-xs text-fg-muted hover:text-brand">Báo cáo marketing</Link>}>Nguồn nhu cầu mua 30 ngày qua và mua lại</SectionTitle>
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              <table className="w-full text-sm">
                <caption className="mb-1 text-left text-xs text-fg-muted">Nhu cầu mua theo nguồn (MKT-01)</caption>
                <thead className="text-left text-xs text-fg-muted"><tr><th scope="col" className="py-1">Nguồn</th><th scope="col" className="py-1 text-right">Nhu cầu mua</th><th scope="col" className="py-1 text-right">Tỷ lệ chốt</th></tr></thead>
                <tbody>{d.marketing.sources.length ? d.marketing.sources.map((s) => <tr key={s.key} className="border-t border-border"><td className="py-1.5">{s.label}</td><td className="tabular py-1.5 text-right">{num(s.leads)}</td><td className="tabular py-1.5 text-right">{s.winRate == null ? "—" : `${s.winRate}%`}</td></tr>) : <tr><td colSpan={3} className="py-3 text-fg-muted">Chưa có nhu cầu mua trong 30 ngày qua.</td></tr>}</tbody>
              </table>
              {d.marketing.cohort && (
                <table className="w-full text-sm">
                  <caption className="mb-1 text-left text-xs text-fg-muted">Mua lại trong 60 ngày theo tháng đầu mua (CUS-03)</caption>
                  <thead className="text-left text-xs text-fg-muted"><tr><th scope="col" className="py-1">Tháng đầu mua</th><th scope="col" className="py-1 text-right">Khách</th><th scope="col" className="py-1 text-right">Mua lại 60 ngày</th></tr></thead>
                  <tbody>{d.marketing.cohort.length ? d.marketing.cohort.map((c) => <tr key={c.cohort} className="border-t border-border"><td className="py-1.5">{c.cohort.split("-").reverse().join("/")}</td><td className="tabular py-1.5 text-right">{num(c.size)}</td><td className="tabular py-1.5 text-right">{c.repeat60Pct == null ? "—" : `${c.repeat60Pct}%`}</td></tr>) : <tr><td colSpan={3} className="py-3 text-fg-muted">Chưa đủ dữ liệu.</td></tr>}</tbody>
                </table>
              )}
            </div>
          </Card>
        )}
      </div>

      {nothing && <EmptyState title="Chưa có khối nào cho vai trò của bạn" description="Dùng menu bên trái để vào màn hình được phân quyền." />}

      <Card className="mt-6">
        <SectionTitle actions={<Badge tone="brand">Bản demo</Badge>}>Chế độ demo</SectionTitle>
        <p className="px-4 py-3 text-sm text-fg-muted">Dữ liệu nguồn phát lại từ dữ liệu mẫu · email/tin nhắn chỉ mô phỏng · không ghi ngược nền tảng bán · phân tích trên PostgreSQL (BigQuery khi lên thật) · AI dùng mô hình phát lại.</p>
      </Card>
    </>
  );
}

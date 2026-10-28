import Link from "next/link";
import { pageUser } from "@/lib/current-user";
import { bindTenant, db } from "@/lib/db";
import { listOrders, parseFilter, type OrderFilter } from "@/modules/orders/service";
import { FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, pickBadge } from "@/lib/status-badge";
import { dateTime, money, num, usd } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await pageUser("order.view");
  bindTenant(user);
  const f = parseFilter(await searchParams);
  const [data, stores, markets] = await Promise.all([
    listOrders(user, f),
    db.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.market.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const qs = (patch: Partial<Record<keyof OrderFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  const filtered = Object.entries(f).some(([k, v]) => k !== "page" && v);

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description="Mỗi đơn kinh doanh có thể gồm nhiều bản ghi nguồn (ví dụ tạo ở Shopify, xử lý ở Pancake) — chỉ tính một lần."
        crumbs={[{ label: "Bán hàng" }, { label: "Đơn hàng" }]}
        actions={<ButtonLink href={`/don-hang/xuat${qs({ page: undefined })}`} prefetch={false}>Xuất CSV</ButtonLink>}
      />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Số đơn (theo bộ lọc)" value={num(data.total)} />
        <StatCard label="Giá trị đặt, quy USD" metric="REV-01" value={data.rev01Usd != null ? usd(data.rev01Usd) : "—"}
          hint={data.rev01Usd != null ? `${num(data.rev01Count)} đơn chưa hủy · tỷ giá chốt theo ngày đặt` : "Cần quyền xem tiền"} />
        <StatCard label="Đơn có nhiều nguồn" value={<Link href={qs({ multi: f.multi ? undefined : "1", page: undefined })} className="hover:text-brand">{f.multi ? "Đang lọc" : "Xem"}</Link>} hint="Đơn được liên kết từ hơn một nền tảng" />
      </div>
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <Filter label="Tìm">
            <input name="q" defaultValue={f.q} placeholder="Mã đơn, tên, SĐT, email…" className="h-8 w-56 rounded-[var(--radius-sm)] border border-border px-2.5 text-sm" />
          </Filter>
          <Filter label="Shop"><Select name="store" value={f.store} options={stores.map((s) => [s.id, s.name])} /></Filter>
          <Filter label="Thị trường"><Select name="market" value={f.market} options={markets.map((m) => [m.id, `${m.code} · ${m.name}`])} /></Filter>
          <Filter label="Trạng thái"><Select name="status" value={f.status} options={Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])} /></Filter>
          <Filter label="Giao hàng"><Select name="fulfillment" value={f.fulfillment} options={Object.entries(FULFILLMENT_STATUS).map(([k, v]) => [k, v.label])} /></Filter>
          <Filter label="Từ ngày"><input type="date" name="from" defaultValue={f.from} className="h-8 rounded-[var(--radius-sm)] border border-border px-2 text-sm" /></Filter>
          <Filter label="Đến ngày"><input type="date" name="to" defaultValue={f.to} className="h-8 rounded-[var(--radius-sm)] border border-border px-2 text-sm" /></Filter>
          {f.multi && <input type="hidden" name="multi" value="1" />}
          <button type="submit" className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">Lọc</button>
          {filtered && <Link href="/don-hang" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">Xóa lọc</Link>}
        </form>

        {data.rows.length === 0 ? (
          filtered ? <EmptyState title="Không có đơn khớp bộ lọc" action={<ButtonLink href="/don-hang">Xóa lọc</ButtonLink>} />
            : <EmptyState title="Chưa có đơn nào" description="Đơn xuất hiện sau khi kết nối dữ liệu chạy đồng bộ." action={<ButtonLink href="/ket-noi" variant="primary">Mở Kết nối dữ liệu</ButtonLink>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách đơn hàng</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  {["Mã đơn", "Ngày đặt", "Khách", "Shop · Thị trường", "Giá trị", "Đơn", "Thanh toán", "Giao hàng", "Nguồn"].map((h, i) => (
                    <th key={h} scope="col" className={`h-10 border-b border-border px-4 whitespace-nowrap ${i === 4 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5"><Link href={`/don-hang/${o.id}`} className="font-medium text-fg hover:text-brand-active">{o.orderNumber}</Link></td>
                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">{dateTime(o.bookedAt)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><p className="text-fg">{o.customerName ?? "—"}</p><p className="tabular text-xs text-fg-subtle">{o.customerPhone}</p></td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><p className="text-fg">{o.store}</p><p className="text-xs text-fg-subtle">{o.market ?? "—"}</p></td>
                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                      {o.net != null ? <><p className="text-fg">{money(o.net, o.currency)}</p><p className="text-xs text-fg-subtle">{usd(o.netUsd)}</p></> : <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-4 py-2.5"><B m={ORDER_STATUS} k={o.status} /></td>
                    <td className="px-4 py-2.5"><B m={PAYMENT_STATUS} k={o.paymentStatus} /></td>
                    <td className="px-4 py-2.5"><B m={FULFILLMENT_STATUS} k={o.fulfillmentStatus} /></td>
                    <td className="px-4 py-2.5"><div className="flex gap-1">{o.sources.map((p, i) => <Badge key={i} tone="info">{p}</Badge>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.total > 0 && (
          <nav aria-label="Phân trang" className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted">
            <span className="tabular">Trang {data.page}/{data.pages} · {num(data.total)} đơn</span>
            <div className="flex gap-2">
              {data.page > 1 ? <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={qs({ page: data.page - 1 })}>‹ Trước</Link> : <span className="px-2.5 py-1 opacity-40">‹ Trước</span>}
              {data.page < data.pages ? <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={qs({ page: data.page + 1 })}>Sau ›</Link> : <span className="px-2.5 py-1 opacity-40">Sau ›</span>}
            </div>
          </nav>
        )}
      </Card>
    </>
  );
}

function B({ m, k }: { m: Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" }>; k: string }) {
  const b = pickBadge(m, k);
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-fg-muted">
      {label}
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value?: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm">
      <option value="">Tất cả</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

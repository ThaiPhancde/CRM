import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/current-user";
import { HttpError } from "@/lib/errors";
import { getOrder } from "@/modules/orders/service";
import { DELIVERY_EVENT, EVENT_OUTCOME, FAILURE_REASON, FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS, pickBadge } from "@/lib/status-badge";
import { dateTime, money, base } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader, SectionTitle, type Tone } from "@/components/ui";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("order.view");
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getOrder>>;
  try {
    data = await getOrder(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { order: o, events, showMoney, pendingReviews } = data;
  const m = (v: string | null) => (showMoney ? money(v, o.currency) : "—");
  const platformOf = new Map(o.links.map((l) => [l.connectionId, l.connection.store.name]));
  const timeline = o.shipments.flatMap((s) => s.events.map((e) => ({ ...e, carrier: s.carrier }))).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));

  return (
    <>
      <PageHeader
        title={`Đơn ${o.orderNumber}`}
        crumbs={[{ label: "Bán hàng" }, { href: "/don-hang", label: "Đơn hàng" }, { label: o.orderNumber }]}
        description={`${o.store.name} · ${o.store.brand.name} · đặt lúc ${dateTime(o.bookedAt)}`}
        actions={pendingReviews > 0 ? <ButtonLink href="/xac-minh" variant="primary">Có {pendingReviews} nghi trùng cần xác minh</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Status label="Đơn" b={pickBadge(ORDER_STATUS, o.status)} />
        <Status label="Thanh toán" b={pickBadge(PAYMENT_STATUS, o.paymentStatus)} />
        <Status label="Giao hàng" b={pickBadge(FULFILLMENT_STATUS, o.fulfillmentStatus)} />
        <Status label="Hoàn/đổi" b={pickBadge(RETURN_STATUS, o.returnStatus)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <SectionTitle>Dòng hàng</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <tr>{["Sản phẩm", "SKU", "Đặt", "Đã giao", "Hoàn", "Đơn giá", "Thành tiền"].map((h, i) => <th key={h} scope="col" className={`h-9 px-4 font-medium ${i >= 2 ? "text-right" : ""}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <p className="text-fg">{i.variant?.product.name ?? i.name}</p>
                        {!i.variant && <p className="text-xs text-warning">Chưa khớp sản phẩm trong danh mục</p>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-fg-muted">{i.sourceSku}</td>
                      <td className="tabular px-4 py-2.5 text-right">{i.qty}</td>
                      <td className="tabular px-4 py-2.5 text-right">{i.qtyDelivered}</td>
                      <td className={`tabular px-4 py-2.5 text-right ${i.qtyReturned ? "text-danger" : ""}`}>{i.qtyReturned}</td>
                      <td className="tabular px-4 py-2.5 text-right">{m(i.unitPrice)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{m(i.lineAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showMoney && (
              <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-sm">
                <dt className="text-fg-muted">Tiền hàng</dt><dd className="tabular text-right">{m(o.grossAmount)}</dd>
                <dt className="text-fg-muted">Giảm giá</dt><dd className="tabular text-right">{Number(o.discount) ? `−${m(o.discount)}` : m(o.discount)}</dd>
                <dt className="text-fg-muted">Phí vận chuyển</dt><dd className="tabular text-right">{m(o.shippingFee)}</dd>
                <dt className="font-medium text-fg">Giá trị đơn</dt><dd className="tabular text-right font-semibold">{m(o.netAmount)}</dd>
                <dt className="text-fg-muted">Quy VND <span className="text-[11px]">(REV-01)</span></dt><dd className="tabular text-right">{base(o.netBase)}</dd>
                <dt className="text-xs text-fg-subtle">Tỷ giá chốt</dt><dd className="tabular text-right text-xs text-fg-subtle">1 {o.currency} = {Number(o.fxRate).toLocaleString("vi-VN", { maximumFractionDigits: 8 })} VND</dd>
              </dl>
            )}
          </Card>

          <Card>
            <SectionTitle>Giao hàng</SectionTitle>
            {timeline.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-muted">Chưa có sự kiện vận chuyển.</p>
            ) : (
              <ol className="px-4 py-3">
                {timeline.map((e, k) => (
                  <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {k < timeline.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-border" />}
                    <span aria-hidden className={`mt-1.5 size-[11px] shrink-0 rounded-full border-2 ${e.type === "DELIVERED" || e.type === "COD_COLLECTED" ? "border-success bg-success-soft" : e.type === "FAILED" || e.type === "RETURNED" ? "border-danger bg-danger-soft" : "border-border-strong bg-bg"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{DELIVERY_EVENT[e.type] ?? e.type}{e.reasonCode && <span className="font-normal text-fg-muted"> · {FAILURE_REASON[e.reasonCode] ?? e.reasonCode}</span>}</p>
                      <p className="tabular text-xs text-fg-muted">{dateTime(e.occurredAt)} · {e.carrier ?? "—"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <SectionTitle>Nhật ký bản ghi nguồn</SectionTitle>
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                  <Badge tone={pickBadge(EVENT_OUTCOME, e.outcome).tone}>{pickBadge(EVENT_OUTCOME, e.outcome).label}</Badge>
                  <span className="text-fg">{platformOf.get(e.connectionId) ?? "nguồn"}</span>
                  <span className="text-fg-muted">phiên bản cập nhật lúc</span>
                  <span className="tabular text-fg">{dateTime(e.sourceUpdatedAt)}</span>
                  <span className="tabular ml-auto text-xs text-fg-subtle">nhận {dateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-4 py-2 text-xs text-fg-subtle">Bản trùng (gửi lặp) không tạo dòng mới; bản cũ đến muộn hiện là “Bản cũ, bỏ qua” và không ghi đè.</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Khách hàng</SectionTitle>
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Row k="Tên" v={o.customerName} />
              <Row k="SĐT" v={o.customerPhone} />
              <Row k="Email" v={o.customerEmail} />
              <Row k="Giao tới" v={o.market ? `${o.market.code} · ${o.market.name}` : o.shipCountry} />
            </dl>
            <p className="border-t border-border px-4 py-2 text-xs text-fg-subtle">Hồ sơ khách hợp nhất (Customer 360) có ở Phase 3.</p>
          </Card>
          <Card>
            <SectionTitle>Nguồn liên kết ({o.links.length})</SectionTitle>
            <ul className="divide-y divide-border">
              {o.links.map((l) => (
                <li key={l.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{l.platform}</Badge>
                    {l.isPrimary ? <Badge tone="brand">Nguồn tạo đơn</Badge> : <Badge>Nguồn liên kết</Badge>}
                  </div>
                  <p className="mt-1.5 text-fg">{l.connection.store.name}</p>
                  <p className="font-mono text-xs break-all text-fg-muted">{l.sourceRecordId}</p>
                  <p className="mt-1 text-xs text-fg-muted">Trạng thái gốc: <span className="font-mono">{l.sourceStatusRaw}</span></p>
                  <p className="text-xs text-fg-muted">Cập nhật ở nguồn: {dateTime(l.sourceUpdatedAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
          {showMoney && (o.payments.length > 0 || o.refunds.length > 0) && (
            <Card>
              <SectionTitle>Thanh toán & hoàn tiền</SectionTitle>
              <ul className="divide-y divide-border text-sm">
                {o.payments.map((p) => <li key={p.id} className="flex justify-between px-4 py-2"><span className="text-fg-muted">{p.method} · {dateTime(p.paidAt)}</span><span className="tabular">{money(p.amount, o.currency)}</span></li>)}
                {o.refunds.map((r) => <li key={r.id} className="flex justify-between px-4 py-2 text-danger"><span>Hoàn · {dateTime(r.refundedAt)}</span><span className="tabular">−{money(r.amount, o.currency)}</span></li>)}
              </ul>
            </Card>
          )}
          <p className="px-1 text-xs text-fg-subtle"><Link href="/don-hang" className="hover:text-fg-muted">‹ Về danh sách đơn</Link></p>
        </div>
      </div>
    </>
  );
}

function Status({ label, b }: { label: string; b: { label: string; tone: Tone } }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-bg px-2.5 py-1.5 text-xs text-fg-muted">
      {label}: <Badge tone={b.tone}>{b.label}</Badge>
    </span>
  );
}
function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="text-right text-fg">{v || "—"}</dd>
    </div>
  );
}

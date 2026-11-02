// /van-don (Phase 10, D-58): đơn cần can thiệp (giao thất bại theo lý do chuẩn hóa), COD bốn mốc theo hãng (CASH-01/02/03), đối soát dán bảng.
import Link from "next/link";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/current-user";
import { bindTenant, db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ago, base, date, dateTime, money, num } from "@/lib/format";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from "@/components/ui";
import { codCarriers, codSummary, OUTSTANDING_PAGE, outstandingCod, recentSettlements } from "@/modules/fulfillment/cod";
import { FAULT_LABEL, type Fault } from "@/modules/fulfillment/reasons";
import { interventionFilter, listInterventions } from "@/modules/fulfillment/service";
import { parseReportFilter, todayVN } from "@/modules/reports/period";
import { DeliveryAction } from "./delivery-action";
import { SettlementForm } from "./settlement-form";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const FAULT_TONE: Record<Fault, Tone> = { customer: "warning", carrier: "info", other: "neutral" };
const field = "h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg";

export default async function FulfillmentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageUser("fulfillment.view");
  bindTenant(user);
  const sp = await searchParams;
  const canReconcile = can(user.roles, "cod.reconcile");
  const tabs: [string, string][] = [["can-thiep", "Cần can thiệp"], ["cod", "COD bốn mốc"], ...(canReconcile ? [["doi-soat", "Đối soát"] as [string, string]] : [])];
  const tab = tabs.some(([k]) => k === one(sp.tab)) ? one(sp.tab)! : "can-thiep";

  return (
    <>
      <PageHeader title="Vận đơn" crumbs={[{ label: "Bán hàng" }, { label: "Vận đơn" }]}
        description="Đơn giao thất bại cần xử lý, tiền COD theo bốn mốc (đặt → giao → thu → về) và đối soát với hãng. CRM chỉ ghi yêu cầu, không ghi ngược POS hay hãng vận chuyển." />
      <nav aria-label="Chuyên mục vận đơn" className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/van-don?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={cx("rounded-[var(--radius-sm)] px-2.5 py-1 text-sm", tab === k ? "bg-brand-soft font-medium text-brand" : "text-fg-muted hover:bg-bg-subtle")}>{label}</Link>
        ))}
      </nav>
      {tab === "can-thiep" && <Interventions sp={sp} user={user} />}
      {tab === "cod" && <Cod sp={sp} user={user} />}
      {tab === "doi-soat" && canReconcile && <Reconcile user={user} />}
    </>
  );
}

type U = Awaited<ReturnType<typeof pageUser>>;

async function Interventions({ sp, user }: { sp: SP; user: U }) {
  const f = interventionFilter.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, one(v)])));
  const [data, stores, markets, carriers] = await Promise.all([
    listInterventions(user, f),
    db.store.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.market.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    db.shipment.findMany({ where: { status: "FAILED", carrier: { not: null } }, select: { carrier: true }, distinct: ["carrier"], orderBy: { carrier: "asc" } }),
  ]);
  const canAct = can(user.roles, "fulfillment.manage");
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams({ tab: "can-thiep" });
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    return `/van-don?${p}`;
  };
  const faults = (["customer", "carrier", "other"] as Fault[]).map((x) => ({ fault: x, n: data.byReason.filter((r) => r.fault === x).reduce((s, r) => s + r.n, 0) }));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = !!(f.reason || f.fault || f.carrier || f.store || f.market || f.q);
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Đơn cần can thiệp" value={num(data.byReason.reduce((s, r) => s + r.n, 0))} hint="Giao thất bại, chưa ai xử lý lần thất bại gần nhất" />
        {faults.map((x) => <StatCard key={x.fault} label={`Lý do ${FAULT_LABEL[x.fault].toLowerCase()}`} value={num(x.n)} href={qs({ fault: x.fault, reason: undefined, page: 1 })}
          hint={x.fault === "customer" ? "Tính vào rủi ro giao dịch của khách" : x.fault === "carrier" ? "Không tính vào điểm khách" : undefined} />)}
      </div>
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3" role="group" aria-label="Lọc theo lý do">
          <Chip href={qs({ reason: undefined, fault: undefined, page: 1 })} active={!f.reason && !f.fault}>Tất cả</Chip>
          {data.byReason.map((r) => <Chip key={r.reason} href={qs({ reason: r.reason, fault: undefined, page: 1 })} active={f.reason === r.reason}>{r.label} <span className="tabular text-fg-subtle">{num(r.n)}</span></Chip>)}
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <input type="hidden" name="tab" value="can-thiep" />
          {f.reason && <input type="hidden" name="reason" value={f.reason} />}
          {f.fault && <input type="hidden" name="fault" value={f.fault} />}
          <Filter label="Tìm"><input name="q" defaultValue={f.q} placeholder="Mã đơn hoặc mã vận đơn" className={cx(field, "w-56 px-2.5 placeholder:text-fg-subtle")} /></Filter>
          <Filter label="Hãng"><select name="carrier" defaultValue={f.carrier ?? ""} className={field}><option value="">Tất cả</option>{carriers.map((c) => <option key={c.carrier} value={c.carrier!}>{c.carrier}</option>)}</select></Filter>
          <Filter label="Shop"><select name="store" defaultValue={f.store ?? ""} className={field}><option value="">Tất cả</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Filter>
          <Filter label="Thị trường"><select name="market" defaultValue={f.market ?? ""} className={field}><option value="">Tất cả</option>{markets.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select></Filter>
          <button type="submit" className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">Lọc</button>
          <Link href="/van-don?tab=can-thiep" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">Đặt lại</Link>
        </form>
        {data.rows.length === 0 ? (
          filtered ? <EmptyState title="Không có đơn khớp bộ lọc" action={<ButtonLink href="/van-don?tab=can-thiep">Đặt lại</ButtonLink>} />
            : <EmptyState icon="✓" title="Không có đơn nào cần can thiệp" description="Mọi lần giao thất bại đã có người xử lý. Đơn thất bại mới sẽ hiện ở đây." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Đơn giao thất bại cần can thiệp, thất bại lâu nhất lên đầu</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle text-left text-xs text-fg-muted">
                <tr>{["Đơn", "Khách", "Vận đơn", "Lý do", "Thất bại", ...(data.rows.some((r) => r.amount) ? ["Giá trị"] : []), ...(canAct ? [""] : [])].map((h, i) => <th key={i} scope="col" className="h-10 px-4 font-medium whitespace-nowrap">{h || <span className="sr-only">Thao tác</span>}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={`${r.orderId}-${r.trackingNo}`} className="border-t border-border align-top hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link href={`/don-hang/${r.orderId}`} className="font-medium text-fg hover:text-brand-active">{r.orderNumber}</Link>
                      <p className="text-xs text-fg-muted">{r.store}{r.market ? ` · ${r.market}` : ""}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.customerId ? <Link href={`/khach-hang/${r.customerId}`} className="text-fg hover:text-brand-active">{r.customerName ?? "—"}</Link> : <span className="text-fg">{r.customerName ?? "—"}</span>}
                      <p className="tabular text-xs text-fg-muted">{r.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><p className="text-fg">{r.carrier ?? "—"}</p><p className="font-mono text-xs text-fg-muted">{r.trackingNo ?? "—"}</p></td>
                    <td className="px-4 py-2.5">
                      <Badge tone={FAULT_TONE[r.fault]}>{r.reasonLabel}</Badge>
                      <p className="mt-0.5 text-xs text-fg-subtle">{FAULT_LABEL[r.fault]}{r.priorActions ? ` · đã xử lý ${r.priorActions} lần trước` : ""}</p>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><p className="text-fg" title={dateTime(r.failedAt)}>{ago(r.failedAt)}</p><p className="tabular text-xs text-fg-subtle">{date(r.failedAt)}</p></td>
                    {data.rows.some((x) => x.amount) && <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">{r.amount ? money(r.amount, r.currency) : "—"}</td>}
                    {canAct && <td className="px-4 py-2.5 text-right"><DeliveryAction orderId={r.orderId} orderNumber={r.orderNumber} reasonLabel={r.reasonLabel} carrierFault={r.fault === "carrier"} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.total > data.pageSize && <Pager page={data.page} pages={pages} total={data.total} unit="vận đơn" prev={qs({ page: data.page - 1 })} next={qs({ page: data.page + 1 })} />}
      </Card>
      <p className="mt-4 text-xs text-fg-muted">Lý do thuộc khách (từ chối nhận, không liên lạc được, sai địa chỉ) mới tính vào rủi ro giao dịch; lỗi hãng vận chuyển không làm xấu điểm khách (Q-27). Giao lại / hủy ghi yêu cầu ở hàng đợi gửi đi (chế độ giả lập).</p>
    </>
  );
}

async function Cod({ sp, user }: { sp: SP; user: U }) {
  const today = todayVN();
  const f = parseReportFilter({ from: one(sp.from), to: one(sp.to) }, today, "none");
  const page = Math.max(1, Math.min(10000, Number(one(sp.page)) || 1));
  const carrier = one(sp.carrier) || undefined;
  const [sum, out] = await Promise.all([codSummary(user, f, null), outstandingCod(user, { carrier, page })]);
  const m = (v: number | null) => (sum.showMoney ? base(v) : "—");
  const pages = Math.max(1, Math.ceil(out.total / OUTSTANDING_PAGE));
  const t = sum.total;
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams({ tab: "cod", from: f.from, to: f.to });
    for (const [k, v] of Object.entries({ carrier, page, ...patch })) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    return `/van-don?${p}`;
  };
  return (
    <>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="cod" />
        <Filter label="Từ ngày"><input type="date" name="from" defaultValue={f.from} className={field} /></Filter>
        <Filter label="Đến ngày"><input type="date" name="to" defaultValue={f.to} className={field} /></Filter>
        <button type="submit" className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">Xem</button>
        <p className="ml-auto text-xs text-fg-muted">Kỳ theo ngày UTC; tiền quy VND theo tỷ giá chốt của đơn (D-44).{!sum.showMoney && " Số tiền ẩn — cần quyền xem tiền."}</p>
      </form>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="COD đã thu trong kỳ" metric="CASH-01" value={m(t?.cash01 ?? 0)} hint={`${num(t?.n01 ?? 0)} vận đơn`} />
        <StatCard label="COD đã về trong kỳ" metric="CASH-02" value={m(t?.cash02 ?? 0)} hint={`${num(t?.n02 ?? 0)} vận đơn · tính vào REV-04`} />
        <StatCard label="COD đang kẹt cuối kỳ" metric="CASH-03" value={m(t?.cash03 ?? 0)} hint={`${num(t?.n03 ?? 0)} vận đơn đã thu chưa về`} />
      </div>
      <Card className="mb-6">
        <SectionTitle>Theo hãng vận chuyển</SectionTitle>
        {sum.byCarrier.length === 0 ? <p className="px-4 py-6 text-sm text-fg-muted">Không có COD nào trong kỳ.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">COD theo hãng: đã thu, đã về trong kỳ và đang kẹt chia theo tuổi</caption>
              <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
                <tr>{["Hãng", "Đã thu (CASH-01)", "Đã về (CASH-02)", "Đang kẹt (CASH-03)", "≤ 15 ngày", "16–30 ngày", "31–60 ngày", "> 60 ngày"].map((h, i) => <th key={h} scope="col" className={cx("h-10 px-4 font-medium whitespace-nowrap", i > 0 && "text-right")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sum.byCarrier.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-fg"><Link href={qs({ carrier: r.key, page: 1 })} className="hover:text-brand-active">{r.key}</Link></td>
                    <Num v={m(r.cash01)} sub={`${num(r.n01)} vđ`} /><Num v={m(r.cash02)} sub={`${num(r.n02)} vđ`} /><Num v={m(r.cash03)} sub={`${num(r.n03)} vđ`} strong />
                    <Num v={m(r.age15)} /><Num v={m(r.age30)} /><Num v={m(r.age60)} /><Num v={m(r.age61)} warn={!!r.age61} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sum.showMoney && sum.byCurrency.length > 1 && (
          <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">Nguyên tệ: {sum.byCurrency.map((c) => `${c.key} thu ${num(c.orig01 ?? 0)} · về ${num(c.orig02 ?? 0)} · kẹt ${num(c.orig03 ?? 0)}`).join(" | ")}</p>
        )}
      </Card>
      <Card>
        <SectionTitle actions={carrier ? <Link href={qs({ carrier: undefined, page: 1 })} className="text-xs text-fg-muted hover:text-fg">Bỏ lọc hãng {carrier}</Link> : undefined}>COD đã thu, chưa về tiền</SectionTitle>
        {out.rows.length === 0 ? <EmptyState icon="✓" title="Không có COD nào đang kẹt" description="Mọi vận đơn đã thu tiền đều đã có trong bảng đối soát." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Vận đơn COD đã thu chưa về tiền, thu lâu nhất lên đầu</caption>
              <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
                <tr>{["Đơn", "Hãng", "Mã vận đơn", "Đã thu", "Số ngày", "Tiền COD"].map((h, i) => <th key={h} scope="col" className={cx("h-10 px-4 font-medium whitespace-nowrap", i >= 4 && "text-right")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {out.rows.map((r) => (
                  <tr key={`${r.orderId}-${r.trackingNo}`} className="border-t border-border">
                    <td className="px-4 py-2.5"><Link href={`/don-hang/${r.orderId}`} className="font-medium text-fg hover:text-brand-active">{r.orderNumber}</Link></td>
                    <td className="px-4 py-2.5 text-fg">{r.carrier ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-muted">{r.trackingNo ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-fg-muted">{date(r.collectedAt)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{r.days > 60 ? <Badge tone="danger">{r.days}</Badge> : r.days > 30 ? <Badge tone="warning">{r.days}</Badge> : r.days}</td>
                    <td className="tabular px-4 py-2.5 text-right">{r.codAmount ? money(r.codAmount, r.currency) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {out.total > OUTSTANDING_PAGE && <Pager page={page} pages={pages} total={out.total} unit="vận đơn" prev={qs({ page: page - 1 })} next={qs({ page: page + 1 })} />}
      </Card>
    </>
  );
}

async function Reconcile({ user }: { user: U }) {
  const [carriers, recent] = await Promise.all([codCarriers(user), recentSettlements(user)]);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <SectionTitle>Nhập bảng đối soát COD</SectionTitle>
        <SettlementForm carriers={carriers} />
      </Card>
      <Card className="xl:col-span-2">
        <SectionTitle>Bảng đối soát gần đây</SectionTitle>
        {recent.length === 0 ? <p className="px-4 py-6 text-sm text-fg-muted">Chưa nhập bảng đối soát nào.</p> : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="px-4 py-2.5 text-sm">
                <p className="flex flex-wrap items-center gap-2"><span className="font-medium text-fg">{r.reference}</span><Badge>{r.carrier}</Badge><span className="tabular ml-auto text-xs text-fg-muted">{num(r.lines)} vận đơn</span></p>
                <p className="tabular text-xs text-fg-muted">Về {r.from ? date(r.from) : "—"}{r.to && r.to !== r.from ? ` – ${date(r.to)}` : ""}{r.totals ? ` · ${r.totals.map((x) => money(x.amount, x.currency)).join(" + ")}` : ""}</p>
                <p className="text-xs text-fg-subtle">{r.by} · nhập {dateTime(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link href={href} aria-current={active ? "true" : undefined} className={cx("rounded-full border px-2.5 py-0.5 text-xs", active ? "border-brand bg-brand-soft font-medium text-brand" : "border-border text-fg-muted hover:bg-bg-subtle")}>{children}</Link>;
}
function Filter({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-fg-muted">{label}{children}</label>;
}
function Num({ v, sub, strong, warn }: { v: string; sub?: string; strong?: boolean; warn?: boolean }) {
  return <td className={cx("tabular px-4 py-2.5 text-right whitespace-nowrap", strong && "font-medium text-fg", warn && "text-danger")}>{v}{sub && <p className="text-xs font-normal text-fg-subtle">{sub}</p>}</td>;
}
function Pager({ page, pages, total, unit, prev, next }: { page: number; pages: number; total: number; unit: string; prev: string; next: string }) {
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted">
      <span className="tabular">Trang {page}/{pages} · {num(total)} {unit}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={prev}>‹ Trước</Link> : <span className="px-2.5 py-1 opacity-40">‹ Trước</span>}
        {page < pages ? <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={next}>Sau ›</Link> : <span className="px-2.5 py-1 opacity-40">Sau ›</span>}
      </div>
    </nav>
  );
}

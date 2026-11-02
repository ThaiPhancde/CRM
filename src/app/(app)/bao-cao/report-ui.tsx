// Khung trang báo cáo (server): thanh lọc GET, dải thông tin kỳ/phạm vi/tiền tệ/độ mới, mã chỉ số có định nghĩa khi rê chuột, bảng dùng chung.
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, Card, cx, PageHeader, SectionTitle } from "@/components/ui";
import { dateTime, money, num } from "@/lib/format";
import type { ReportFilter } from "@/modules/reports/period";
import type { ReportContext, ReportGroupKey } from "@/modules/reports/service";

export const GROUP_LABEL: Record<ReportGroupKey, string> = { sales: "Bán hàng", "khach-hang": "Khách hàng", marketing: "Marketing", "van-don": "Vận đơn", "tai-chinh": "Tài chính quản trị", ai: "AI" };
const GROUP_BY_LABEL: Record<string, string> = { none: "Tổng", market: "Thị trường", brand: "Brand", store: "Shop", month: "Tháng", currency: "Tiền tệ", brand_market: "Brand × thị trường" };

/** Mã chỉ số có định nghĩa (từ điển chỉ số) khi rê chuột / đọc màn hình. */
export function Metric({ code, defs }: { code: string; defs: Record<string, string> }) {
  return <abbr title={defs[code] ?? code} className="cursor-help font-mono text-[11px] font-medium text-fg-muted no-underline decoration-dotted hover:underline">{code}</abbr>;
}

export function qsOf(f: ReportFilter, patch: Record<string, string | null | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ from: f.from, to: f.to, brand: f.brand, store: f.store, market: f.market, currency: f.currency === "VND" ? null : f.currency, group: f.group, ...patch })) if (v) p.set(k, v);
  return `?${p.toString()}`;
}

export function ReportShell({ group, f, ctx, description, groupBy, notes, children }: {
  group: ReportGroupKey; f: ReportFilter; ctx: ReportContext; description: string; groupBy?: string[]; notes?: ReactNode; children: ReactNode;
}) {
  const sel = "h-8 max-w-44 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm";
  const scopeText = [ctx.brands.find((b) => b.id === f.brand)?.code, ctx.stores.find((s) => s.id === f.store)?.name, ctx.markets.find((m) => m.id === f.market)?.code].filter(Boolean).join(" · ") || "Mọi brand, shop, thị trường";
  return (
    <>
      <PageHeader title={GROUP_LABEL[group]} crumbs={[{ href: "/bao-cao", label: "Báo cáo" }, { label: GROUP_LABEL[group] }]} description={description}
        actions={ctx.canExport ? <ButtonLink href={`/bao-cao/${group}/xuat${qsOf(f)}`} download>Xuất Excel</ButtonLink> : undefined} />
      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-2 px-4 py-3">
          <F label="Từ ngày"><input type="date" name="from" defaultValue={f.from} className={sel} /></F>
          <F label="Đến ngày"><input type="date" name="to" defaultValue={f.to} className={sel} /></F>
          <F label="Brand"><select name="brand" defaultValue={f.brand ?? ""} className={sel}><option value="">Tất cả</option>{ctx.brands.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></F>
          <F label="Shop"><select name="store" defaultValue={f.store ?? ""} className={sel}><option value="">Tất cả</option>{ctx.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></F>
          <F label="Thị trường"><select name="market" defaultValue={f.market ?? ""} className={sel}><option value="">Tất cả</option>{ctx.markets.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select></F>
          <F label="Tiền tệ báo cáo"><select name="currency" defaultValue={ctx.currency} className={sel}>{ctx.currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select></F>
          {groupBy && <F label="Nhóm theo"><select name="group" defaultValue={f.group} className={sel}>{groupBy.map((g) => <option key={g} value={g}>{GROUP_BY_LABEL[g]}</option>)}</select></F>}
          <button type="submit" className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm font-medium hover:bg-bg-subtle">Xem</button>
          <Link href={`/bao-cao/${group}`} className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-brand">Đặt lại</Link>
        </form>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-bg-subtle px-4 py-2 text-xs text-fg-muted">
          <div><dt className="inline">Kỳ: </dt><dd className="inline font-medium text-fg">{f.from.split("-").reverse().join("/")} – {f.to.split("-").reverse().join("/")}</dd> (ngày UTC, mỗi chỉ số theo mốc của nó)</div>
          <div><dt className="inline">Phạm vi: </dt><dd className="inline font-medium text-fg">{ctx.scope === "self" ? "Của tôi" : scopeText}</dd></div>
          <div><dt className="inline">Tiền tệ: </dt><dd className="inline font-medium text-fg">{ctx.currency}{ctx.rate ? ` · 1 ${ctx.rate.currency} = ${num(ctx.rate.rateToBase)} ₫ (tỷ giá hiệu lực ${ctx.rate.validFrom.split("-").reverse().join("/")})` : " (quy đổi theo tỷ giá chốt của từng đơn, D-44)"}</dd></div>
          <div><dt className="inline">Độ mới: </dt><dd className="inline font-medium text-fg">đơn/lead trực tiếp; chỉ số R12M {ctx.freshness ? dateTime(ctx.freshness) : "chưa dựng"}</dd></div>
          {!ctx.showMoney && <div className="text-warning">Số tiền ẩn — cần quyền xem tiền</div>}
        </dl>
        {notes && <div className="border-t border-border px-4 py-2 text-xs text-fg-muted">{notes}</div>}
      </Card>
      <div className="space-y-4">{children}</div>
    </>
  );
}
function F({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-fg-muted">{label}{children}</label>;
}

export type Col<T> = { key: string; header: ReactNode; cell?: (r: T) => ReactNode; fmt?: "money" | "number" | "pct" | "days"; align?: "right" };

/** Bảng số liệu dùng chung (cũng là "bảng xem" của biểu đồ phía trên). */
export function ReportTable<T extends Record<string, unknown>>({ title, caption, rows, cols, currency, total, empty = "Không có dữ liệu trong kỳ và phạm vi đã chọn.", actions }: {
  title: ReactNode; caption: string; rows: T[]; cols: Col<T>[]; currency: string; total?: Partial<Record<string, unknown>>; empty?: string; actions?: ReactNode;
}) {
  const fmt = (c: Col<T>, v: unknown) => (v == null ? "—" : c.fmt === "money" ? money(v as number, currency) : c.fmt === "pct" ? `${Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : c.fmt === "days" ? `${Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ngày` : c.fmt === "number" ? num(Number(v)) : String(v));
  const right = (c: Col<T>) => c.align === "right" || (c.fmt && c.fmt !== undefined);
  return (
    <Card>
      <SectionTitle actions={actions}>{title}</SectionTitle>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-fg-muted">{empty}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
              <tr>{cols.map((c) => <th key={c.key} scope="col" className={cx("h-10 border-b border-border px-4 whitespace-nowrap", right(c) && "text-right")}>{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={String(r.key ?? i)} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                  {cols.map((c) => <td key={c.key} className={cx("tabular px-4 py-2 whitespace-nowrap", right(c) && "text-right")}>{c.cell ? c.cell(r) : fmt(c, r[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
            {total && (
              <tfoot className="bg-bg-subtle font-medium">
                <tr>{cols.map((c, i) => <td key={c.key} className={cx("tabular px-4 py-2 whitespace-nowrap", right(c) && "text-right")}>{i === 0 ? "Tổng" : c.key in total ? fmt(c, total[c.key]) : ""}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Drawer, useToast } from "@/components/overlay";
import { CheckboxGroup, FormError, pick, SelectField, Switch, TextField, type ActionResult } from "@/components/form";
import { Badge, Button, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { saveCatalogAction } from "../actions";

export type Tab = "brand" | "store" | "market" | "team" | "fxRate";
type Brand = { id: string; code: string; name: string; active: boolean; stores: number };
type Store = { id: string; code: string; name: string; active: boolean; platform: string; externalId: string | null; brandId: string; brandName: string; marketIds: string[]; marketCodes: string[] };
type Market = { id: string; code: string; name: string; active: boolean; currency: string; paymentMode: "PREPAID" | "COD"; timezone: string; locale: string };
type TeamRow = { id: string; code: string; name: string; active: boolean; members: number };
type Fx = { id: string; currency: string; rateToBase: string; validFrom: string };
type Props = { tab: Tab; brands: Brand[]; stores: Store[]; markets: Market[]; teams: TeamRow[]; fxRates: Fx[] };

const LABEL: Record<Tab, { tab: string; one: string; desc: string }> = {
  brand: { tab: "Brand", one: "brand", desc: "Thương hiệu của team. Một brand có nhiều shop." },
  store: { tab: "Shop", one: "shop", desc: "Mỗi shop thuộc một nền tảng bán (mã adapter) và bán ở một hoặc nhiều thị trường." },
  market: { tab: "Thị trường", one: "thị trường", desc: "Quốc gia bán hàng: tiền tệ, hình thức thanh toán, múi giờ." },
  team: { tab: "Nhóm", one: "nhóm", desc: "Nhóm nhân sự trong team, dùng để phân công." },
  fxRate: { tab: "Tỷ giá", one: "tỷ giá", desc: "Quy đổi về VND cho báo cáo. Chỉ thêm mốc mới, không sửa mốc cũ để giữ lịch sử quy đổi." },
};

const status = (a: boolean) => (a ? <Badge tone="success">Đang dùng</Badge> : <Badge>Ngừng dùng</Badge>);
const codeCol = <T extends { code: string }>(): Column<T> => ({ key: "code", header: "Mã", sortValue: (r) => r.code, cell: (r) => <span className="font-mono text-[13px] font-medium">{r.code}</span> });

export function CatalogView(p: Props) {
  const [editing, setEditing] = useState<{ kind: Tab; row: unknown } | null>(null);
  const open = (row: unknown = null) => setEditing({ kind: p.tab, row });
  const L = LABEL[p.tab];
  const empty = <EmptyState title={`Chưa có ${L.one} nào`} action={<Button variant="primary" onClick={() => open()}>+ Thêm {L.one}</Button>} />;

  return (
    <>
      <PageHeader title="Danh mục" description={L.desc} crumbs={[{ label: "Hệ thống" }, { label: "Danh mục" }]}
        actions={<Button variant="primary" onClick={() => open()}>+ Thêm {L.one}</Button>} />
      <div role="tablist" aria-label="Loại danh mục" className="mb-4 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]">
        {(Object.keys(LABEL) as Tab[]).map((t) => (
          <Link key={t} role="tab" aria-selected={t === p.tab} href={`?tab=${t}`} scroll={false}
            className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm", t === p.tab ? "border-brand font-medium text-brand-active" : "border-transparent text-fg-muted hover:text-fg")}>
            {LABEL[t].tab}
          </Link>
        ))}
      </div>
      <Card>
        {p.tab === "brand" && (
          <DataTable caption="Brand" rows={p.brands} rowKey={(r) => r.id} onRowClick={open} empty={empty} columns={[
            codeCol<Brand>(),
            { key: "name", header: "Tên", sortValue: (r) => r.name, cell: (r) => r.name },
            { key: "stores", header: "Số shop", align: "right", sortValue: (r) => r.stores, cell: (r) => r.stores },
            { key: "active", header: "Trạng thái", sortValue: (r) => +r.active, cell: (r) => status(r.active) },
          ]} />
        )}
        {p.tab === "store" && (
          <DataTable caption="Shop" rows={p.stores} rowKey={(r) => r.id} onRowClick={open} empty={empty} columns={[
            codeCol<Store>(),
            { key: "name", header: "Tên", sortValue: (r) => r.name, cell: (r) => r.name },
            { key: "brand", header: "Brand", sortValue: (r) => r.brandName, cell: (r) => r.brandName },
            { key: "platform", header: "Nền tảng", sortValue: (r) => r.platform, cell: (r) => <Badge tone="info">{r.platform}</Badge> },
            { key: "markets", header: "Thị trường", sortValue: (r) => r.marketCodes.join(" "), cell: (r) => r.marketCodes.join(" · ") },
            { key: "active", header: "Trạng thái", sortValue: (r) => +r.active, cell: (r) => status(r.active) },
          ]} />
        )}
        {p.tab === "market" && (
          <DataTable caption="Thị trường" rows={p.markets} rowKey={(r) => r.id} onRowClick={open} empty={empty} columns={[
            codeCol<Market>(),
            { key: "name", header: "Tên", sortValue: (r) => r.name, cell: (r) => r.name },
            { key: "currency", header: "Tiền tệ", sortValue: (r) => r.currency, cell: (r) => r.currency },
            { key: "pay", header: "Thanh toán", sortValue: (r) => r.paymentMode, cell: (r) => (r.paymentMode === "COD" ? <Badge tone="warning">COD</Badge> : <Badge tone="info">Trả trước</Badge>) },
            { key: "tz", header: "Múi giờ", sortValue: (r) => r.timezone, cell: (r) => <span className="text-fg-muted">{r.timezone}</span> },
            { key: "active", header: "Trạng thái", sortValue: (r) => +r.active, cell: (r) => status(r.active) },
          ]} />
        )}
        {p.tab === "team" && (
          <DataTable caption="Nhóm" rows={p.teams} rowKey={(r) => r.id} onRowClick={open} empty={empty} columns={[
            codeCol<TeamRow>(),
            { key: "name", header: "Tên", sortValue: (r) => r.name, cell: (r) => r.name },
            { key: "members", header: "Thành viên", align: "right", sortValue: (r) => r.members, cell: (r) => r.members },
            { key: "active", header: "Trạng thái", sortValue: (r) => +r.active, cell: (r) => status(r.active) },
          ]} />
        )}
        {p.tab === "fxRate" && (
          <DataTable caption="Tỷ giá" rows={p.fxRates} rowKey={(r) => r.id} empty={empty} columns={[
            { key: "cur", header: "Tiền tệ", sortValue: (r) => r.currency, cell: (r) => <span className="font-mono text-[13px] font-medium">{r.currency}</span> },
            { key: "rate", header: "1 đơn vị = VND", align: "right", sortValue: (r) => Number(r.rateToBase), cell: (r) => Number(r.rateToBase).toLocaleString("vi-VN", { maximumFractionDigits: 8 }) },
            { key: "from", header: "Áp dụng từ", sortValue: (r) => r.validFrom, cell: (r) => new Date(r.validFrom).toLocaleDateString("vi-VN") },
          ]} />
        )}
      </Card>
      <CatalogDrawer key={editing ? `${editing.kind}-${(editing.row as { id?: string })?.id ?? "new"}` : "closed"} editing={editing} {...p} onClose={() => setEditing(null)} />
    </>
  );
}

function CatalogDrawer({ editing, brands, markets, onClose }: Props & { editing: { kind: Tab; row: unknown } | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCatalogAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Đã lưu.");
      onClose();
    }
  }, [state, toast, onClose]);
  if (!editing) return <Drawer open={false} onClose={onClose} title=""><span /></Drawer>;
  const { kind } = editing;
  const row = editing.row as Record<string, unknown> | null;
  const d = pick(state, row);
  const v = d.str;
  const f = state?.fields ?? {};
  const L = LABEL[kind];

  return (
    <Drawer open onClose={onClose} title={row ? `Sửa ${L.one}` : `Thêm ${L.one}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" type="submit" form="catalog-form" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button></>}>
      <form id="catalog-form" action={action} noValidate>
        <FormError result={state} />
        <input type="hidden" name="kind" value={kind} />
        {row && <input type="hidden" name="id" value={v("id")} />}
        {kind === "fxRate" ? (
          <>
            <TextField label="Tiền tệ" name="currency" required placeholder="AED" maxLength={3} defaultValue={v("currency")} error={f.currency} hint="Mã ISO 4217, 3 chữ." />
            <TextField label="1 đơn vị bằng bao nhiêu VND" name="rateToBase" required inputMode="decimal" placeholder="7161.23" defaultValue={v("rateToBase")} error={f.rateToBase} />
            <TextField label="Áp dụng từ ngày" name="validFrom" type="date" required defaultValue={v("validFrom") || new Date().toISOString().slice(0, 10)} error={f.validFrom} />
          </>
        ) : (
          <>
            <TextField label="Mã" name="code" required defaultValue={v("code")} error={f.code}
              maxLength={kind === "market" ? 2 : 30} placeholder={kind === "market" ? "AE" : "VD: LUMI"}
              hint={kind === "market" ? "Mã quốc gia ISO 2 chữ." : "Chữ, số, - và _. Duy nhất trong team."} />
            <TextField label="Tên" name="name" required defaultValue={v("name")} error={f.name} />
            {kind === "market" && (
              <>
                <TextField label="Tiền tệ" name="currency" required defaultValue={v("currency")} placeholder="AED" maxLength={3} error={f.currency} />
                <SelectField label="Hình thức thanh toán" name="paymentMode" required defaultValue={v("paymentMode") || "PREPAID"} error={f.paymentMode}
                  options={[{ value: "PREPAID", label: "Trả trước" }, { value: "COD", label: "COD (thu hộ)" }]} />
                <TextField label="Múi giờ" name="timezone" required defaultValue={v("timezone")} placeholder="Asia/Dubai" error={f.timezone} hint="Tên múi giờ IANA." />
                <TextField label="Ngôn ngữ / định dạng" name="locale" required defaultValue={v("locale")} placeholder="ar-AE" error={f.locale} />
              </>
            )}
            {kind === "store" && (
              <>
                <SelectField label="Brand" name="brandId" required defaultValue={v("brandId")} placeholder="— Chọn brand —" error={f.brandId}
                  options={brands.filter((b) => b.active || b.id === v("brandId")).map((b) => ({ value: b.id, label: b.name }))} />
                <TextField label="Nền tảng (mã adapter)" name="platform" required defaultValue={v("platform")} placeholder="shopify" error={f.platform}
                  hint="Ví dụ pancake, shopify, website. Nền tảng mới chỉ cần đăng ký adapter, không đổi dữ liệu." />
                <TextField label="Mã shop trên nền tảng" name="externalId" defaultValue={v("externalId")} error={f.externalId} />
                <CheckboxGroup label="Thị trường bán" name="marketIds" required error={f.marketIds} defaultValue={d.list("marketIds")}
                  options={markets.filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} />
              </>
            )}
            {row && <input type="hidden" name="_hasActive" value="1" />}
            <Switch label="Đang dùng" name="active" defaultChecked={d.bool("active")} />
          </>
        )}
      </form>
    </Drawer>
  );
}

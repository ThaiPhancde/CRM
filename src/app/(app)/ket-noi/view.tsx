"use client";
import { useActionState, useEffect, useState } from "react";
import { Drawer, useToast } from "@/components/overlay";
import { FormError, SelectField, TextField, type ActionResult } from "@/components/form";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { CONNECTION_STATUS, SYNC_STATUS, pickBadge } from "@/lib/status-badge";
import { ago, dateTime, num } from "@/lib/format";
import { createConnectionAction, retryAction, syncAction, toggleAction } from "./actions";

type Run = { id: string; mode: string; status: string; startedAt: string; applied: number; linked: number; stale: number; notOwner: number; duplicate: number; errors: number; reviews: number; error: string | null };
type Conn = {
  id: string; store: string; brand: string; markets: string[]; platform: string; platformLabel: string; verification: string | null; mode: string;
  status: string; pollIntervalMin: number; lastSyncAt: string | null; lastError: string | null; links: number; errorEvents: number; runs: Run[];
};

const VERIFY: Record<string, string> = { XM: "API đã chạy thật", TL: "Theo tài liệu công khai, chưa chạy thật", CXM: "Chưa có tài liệu API xác minh" };
const MODE: Record<string, string> = { BACKFILL: "Nạp lịch sử", INCREMENTAL: "Gia tăng", REPLAY: "Chạy lại" };

/** Nút gọi server action, báo kết quả bằng toast. */
function ActionButton({ action, fields, children, variant = "secondary", confirm }: { action: (s: ActionResult | null, fd: FormData) => Promise<ActionResult>; fields: Record<string, string>; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; confirm?: string }) {
  const [state, run, pending] = useActionState(action, null);
  const toast = useToast();
  useEffect(() => {
    if (state) toast(state.message ?? (state.ok ? "Xong." : "Có lỗi."), state.ok ? "success" : "danger");
  }, [state, toast]);
  return (
    <form action={run} onSubmit={(e) => confirm && !window.confirm(confirm) && e.preventDefault()}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>{pending ? "Đang chạy…" : children}</Button>
    </form>
  );
}

export function ConnectionsView({ connections, stores, canManage }: { connections: Conn[]; stores: { value: string; label: string }[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader
        title="Kết nối dữ liệu"
        crumbs={[{ label: "Hệ thống" }, { label: "Kết nối dữ liệu" }]}
        description="Mỗi shop một kết nối. Bản demo phát lại dữ liệu mẫu theo đúng luồng đồng bộ thật; khi lên thật chỉ cần bật API cho từng nền tảng."
        actions={canManage && stores.length > 0 ? <Button variant="primary" onClick={() => setAdding(true)}>+ Thêm kết nối</Button> : undefined}
      />
      {connections.length === 0 ? (
        <Card><EmptyState title="Chưa có kết nối nào" description="Tạo kết nối cho một shop để bắt đầu nhận đơn." action={canManage && stores.length ? <Button variant="primary" onClick={() => setAdding(true)}>+ Thêm kết nối</Button> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {connections.map((c) => {
            const st = pickBadge(CONNECTION_STATUS, c.status);
            return (
              <Card key={c.id} className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{c.store}</p>
                    <p className="text-xs text-fg-muted">{c.brand} · {c.markets.join(" · ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="info">{c.platformLabel}</Badge>
                    {c.mode === "replay" ? <Badge tone="brand">Phát lại (demo)</Badge> : <Badge tone="warning">API thật</Badge>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-4">
                  <Stat k="Đồng bộ gần nhất" v={ago(c.lastSyncAt)} title={dateTime(c.lastSyncAt)} />
                  <Stat k="Chu kỳ" v={`${c.pollIntervalMin} phút`} />
                  <Stat k="Bản ghi đã liên kết" v={num(c.links)} />
                  <Stat k="Sự kiện lỗi" v={num(c.errorEvents)} danger={c.errorEvents > 0} />
                </dl>
                {c.verification && <p className="px-4 text-xs text-fg-subtle">Mức xác minh API thật: {c.verification} — {VERIFY[c.verification]}.</p>}
                {c.lastError && <p role="alert" className="mx-4 mt-2 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-xs text-danger">{c.lastError}</p>}
                <div className="mt-3 flex-1 border-t border-border">
                  <p className="px-4 pt-3 text-xs font-medium text-fg-muted">Lượt đồng bộ gần đây</p>
                  {c.runs.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-fg-muted">Chưa chạy lượt nào.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <caption className="sr-only">Lượt đồng bộ của {c.store}</caption>
                      <thead className="text-left text-fg-subtle"><tr>{["Lúc", "Loại", "Kết quả", "Cập nhật", "Liên kết", "Cũ", "Không chủ", "Trùng", "Lỗi"].map((h) => <th key={h} scope="col" className="px-4 py-1.5 font-medium">{h}</th>)}</tr></thead>
                      <tbody>
                        {c.runs.map((r) => {
                          const b = pickBadge(SYNC_STATUS, r.status);
                          return (
                            <tr key={r.id} className="border-t border-border" title={r.error ?? undefined}>
                              <td className="tabular px-4 py-1.5 whitespace-nowrap text-fg-muted">{dateTime(r.startedAt)}</td>
                              <td className="px-4 py-1.5">{MODE[r.mode] ?? r.mode}</td>
                              <td className="px-4 py-1.5"><Badge tone={b.tone}>{b.label}</Badge></td>
                              <td className="tabular px-4 py-1.5">{num(r.applied)}</td>
                              <td className="tabular px-4 py-1.5">{num(r.linked)}{r.reviews ? <span className="text-warning"> (+{r.reviews} nghi trùng)</span> : null}</td>
                              <td className="tabular px-4 py-1.5 text-fg-muted">{num(r.stale)}</td>
                              <td className="tabular px-4 py-1.5 text-fg-muted" title="Bản mới hơn từ nguồn không làm chủ nhóm trường nào của đơn (D-32)">{num(r.notOwner)}</td>
                              <td className="tabular px-4 py-1.5 text-fg-muted">{num(r.duplicate)}</td>
                              <td className={`tabular px-4 py-1.5 ${r.errors ? "text-danger" : "text-fg-muted"}`}>{num(r.errors)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t border-border bg-bg-subtle px-4 py-3">
                    <ActionButton action={syncAction} fields={{ id: c.id, mode: "INCREMENTAL" }} variant="primary">Đồng bộ ngay</ActionButton>
                    <ActionButton action={syncAction} fields={{ id: c.id, mode: "BACKFILL" }} confirm="Nạp lại toàn bộ lịch sử? Bản ghi đã nhận sẽ được bỏ qua, không tạo trùng.">Nạp lịch sử</ActionButton>
                    {c.errorEvents > 0 && <ActionButton action={retryAction} fields={{ id: c.id }}>Chạy lại {num(c.errorEvents)} lỗi</ActionButton>}
                    <div className="ml-auto">
                      {c.status === "PAUSED"
                        ? <ActionButton action={toggleAction} fields={{ id: c.id, status: "ACTIVE" }} variant="ghost">Bật lại</ActionButton>
                        : <ActionButton action={toggleAction} fields={{ id: c.id, status: "PAUSED" }} variant="ghost">Tạm dừng</ActionButton>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <AddDrawer key={adding ? "open" : "closed"} open={adding} stores={stores} onClose={() => setAdding(false)} />
    </>
  );
}

function Stat({ k, v, title, danger }: { k: string; v: string; title?: string; danger?: boolean }) {
  return (
    <div title={title}>
      <dt className="text-xs text-fg-muted">{k}</dt>
      <dd className={`tabular font-medium ${danger ? "text-danger" : "text-fg"}`}>{v}</dd>
    </div>
  );
}

function AddDrawer({ open, stores, onClose }: { open: boolean; stores: { value: string; label: string }[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createConnectionAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Đã tạo kết nối.");
      onClose();
    }
  }, [state, toast, onClose]);
  return (
    <Drawer open={open} onClose={onClose} title="Thêm kết nối" description="Kết nối nhận đơn của một shop. Nền tảng lấy theo shop."
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" type="submit" form="conn-form" disabled={pending}>{pending ? "Đang tạo…" : "Tạo kết nối"}</Button></>}>
      <form id="conn-form" action={action} noValidate>
        <FormError result={state} />
        <SelectField label="Shop" name="storeId" required options={stores} placeholder="— Chọn shop —" defaultValue={String(state?.values?.storeId ?? "")} />
        <SelectField label="Chế độ" name="mode" options={[{ value: "replay", label: "Phát lại dữ liệu mẫu (demo)" }, { value: "live", label: "API thật (chưa bật — Phase 12)" }]} defaultValue="replay"
          hint="Bản demo chỉ chạy phát lại. Chế độ API thật cần khóa và xác minh endpoint trước." />
        <TextField label="Chu kỳ đồng bộ (phút)" name="pollIntervalMin" type="number" min={5} max={1440} defaultValue={String(state?.values?.pollIntervalMin ?? 15)} />
      </form>
    </Drawer>
  );
}

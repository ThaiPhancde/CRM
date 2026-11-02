"use client";
// Dán bảng đối soát COD của hãng → Xem trước từng dòng → Áp dụng (mẫu Purchasing 5.1). Xem trước không ghi gì.
import { useActionState, useState } from "react";
import { Badge, Button, type Tone } from "@/components/ui";
import { settlementAction, type SettlementState } from "./actions";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ready: { label: "Sẵn sàng", tone: "info" }, done: { label: "Đã ghi", tone: "success" }, unchanged: { label: "Không đổi", tone: "neutral" }, error: { label: "Lỗi", tone: "danger" },
};
const field = "w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring";
const SAMPLE = "ma_van_don\tso_tien\tngay_ve\nARA00000123\t163,00\t12/10/2026";

export function SettlementForm({ carriers }: { carriers: string[] }) {
  const [state, action, pending] = useActionState<SettlementState, FormData>(settlementAction, null);
  const [dirty, setDirty] = useState(false);
  const lines = state?.lines ?? [];
  const ready = lines.filter((l) => l.status === "ready").length;
  const canApply = !!state?.ok && !state.applied && ready > 0 && !dirty;
  return (
    <form action={action} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)} className="space-y-3 px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="st-carrier" className="mb-1 block text-xs font-medium text-fg">Hãng vận chuyển <span className="text-danger">*</span></label>
          <select id="st-carrier" name="carrier" required defaultValue="" className={`${field} h-9`} aria-invalid={!!state?.fields?.carrier}>
            <option value="" disabled>Chọn hãng…</option>
            {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {state?.fields?.carrier && <p className="mt-1 text-xs text-danger">{state.fields.carrier}</p>}
        </div>
        <div>
          <label htmlFor="st-ref" className="mb-1 block text-xs font-medium text-fg">Mã bảng đối soát <span className="text-danger">*</span></label>
          <input id="st-ref" name="reference" required maxLength={60} placeholder="Ví dụ: ARX-2026-10-W2" className={`${field} h-9`} aria-invalid={!!state?.fields?.reference} />
          {state?.fields?.reference && <p className="mt-1 text-xs text-danger">{state.fields.reference}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="st-text" className="mb-1 block text-xs font-medium text-fg">Dán bảng từ Excel <span className="text-danger">*</span></label>
        <textarea id="st-text" name="text" required rows={8} placeholder={SAMPLE} className={`${field} py-2 font-mono text-xs`} aria-describedby="st-help" />
        <p id="st-help" className="mt-1 text-xs text-fg-muted">Dòng đầu là tiêu đề. Cột bắt buộc: <code>ma_van_don</code> (hoặc <code>ma_don</code>), <code>so_tien</code>, <code>ngay_ve</code> (dd/mm/yyyy). Tùy chọn: <code>ma_don</code> khi mã vận đơn trùng giữa hai đơn, <code>tien_te</code>. Tối đa 500 dòng.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="preview" disabled={pending}>{pending ? "Đang kiểm…" : "Xem trước"}</Button>
        <Button type="submit" name="intent" value="apply" variant="primary" disabled={pending || !canApply} title={canApply ? undefined : "Xem trước bảng đã dán trước khi ghi"}>
          {`Ghi ${ready || ""} dòng sẵn sàng`.replace("  ", " ")}
        </Button>
        {state?.message && <p role="status" className={`text-sm ${state.ok ? "text-fg-muted" : "text-danger"}`}>{state.message}</p>}
        {dirty && lines.length > 0 && <p className="text-xs text-warning">Bảng đã sửa — xem trước lại trước khi ghi.</p>}
      </div>
      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Kết quả kiểm từng dòng bảng đối soát</caption>
            <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
              <tr>{["Dòng", "Mã", "Đơn", "Trạng thái", "Ghi chú"].map((h) => <th key={h} scope="col" className="h-9 px-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.rowNo} className="border-t border-border align-top">
                  <td className="tabular px-3 py-2 text-fg-muted">{l.rowNo}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.ref}</td>
                  <td className="px-3 py-2">{l.orderNumber ?? "—"}</td>
                  <td className="px-3 py-2"><Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge></td>
                  <td className="px-3 py-2 text-fg-muted">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}

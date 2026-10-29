"use client";
// Thanh thao tác hàng loạt (D-49): ô chọn ở từng dòng của bảng gắn vào form này qua thuộc tính form="bulk-form" — không cần giữ trạng thái chọn ở client.
import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { LEAD_STAGES, STAGE_LABEL } from "@/modules/sales/labels";
import { bulkLeadsAction } from "./actions";

const input = "h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus:border-brand-ring";

export function BulkBar({ canAssign, people }: { canAssign: boolean; people: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(bulkLeadsAction, null);
  const [mode, setMode] = useState<"stage" | "assign">("stage");
  const [stage, setStage] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (state) toast(state.message ?? (state.ok ? "Đã xử lý." : "Không xử lý được."), state.ok ? "success" : "danger");
  }, [state, toast]);

  const err = state?.fields ?? {};
  return (
    <form id="bulk-form" action={action} className="flex flex-wrap items-end gap-2 border-b border-border bg-bg-subtle px-4 py-2.5 text-xs">
      <span className="self-center font-medium text-fg-muted">Với các lead đã chọn:</span>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Thao tác</span>
        <select name="action" value={mode} onChange={(e) => setMode(e.target.value as "stage" | "assign")} className={input}>
          <option value="stage">Đổi giai đoạn</option>
          {canAssign && <option value="assign">Chuyển phụ trách</option>}
        </select>
      </label>
      {mode === "stage" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Giai đoạn mới</span>
            <select name="stage" value={stage} onChange={(e) => setStage(e.target.value)} className={input} aria-invalid={!!err.stage}>
              <option value="">Chọn giai đoạn…</option>
              {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </label>
          {(stage === "TU_CHOI" || stage === "MAT_LIEN_LAC") && (
            <label className="flex flex-col gap-1">
              <span className="sr-only">Lý do</span>
              <input name="lostReason" placeholder="Lý do (bắt buộc)" className={`${input} w-56`} aria-invalid={!!err.lostReason} />
            </label>
          )}
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Người nhận</span>
            <select name="toUserId" className={input} aria-invalid={!!err.toUserId} defaultValue="">
              <option value="">Chọn người nhận…</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Lý do chuyển</span>
            <input name="reason" placeholder="Lý do chuyển (bắt buộc)" className={`${input} w-56`} aria-invalid={!!err.reason} />
          </label>
        </>
      )}
      <button type="submit" disabled={pending} className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
        {pending ? "Đang xử lý…" : "Áp dụng"}
      </button>
      {state && !state.ok && (err.ids || err.stage || err.lostReason || err.toUserId || err.reason) && (
        <span className="self-center text-danger">{err.ids ?? err.stage ?? err.lostReason ?? err.toUserId ?? err.reason}</span>
      )}
    </form>
  );
}

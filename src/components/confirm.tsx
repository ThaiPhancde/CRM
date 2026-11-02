"use client";
// Nút thao tác cần xác nhận (thay window.confirm): bấm → Modal xác nhận theo design system → gọi server action, toast kết quả.
// Một lớp phủ tại một thời điểm (overlay.tsx). Trường ẩn truyền qua `fields`.
import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "./form";
import { Modal, useToast } from "./overlay";
import { Button } from "./ui";

export function ConfirmButton({ action, fields, label, ariaLabel, title, description, confirmLabel, danger = false, size = "sm", variant, okMessage }: {
  action: (state: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  /** Chữ trên nút mở. */
  label: string;
  /** Tên cho trình đọc màn hình khi nút lặp trên nhiều dòng (vd "Hủy nhiệm vụ Gọi lại khách A"). */
  ariaLabel?: string;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  okMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const toast = useToast();
  useEffect(() => {
    if (!state) return;
    toast(state.message || (state.ok ? (okMessage ?? "Đã xong.") : "Không thực hiện được."), state.ok ? "success" : "danger");
    if (state.ok) setOpen(false);
  }, [state, toast, okMessage]);
  return (
    <>
      <Button type="button" size={size} variant={variant ?? (danger ? "danger" : "secondary")} aria-label={ariaLabel} disabled={pending} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}
        footer={<>
          <Button type="button" onClick={() => setOpen(false)}>Hủy</Button>
          <form action={run}>
            {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending}>{pending ? "Đang xử lý…" : confirmLabel}</Button>
          </form>
        </>}>
        {state && !state.ok && state.message && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">{state.message}</p>}
      </Modal>
    </>
  );
}

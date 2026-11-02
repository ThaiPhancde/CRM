"use client";
// "Dữ liệu khách" (GDPR/PDPA): tải toàn bộ dữ liệu (JSON) và xóa dữ liệu cá nhân theo yêu cầu — Modal xác nhận gõ XOA + lý do.
import { useActionState, useEffect, useState } from "react";
import { FormError, type ActionResult } from "@/components/form";
import { Modal, useToast } from "@/components/overlay";
import { Button, ButtonLink } from "@/components/ui";
import { eraseCustomerAction } from "../actions";

const field = "w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring";

export function PrivacyActions({ customerId, erased }: { customerId: string; erased: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(eraseCustomerAction, null);
  const toast = useToast();
  useEffect(() => {
    if (!state?.message) return;
    toast(state.message, state.ok ? "success" : "danger");
    if (state.ok) setOpen(false);
  }, [state, toast]);
  return (
    <>
      <ButtonLink href={`/khach-hang/${customerId}/du-lieu`} prefetch={false} download>Tải dữ liệu khách</ButtonLink>
      {!erased && <Button variant="danger" onClick={() => setOpen(true)}>Xóa dữ liệu theo yêu cầu</Button>}
      <Modal open={open} onClose={() => setOpen(false)} title="Xóa dữ liệu cá nhân của khách"
        description="Tên, SĐT, email, địa chỉ, nội dung hội thoại và ticket sẽ bị xóa ở mọi nơi (kể cả hồ sơ đã gộp). Đơn và số liệu doanh thu giữ nguyên. Không hoàn tác được."
        footer={<><Button onClick={() => setOpen(false)}>Hủy</Button><Button variant="danger" type="submit" form="erase-form" disabled={pending || confirm.trim().toUpperCase() !== "XOA" || reason.trim().length < 5}>{pending ? "Đang xóa…" : "Xóa vĩnh viễn"}</Button></>}>
        <form id="erase-form" action={action} className="space-y-3">
          <FormError result={state} />
          <input type="hidden" name="customerId" value={customerId} />
          <div>
            <label htmlFor="erase-reason" className="mb-1 block text-xs font-medium text-fg">Lý do / số yêu cầu <span className="text-danger">*</span></label>
            <input id="erase-reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ví dụ: Yêu cầu xóa dữ liệu #2026-114 qua email" className={field} aria-invalid={!!state?.fields?.reason} />
            {state?.fields?.reason && <p className="mt-1 text-xs text-danger">{state.fields.reason}</p>}
          </div>
          <div>
            <label htmlFor="erase-confirm" className="mb-1 block text-xs font-medium text-fg">Gõ <strong>XOA</strong> để xác nhận <span className="text-danger">*</span></label>
            <input id="erase-confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={field} aria-invalid={!!state?.fields?.confirm} />
            {state?.fields?.confirm && <p className="mt-1 text-xs text-danger">{state.fields.confirm}</p>}
          </div>
          <p className="text-xs text-fg-muted">Nên tải dữ liệu khách trước nếu cần lưu bản trả lời yêu cầu. Thao tác ghi nhật ký kèm lý do (không ghi thông tin cá nhân).</p>
        </form>
      </Modal>
    </>
  );
}

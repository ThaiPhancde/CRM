"use client";
// Nút "Xử lý" trên dòng đơn giao thất bại → Modal chọn giao lại / hủy / chuyển ticket (khóa idempotency sinh trong useEffect).
import { useActionState, useEffect, useState } from "react";
import { FormError, type ActionResult } from "@/components/form";
import { Modal, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { DELIVERY_ACTION_LABEL } from "@/modules/fulfillment/reasons";
import { PRIORITY_LABEL, TICKET_PRIORITIES } from "@/modules/service/labels";
import { deliveryAction } from "./actions";

const HINT: Record<string, string> = {
  REATTEMPT: "Ghi yêu cầu giao lại gửi hãng vận chuyển. Nếu lần giao sau vẫn thất bại, đơn sẽ quay lại danh sách.",
  CANCEL: "Ghi yêu cầu hủy gửi shop nguồn. CRM không tự hủy đơn trên POS — trạng thái đổi khi nguồn cập nhật.",
  TICKET: "Tạo ticket gắn đơn và khách, giao bạn phụ trách; hạn xử lý theo mức ưu tiên.",
};
const field = "w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring";

export function DeliveryAction({ orderId, orderNumber, reasonLabel, carrierFault }: { orderId: string; orderNumber: string; reasonLabel: string; carrierFault: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"REATTEMPT" | "CANCEL" | "TICKET">(carrierFault ? "TICKET" : "REATTEMPT");
  const [key, setKey] = useState("");
  const [note, setNote] = useState(""); // có kiểm soát: React 19 xóa form sau action, lỗi máy chủ không được làm mất ghi chú
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deliveryAction, null);
  const toast = useToast();
  useEffect(() => setKey(crypto.randomUUID()), []);
  useEffect(() => {
    if (!state?.message) return;
    toast(state.message, state.ok ? "success" : "danger");
    if (state.ok) { setOpen(false); setKey(crypto.randomUUID()); setNote(""); }
  }, [state, toast]);
  const formId = `delivery-${orderId}`;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Xử lý</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Xử lý đơn ${orderNumber}`} description={`Giao thất bại: ${reasonLabel}`}
        footer={<><Button onClick={() => setOpen(false)}>Hủy</Button><Button variant="primary" type="submit" form={formId} disabled={pending || !key}>{pending ? "Đang ghi…" : DELIVERY_ACTION_LABEL[kind]}</Button></>}>
        <form id={formId} action={action} noValidate className="space-y-3">
          <FormError result={state} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="idempotencyKey" value={key} />
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-fg">Cách xử lý</legend>
            <div className="grid gap-1.5">
              {(["REATTEMPT", "CANCEL", "TICKET"] as const).map((k) => (
                <label key={k} className={cx("flex cursor-pointer gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm", kind === k ? "border-brand bg-brand-soft" : "border-border hover:bg-bg-subtle")}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-0.5 accent-[var(--brand)]" />
                  <span><span className="font-medium text-fg">{DELIVERY_ACTION_LABEL[k]}</span><span className="block text-xs text-fg-muted">{HINT[k]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {kind === "TICKET" && (
            <div>
              <label htmlFor={`${formId}-p`} className="mb-1 block text-xs font-medium text-fg">Mức ưu tiên</label>
              <select id={`${formId}-p`} name="priority" defaultValue="TRUNG" className={cx(field, "h-9 py-0")}>
                {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${formId}-n`} className="mb-1 block text-xs font-medium text-fg">Ghi chú{kind === "CANCEL" ? " (bắt buộc — lý do hủy)" : ""}</label>
            <textarea id={`${formId}-n`} name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} required={kind === "CANCEL"} aria-invalid={!!state?.fields?.note} className={field}
              placeholder={kind === "REATTEMPT" ? "Ví dụ: khách hẹn giao sau 17h" : kind === "CANCEL" ? "Ví dụ: khách không còn nhu cầu" : "Thông tin thêm cho người xử lý"} />
            {state?.fields?.note && <p role="alert" className="mt-1 text-xs text-danger">{state.fields.note}</p>}
          </div>
        </form>
      </Modal>
    </>
  );
}

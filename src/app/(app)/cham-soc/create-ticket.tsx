"use client";
// Nút "Tạo ticket" + Drawer biểu mẫu tạo ticket sau bán (khóa idempotency sinh trong useEffect sau khi mount).
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import {
  PRIORITY_LABEL,
  TICKET_PRIORITIES,
  TICKET_TYPE_LABEL,
  TICKET_TYPES,
} from "@/modules/service/labels";
import { createTicketAction } from "./actions";

export type AssignableUserOption = { id: string; name: string; team: string | null };

const TYPE_OPTIONS = TICKET_TYPES.map((t) => ({
  value: t,
  label: TICKET_TYPE_LABEL[t],
}));

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABEL[p],
}));

const textareaClass =
  "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring disabled:bg-bg-muted";

export function CreateTicket({
  canAssign,
  users,
  defaultOrderId,
  defaultCustomerId,
}: {
  canAssign: boolean;
  users: AssignableUserOption[];
  defaultOrderId?: string;
  defaultCustomerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTicketAction, null);
  const toast = useToast();

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã tạo ticket và giao người phụ trách.", "success");
      setIdempotencyKey(crypto.randomUUID());
      setOpen(false);
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const handleOpen = () => {
    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const d = pick(state, {
    type: "GIAO_CHAM",
    priority: "TRUNG",
    orderId: defaultOrderId ?? "",
    customerId: defaultCustomerId ?? "",
    ownerId: "",
  });
  const v = d.str;
  const f = state?.fields ?? {};

  return (
    <>
      <Button variant="primary" onClick={handleOpen}>
        Tạo ticket
      </Button>
      <Drawer
        open={open}
        onClose={handleClose}
        title="Tạo ticket"
        description="Ghi nhận sự cố sau bán để tính hạn phản hồi đầu, hạn xử lý và phân công người phụ trách."
        footer={
          <>
            <Button onClick={handleClose}>Hủy</Button>
            <Button variant="primary" type="submit" form="create-ticket-form" disabled={pending}>
              {pending ? "Đang lưu…" : "Tạo ticket"}
            </Button>
          </>
        }
      >
        <form id="create-ticket-form" action={action} noValidate>
          <FormError result={state} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <SelectField
              label="Loại sự cố"
              name="type"
              required
              defaultValue={v("type") || "GIAO_CHAM"}
              options={TYPE_OPTIONS}
              error={f.type}
            />
            <SelectField
              label="Mức ưu tiên"
              name="priority"
              required
              defaultValue={v("priority") || "TRUNG"}
              options={PRIORITY_OPTIONS}
              error={f.priority}
            />
          </div>

          <TextField
            label="Tiêu đề"
            name="subject"
            required
            minLength={3}
            maxLength={200}
            defaultValue={v("subject")}
            placeholder="VD: Đơn giao chậm quá 3 ngày, kiện hàng móp méo…"
            error={f.subject}
          />

          <Field label="Mô tả sự cố" name="body" required error={f.body}>
            <textarea
              id="body"
              name="body"
              required
              rows={4}
              maxLength={4000}
              defaultValue={v("body")}
              placeholder="Mô tả chi tiết phản ánh của khách hàng, tình trạng đơn hoặc sản phẩm…"
              aria-invalid={!!f.body}
              aria-describedby={f.body ? "body-error" : undefined}
              className={cx(textareaClass, f.body ? "border-danger" : "border-border")}
            />
          </Field>

          <TextField
            label="Mã đơn hàng"
            name="orderId"
            defaultValue={v("orderId")}
            placeholder="Nhập mã định danh đơn hàng (nếu có)"
            hint="Mã nội bộ của đơn — mở từ trang đơn sẽ tự điền"
            error={f.orderId}
          />

          <TextField
            label="Mã khách hàng"
            name="customerId"
            defaultValue={v("customerId")}
            placeholder="Nhập mã định danh khách hàng (nếu có)"
            hint="Để trống nếu đã nhập mã đơn hàng"
            error={f.customerId}
          />

          {canAssign && (
            <SelectField
              label="Người phụ trách"
              name="ownerId"
              defaultValue={v("ownerId")}
              placeholder="Tôi"
              options={users.map((u) => ({
                value: u.id,
                label: u.team ? `${u.name} — ${u.team}` : u.name,
              }))}
              error={f.ownerId}
            />
          )}
        </form>
      </Drawer>
    </>
  );
}

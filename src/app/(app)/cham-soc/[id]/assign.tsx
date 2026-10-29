"use client";
// Ngăn kéo chuyển người phụ trách ticket chăm sóc (chỉ mở một lớp phủ tại một thời điểm).
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { assignTicketAction } from "../actions";

export type AssignableUserOption = {
  id: string;
  name: string;
  team: string | null;
};

export function AssignTicketDrawer({
  ticketId,
  currentOwnerId,
  users,
}: {
  ticketId: string;
  currentOwnerId: string | null;
  users: AssignableUserOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    assignTicketAction,
    null,
  );
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã chuyển người phụ trách.", "success");
      setOpen(false);
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const d = pick(state, { toUserId: "", reason: "" });
  const f = state?.fields ?? {};
  const options = users
    .filter((u) => u.id !== currentOwnerId)
    .map((u) => ({
      value: u.id,
      label: u.team ? `${u.name} — ${u.team}` : u.name,
    }));

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Chuyển phụ trách
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Chuyển người phụ trách"
        description="Giao ticket này cho nhân viên khác và ghi nhận lý do vào dòng thời gian."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" form="assign-ticket-form" disabled={pending}>
              {pending ? "Đang chuyển…" : "Xác nhận chuyển"}
            </Button>
          </>
        }
      >
        <form id="assign-ticket-form" action={action} noValidate>
          <FormError result={state} />
          <input type="hidden" name="id" value={ticketId} />
          <SelectField
            label="Người phụ trách mới"
            name="toUserId"
            required
            placeholder="— Chọn người nhận —"
            defaultValue={d.str("toUserId")}
            options={options}
            error={f.toUserId}
          />
          <Field
            label="Lý do chuyển"
            name="reason"
            required
            error={f.reason}
            hint="Tối thiểu 3 ký tự (ví dụ: bàn giao ca trực, đúng ngôn ngữ khách hàng…)."
          >
            <textarea
              id="reason"
              name="reason"
              required
              rows={3}
              maxLength={300}
              defaultValue={d.str("reason")}
              placeholder="Nhập lý do chuyển phụ trách…"
              aria-invalid={!!f.reason}
              aria-describedby={f.reason ? "reason-error" : undefined}
              className={cx(
                "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
                f.reason ? "border-danger" : "border-border",
              )}
            />
          </Field>
        </form>
      </Drawer>
    </>
  );
}

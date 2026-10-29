"use client";
// Ngăn kéo chuyển người phụ trách nhu cầu mua (chỉ mở một lớp phủ tại một thời điểm).
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { reassignLeadAction } from "../actions";

export type AssignableUserOption = {
  id: string;
  name: string;
  team: string | null;
};

export function ReassignDrawer({
  leadId,
  currentOwnerId,
  users,
}: {
  leadId: string;
  currentOwnerId: string | null;
  users: AssignableUserOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(reassignLeadAction, null);
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
        description="Ghi nhận người nhận mới và lý do chuyển giao vào lịch sử phụ trách."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" form="reassign-lead-form" disabled={pending}>
              {pending ? "Đang chuyển…" : "Xác nhận chuyển"}
            </Button>
          </>
        }
      >
        <form id="reassign-lead-form" action={action} noValidate>
          <FormError result={state} />
          <input type="hidden" name="id" value={leadId} />
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
            hint="Tối thiểu 3 ký tự (ví dụ: bàn giao ca, đúng ngôn ngữ khách hàng…)."
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

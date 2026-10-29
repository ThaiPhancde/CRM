"use client";
// Nút "Tạo việc" và ngăn kéo biểu mẫu tạo nhiệm vụ mới (kèm khóa idempotency chống bấm đúp).
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { createTaskAction } from "./actions";

export type AssignableUser = {
  id: string;
  name: string;
  team: string | null;
};

const TASK_TYPE_OPTIONS = [
  { value: "CALL_BACK", label: "Gọi lại" },
  { value: "FOLLOW_UP", label: "Theo dõi" },
  { value: "MEETING", label: "Hẹn gặp" },
  { value: "OTHER", label: "Khác" },
];

export function CreateTask({
  users,
  currentUserId,
}: {
  users: AssignableUser[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTaskAction, null);
  const toast = useToast();

  const handleOpen = () => {
    setIdempotencyKey(crypto.randomUUID());
    setOpen(true);
  };

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã tạo việc.", "success");
      setOpen(false);
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const d = pick(state, { type: "CALL_BACK", assigneeId: currentUserId });
  const f = state?.fields ?? {};
  const showAssignee = users.length > 1 || (users.length === 1 && users[0].id !== currentUserId);

  return (
    <>
      <Button variant="primary" onClick={handleOpen}>
        Tạo việc
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo việc"
        description="Lên lịch gọi lại, theo dõi hoặc hẹn gặp khách hàng."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" form="create-task-form" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo việc"}
            </Button>
          </>
        }
      >
        <form id="create-task-form" action={action} noValidate>
          <FormError result={state} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <SelectField
            label="Loại việc"
            name="type"
            required
            defaultValue={d.str("type") || "CALL_BACK"}
            options={TASK_TYPE_OPTIONS}
            error={f.type}
          />
          <TextField
            label="Tiêu đề việc"
            name="title"
            required
            maxLength={200}
            defaultValue={d.str("title")}
            placeholder="VD: Gọi lại xác nhận đơn hàng…"
            error={f.title}
          />
          <TextField
            label="Hạn xử lý"
            name="dueAt"
            type="datetime-local"
            required
            defaultValue={d.str("dueAt")}
            error={f.dueAt}
          />
          {showAssignee && (
            <SelectField
              label="Người làm"
              name="assigneeId"
              defaultValue={d.str("assigneeId") || currentUserId}
              options={users.map((u) => ({
                value: u.id,
                label: u.team ? `${u.name} — ${u.team}` : u.name,
              }))}
              error={f.assigneeId}
            />
          )}
          <Field label="Ghi chú" name="note" error={f.note}>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxLength={2000}
              defaultValue={d.str("note")}
              placeholder="Nội dung cần trao đổi hoặc lưu ý khi liên hệ…"
              aria-invalid={!!f.note}
              aria-describedby={f.note ? "note-error" : undefined}
              className={cx(
                "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
                f.note ? "border-danger" : "border-border",
              )}
            />
          </Field>
        </form>
      </Drawer>
    </>
  );
}

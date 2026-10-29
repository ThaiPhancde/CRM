"use client";
// Biểu mẫu nhỏ gọn tạo việc mới gắn trực tiếp vào nhu cầu mua hiện tại.
import { useActionState, useEffect, useState } from "react";
import { createTaskAction } from "@/app/(app)/nhiem-vu/actions";
import { FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import type { AssignableUserOption } from "./reassign";

const TASK_TYPE_OPTIONS = [
  { value: "CALL_BACK", label: "Gọi lại" },
  { value: "FOLLOW_UP", label: "Theo dõi" },
  { value: "MEETING", label: "Hẹn gặp" },
  { value: "OTHER", label: "Khác" },
];

export function TaskForm({
  leadId,
  canAssign,
  users,
}: {
  leadId: string;
  canAssign: boolean;
  users: AssignableUserOption[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTaskAction, null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => setIdempotencyKey(crypto.randomUUID()), []);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    toast(
      state.message ?? (state.ok ? "Đã tạo việc." : "Không thể tạo việc."),
      state.ok ? "success" : "danger",
    );
    if (state.ok) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [state, toast]);

  const d = pick(state, {
    type: "CALL_BACK",
    title: "",
    dueAt: "",
    assigneeId: "",
  });
  const f = state?.fields ?? {};
  const userOptions = users.map((u) => ({
    value: u.id,
    label: u.team ? `${u.name} — ${u.team}` : u.name,
  }));

  return (
    <form action={action} noValidate className="border-t border-border bg-bg-subtle px-4 py-3">
      <p className="mb-3 text-xs font-semibold text-fg">Thêm việc mới</p>
      <FormError result={state} />
      <input type="hidden" name="leadId" value={leadId} />
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
        placeholder="VD: Gọi lại xác nhận đơn COD…"
        error={f.title}
      />

      <TextField
        label="Hạn thực hiện"
        name="dueAt"
        type="datetime-local"
        required
        defaultValue={d.str("dueAt")}
        error={f.dueAt}
      />

      {canAssign && (
        <SelectField
          label="Người làm"
          name="assigneeId"
          placeholder="Mặc định (bản thân)"
          defaultValue={d.str("assigneeId")}
          options={userOptions}
          error={f.assigneeId}
        />
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo việc"}
        </Button>
      </div>
    </form>
  );
}

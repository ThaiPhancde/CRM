"use client";
// Biểu mẫu ghi tương tác trực tiếp (cuộc gọi, tin nhắn, gặp mặt, ghi chú) có khóa chống gửi trùng.
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { logActivityAction } from "../actions";

const ACTIVITY_TYPE_OPTIONS = [
  { value: "CALL", label: "Cuộc gọi" },
  { value: "MESSAGE", label: "Tin nhắn" },
  { value: "MEETING", label: "Gặp mặt" },
  { value: "NOTE", label: "Ghi chú" },
];

const DIRECTION_OPTIONS = [
  { value: "OUT", label: "Gửi khách" },
  { value: "IN", label: "Khách gửi" },
];

const CHANNEL_OPTIONS = [
  { value: "PHONE", label: "Điện thoại (PHONE)" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "EMAIL", label: "Email" },
];

export function ActivityForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(logActivityAction, null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => setIdempotencyKey(crypto.randomUUID()), []);
  const [type, setType] = useState<string>("CALL");
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    toast(
      state.message ?? (state.ok ? "Đã ghi tương tác." : "Không thể ghi tương tác."),
      state.ok ? "success" : "danger",
    );
    if (state.ok) {
      setIdempotencyKey(crypto.randomUUID());
    } else if (state.values?.type) {
      setType(String(state.values.type));
    }
  }, [state, toast]);

  const d = pick(state, {
    type,
    direction: "OUT",
    channel: "PHONE",
    body: "",
    outcome: "",
    durationSec: "",
  });
  const f = state?.fields ?? {};

  return (
    <form action={action} noValidate className="p-4">
      <FormError result={state} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
        <SelectField
          label="Loại tương tác"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={ACTIVITY_TYPE_OPTIONS}
          error={f.type}
        />

        {type === "MESSAGE" && (
          <SelectField
            label="Chiều tin nhắn"
            name="direction"
            defaultValue={d.str("direction") || "OUT"}
            options={DIRECTION_OPTIONS}
            error={f.direction}
          />
        )}

        <SelectField
          label="Kênh liên hệ"
          name="channel"
          placeholder="— Chọn kênh —"
          defaultValue={d.str("channel")}
          options={CHANNEL_OPTIONS}
          error={f.channel}
        />
      </div>

      <Field
        label="Nội dung tương tác"
        name="body"
        required
        error={f.body}
        hint="Cuộc gọi/tin nhắn gửi khách đầu tiên sẽ ghi nhận đã phản hồi"
      >
        <textarea
          id="body"
          name="body"
          required
          rows={3}
          maxLength={4000}
          dir="auto"
          defaultValue={d.str("body")}
          placeholder="Ghi tóm tắt nội dung trao đổi hoặc phản hồi của khách…"
          aria-invalid={!!f.body}
          aria-describedby={f.body ? "body-error" : undefined}
          className={cx(
            "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
            f.body ? "border-danger" : "border-border",
          )}
        />
      </Field>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <TextField
          label="Kết quả"
          name="outcome"
          maxLength={200}
          defaultValue={d.str("outcome")}
          placeholder="VD: Khách hẹn tối xác nhận địa chỉ…"
          error={f.outcome}
        />

        {type === "CALL" && (
          <TextField
            label="Thời lượng (giây)"
            name="durationSec"
            type="number"
            min={0}
            max={86400}
            defaultValue={d.str("durationSec")}
            placeholder="VD: 120"
            error={f.durationSec}
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Ghi tương tác"}
        </Button>
      </div>
    </form>
  );
}

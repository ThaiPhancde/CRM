"use client";
// Biểu mẫu ghi nhận lựa chọn liên hệ (opt-in / opt-out) ngay trong thẻ Quyền liên hệ, không mở lớp phủ.
import { useActionState, useEffect } from "react";
import { FormError, pick, SelectField, Switch, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { recordPreferenceAction } from "../actions";

const CHANNEL_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "Tin nhắn SMS" },
  { value: "PHONE", label: "Điện thoại" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MESSENGER", label: "Messenger" },
];

const PURPOSE_OPTIONS = [
  { value: "MARKETING", label: "Tiếp thị (Marketing)" },
  { value: "SERVICE", label: "Chăm sóc khách hàng" },
];

export function PreferenceForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recordPreferenceAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(state.message ?? (state.ok ? "Đã ghi lựa chọn liên hệ." : "Không thể ghi lựa chọn liên hệ."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  const d = pick(state, { channel: "EMAIL", purpose: "MARKETING", optIn: true, source: "" });
  const f = state?.fields ?? {};

  return (
    <form action={action} noValidate className="border-t border-border bg-bg-subtle px-4 py-3">
      <p className="mb-3 text-xs font-semibold text-fg">Cập nhật quyền liên hệ mới</p>
      <FormError result={state} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <SelectField
          label="Kênh liên hệ"
          name="channel"
          required
          defaultValue={d.str("channel") || "EMAIL"}
          options={CHANNEL_OPTIONS}
          error={f.channel}
        />
        <SelectField
          label="Mục đích"
          name="purpose"
          required
          defaultValue={d.str("purpose") || "MARKETING"}
          options={PURPOSE_OPTIONS}
          error={f.purpose}
        />
      </div>
      <Switch label="Khách đồng ý nhận liên hệ (bỏ chọn nếu khách từ chối)" name="optIn" defaultChecked={d.bool("optIn", true)} />
      <TextField
        label="Nguồn ghi nhận"
        name="source"
        required
        maxLength={120}
        defaultValue={d.str("source")}
        placeholder="VD: Khách gọi tổng đài, biểu mẫu website…"
        error={f.source}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Ghi lựa chọn"}
        </Button>
      </div>
    </form>
  );
}

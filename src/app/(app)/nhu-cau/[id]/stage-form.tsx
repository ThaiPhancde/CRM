"use client";
// Biểu mẫu cập nhật giai đoạn nhu cầu mua và lịch hẹn liên hệ lại.
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { LEAD_STAGES, STAGE_LABEL } from "@/modules/sales/labels";
import type { LeadDetail } from "@/modules/sales/leads";
import { changeStageAction } from "../actions";

const STAGE_OPTIONS = LEAD_STAGES.map((s) => ({
  value: s,
  label: STAGE_LABEL[s],
}));

function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const vn = new Date(d.getTime() + 7 * 3600000);
  return vn.toISOString().slice(0, 16);
}

export function StageForm({
  leadId,
  currentStage,
  currentLostReason,
  currentNextActionAt,
}: {
  leadId: string;
  currentStage: LeadDetail["stage"];
  currentLostReason: string | null;
  currentNextActionAt: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changeStageAction, null);
  const [stage, setStage] = useState<string>(currentStage);
  const toast = useToast();

  useEffect(() => {
    setStage(currentStage);
  }, [currentStage]);

  useEffect(() => {
    if (!state) return;
    toast(
      state.message ?? (state.ok ? "Đã cập nhật giai đoạn." : "Không thể cập nhật giai đoạn."),
      state.ok ? "success" : "danger",
    );
    if (!state.ok && state.values?.stage) {
      setStage(String(state.values.stage));
    }
  }, [state, toast]);

  const d = pick(state, {
    stage: currentStage,
    lostReason: currentLostReason ?? "",
    nextActionAt: toDateTimeLocal(currentNextActionAt),
  });
  const f = state?.fields ?? {};
  const needReason = stage === "TU_CHOI" || stage === "MAT_LIEN_LAC";

  return (
    <form action={action} noValidate className="p-4">
      <FormError result={state} />
      <input type="hidden" name="id" value={leadId} />

      <SelectField
        label="Giai đoạn hiện tại"
        name="stage"
        required
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        options={STAGE_OPTIONS}
        error={f.stage}
      />

      {needReason && (
        <Field
          label="Lý do chưa mua"
          name="lostReason"
          required
          error={f.lostReason}
          hint="Bắt buộc khi chuyển sang Từ chối hoặc Mất liên lạc."
        >
          <textarea
            id="lostReason"
            name="lostReason"
            required
            rows={2}
            maxLength={500}
            defaultValue={d.str("lostReason")}
            placeholder="Nhập lý do khách từ chối hoặc mất liên lạc…"
            aria-invalid={!!f.lostReason}
            aria-describedby={f.lostReason ? "lostReason-error" : undefined}
            className={cx(
              "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
              f.lostReason ? "border-danger" : "border-border",
            )}
          />
        </Field>
      )}

      <TextField
        label="Hẹn liên hệ lại"
        name="nextActionAt"
        type="datetime-local"
        defaultValue={d.str("nextActionAt")}
        error={f.nextActionAt}
      />

      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu giai đoạn"}
        </Button>
      </div>
    </form>
  );
}

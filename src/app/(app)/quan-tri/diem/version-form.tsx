"use client";
// Biểu mẫu đổi trọng số tạo phiên bản điểm mới (inline trong Card cấu hình điểm, không mở drawer).
import { useActionState, useEffect, useState } from "react";
import { FormError, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Badge, Button, cx } from "@/components/ui";
import { createScoreVersionAction } from "./actions";

export type WeightedScoreType = "SALES_PRIORITY" | "TXN_RISK" | "SUPPORT_NEED";

const PART_LABEL: Record<string, string> = {
  fit: "Nhu cầu phù hợp",
  intent: "Tín hiệu mua",
  engagement: "Tương tác",
  readiness: "Sẵn sàng đặt",
  failRate: "Từ chối nhận",
  missingInfo: "Thiếu thông tin",
  address: "Địa chỉ",
  openTickets: "Ticket mở",
  severity: "Mức nghiêm trọng",
  wait: "Thời gian chờ",
};

type Props = {
  type: WeightedScoreType;
  activeVersion: number;
  initialWeights: Record<string, number>;
};

export function VersionForm({ type, activeVersion, initialWeights }: Props) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createScoreVersionAction, null);
  const toast = useToast();
  const keys = Object.keys(initialWeights);
  const [weights, setWeights] = useState<Record<string, number>>(() => ({ ...initialWeights }));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Đã tạo phiên bản trọng số mới.", "success");
      setNote("");
    }
  }, [state, toast]);

  const sum = keys.reduce((acc, k) => {
    const v = weights[k];
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
  const isSumValid = sum === 100;
  const fields = state?.fields ?? {};

  return (
    <form action={action} noValidate className="border-t border-border bg-bg-subtle px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            Tạo phiên bản trọng số mới (kế tiếp v{activeVersion + 1})
          </h3>
          <p className="text-xs text-fg-muted">
            Điểm là giả thuyết v1, không phải xác suất mua. Tổng các thành phần phải bằng đúng 100.
          </p>
        </div>
        <Badge tone={isSumValid ? "success" : "danger"}>Tổng: {sum}/100</Badge>
      </div>

      <FormError result={state} />
      <input type="hidden" name="type" value={type} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => {
          const inputId = `${type}-w-${key}`;
          const label = PART_LABEL[key] ?? key;
          const val = weights[key] ?? 0;
          return (
            <div key={key}>
              <label htmlFor={inputId} className="mb-1 block text-[13px] font-medium text-fg">
                {label}
                <span className="ml-0.5 text-brand" aria-hidden>*</span>
              </label>
              <input
                id={inputId}
                name={`w.${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                required
                value={Number.isFinite(val) ? val : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? 0 : parseInt(raw, 10);
                  setWeights((prev) => ({ ...prev, [key]: Number.isNaN(parsed) ? 0 : parsed }));
                }}
                className={cx(
                  "tabular h-9 w-full rounded-[var(--radius-sm)] border bg-bg px-3 text-sm text-fg focus:border-brand-ring",
                  fields.weights || !isSumValid ? "border-danger" : "border-border",
                )}
              />
            </div>
          );
        })}
      </div>

      {!isSumValid && (
        <p className="mb-3 text-xs text-danger" role="alert">
          Tổng trọng số hiện tại là {sum}/100 — vui lòng điều chỉnh các thành phần để tổng bằng 100 trước khi lưu.
        </p>
      )}
      {fields.weights && (
        <p className="mb-3 text-xs text-danger" role="alert">
          {fields.weights}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor={`${type}-note`} className="mb-1 block text-[13px] font-medium text-fg">
          Ghi chú lý do đổi trọng số
          <span className="ml-0.5 text-brand" aria-hidden>*</span>
        </label>
        <textarea
          id={`${type}-note`}
          name="note"
          required
          minLength={3}
          maxLength={300}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Tăng trọng số tín hiệu mua cho chiến dịch mùa cao điểm…"
          aria-invalid={!!fields.note}
          className={cx(
            "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
            fields.note ? "border-danger" : "border-border",
          )}
        />
        {fields.note && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {fields.note}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setWeights({ ...initialWeights });
            setNote("");
          }}
        >
          Đặt lại theo bản đang dùng
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={pending || !isSumValid}>
          {pending ? "Đang tạo phiên bản…" : "Lưu phiên bản mới"}
        </Button>
      </div>
    </form>
  );
}

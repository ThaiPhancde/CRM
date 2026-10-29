"use client";
// Biểu mẫu trả lời khách hàng (hàng đợi gửi giả lập) hoặc ghi chú nội bộ trên ticket có khóa chống gửi trùng.
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { replyTicketAction } from "../actions";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(replyTicketAction, null);
  const [kind, setKind] = useState<"REPLY" | "NOTE">("REPLY");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => setIdempotencyKey(crypto.randomUUID()), []);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    toast(
      state.message ?? (state.ok ? "Đã lưu phản hồi." : "Không thể lưu phản hồi."),
      state.ok ? "success" : "danger",
    );
    if (state.ok) {
      setIdempotencyKey(crypto.randomUUID());
    } else if (state.values?.kind === "REPLY" || state.values?.kind === "NOTE") {
      setKind(state.values.kind);
    }
  }, [state, toast]);

  const d = pick(state, { kind, body: "" });
  const f = state?.fields ?? {};

  return (
    <form action={action} noValidate className="p-4">
      <FormError result={state} />
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="mb-3">
        <div
          role="group"
          aria-label="Chọn hình thức phản hồi"
          className="inline-flex rounded-[var(--radius-sm)] border border-border bg-bg-subtle p-0.5"
        >
          <button
            type="button"
            aria-pressed={kind === "REPLY"}
            onClick={() => setKind("REPLY")}
            className={cx(
              "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
              kind === "REPLY"
                ? "bg-brand text-white shadow-sm"
                : "text-fg-muted hover:text-fg",
            )}
          >
            Trả lời khách
          </button>
          <button
            type="button"
            aria-pressed={kind === "NOTE"}
            onClick={() => setKind("NOTE")}
            className={cx(
              "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
              kind === "NOTE"
                ? "bg-warning text-white shadow-sm"
                : "text-fg-muted hover:text-fg",
            )}
          >
            Ghi chú nội bộ
          </button>
        </div>
        {f.kind && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {f.kind}
          </p>
        )}
      </div>

      <Field
        label={kind === "REPLY" ? "Nội dung trả lời khách" : "Nội dung ghi chú nội bộ"}
        name="body"
        required
        error={f.body}
        hint={
          kind === "REPLY"
            ? "Demo: tin được ghi vào hàng đợi gửi, không gửi ra ngoài"
            : "Ghi chú nội bộ chỉ hiển thị cho nhân viên chăm sóc và quản lý"
        }
      >
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          maxLength={4000}
          dir="auto"
          defaultValue={d.str("body")}
          placeholder={
            kind === "REPLY"
              ? "Nhập nội dung phản hồi gửi tới khách hàng…"
              : "Nhập ghi chú nội bộ cho nhóm xử lý…"
          }
          aria-invalid={!!f.body}
          aria-describedby={f.body ? "body-error" : undefined}
          className={cx(
            "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
            f.body ? "border-danger" : "border-border",
          )}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending
            ? "Đang gửi…"
            : kind === "REPLY"
              ? "Gửi trả lời khách"
              : "Lưu ghi chú nội bộ"}
        </Button>
      </div>
    </form>
  );
}

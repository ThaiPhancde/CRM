"use client";
// Nút phê duyệt hoặc từ chối yêu cầu AI (công cụ hoặc đề xuất cập nhật nhu cầu) kèm ghi chú tùy chọn.
import { useActionState, useEffect, useState } from "react";
import { ConfirmButton } from "@/components/confirm";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { decideApprovalAction } from "./actions";

export function ApprovalButtons({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(decideApprovalAction, null);
  const [note, setNote] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (state?.message) {
      toast(state.message, state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  const noteId = `approval-note-${id}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label htmlFor={noteId} className="sr-only">
        Ghi chú phê duyệt
      </label>
      <input
        id={noteId}
        type="text"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (tùy chọn)…"
        className="h-8 w-36 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-xs text-fg placeholder:text-fg-subtle focus:border-brand-ring"
      />
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="approve" value="1" />
        <input type="hidden" name="note" value={note} />
        <Button type="submit" size="sm" variant="primary" aria-label={`Duyệt yêu cầu ${id}`} disabled={pending}>
          {pending ? "Đang xử lý…" : "Duyệt"}
        </Button>
      </form>
      <ConfirmButton
        action={decideApprovalAction}
        fields={{ id, approve: "0", note }}
        label="Từ chối"
        ariaLabel={`Từ chối yêu cầu ${id}`}
        title="Từ chối yêu cầu này?"
        description="Hành động do AI đề xuất sẽ bị hủy và không được thực thi."
        confirmLabel="Từ chối"
        danger
        okMessage="Đã từ chối yêu cầu."
      />
    </div>
  );
}

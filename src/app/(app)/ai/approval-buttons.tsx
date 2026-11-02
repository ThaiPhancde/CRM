"use client";
// Nút phê duyệt hoặc từ chối yêu cầu AI (công cụ hoặc đề xuất cập nhật nhu cầu) kèm ghi chú tùy chọn.
import { useActionState, useEffect, useState } from "react";
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
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Đang xử lý…" : "Duyệt"}
        </Button>
      </form>
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm("Bạn chắc chắn muốn từ chối yêu cầu này?")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="approve" value="0" />
        <input type="hidden" name="note" value={note} />
        <Button type="submit" size="sm" variant="danger" disabled={pending}>
          Từ chối
        </Button>
      </form>
    </div>
  );
}

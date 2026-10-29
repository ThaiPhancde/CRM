"use client";
// Nút cập nhật trạng thái nhiệm vụ: Xong, Hủy (xác nhận) hoặc Mở lại.
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { setTaskStatusAction } from "./actions";

function StatusActionButton({
  id,
  targetStatus,
  label,
  variant,
  confirmMessage,
}: {
  id: string;
  targetStatus: "OPEN" | "DONE" | "CANCELLED";
  label: string;
  variant: "primary" | "secondary" | "ghost" | "danger";
  confirmMessage?: string;
}) {
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(setTaskStatusAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(state.message ?? (state.ok ? "Đã cập nhật trạng thái việc." : "Không thể cập nhật trạng thái việc."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={targetStatus} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

export function TaskButtons({
  id,
  status,
}: {
  id: string;
  status: "OPEN" | "DONE" | "CANCELLED";
}) {
  if (status === "OPEN") {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <StatusActionButton id={id} targetStatus="DONE" label="Xong" variant="primary" />
        <StatusActionButton
          id={id}
          targetStatus="CANCELLED"
          label="Hủy"
          variant="ghost"
          confirmMessage="Hủy nhiệm vụ này? Bạn có thể mở lại sau nếu cần."
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <StatusActionButton id={id} targetStatus="OPEN" label="Mở lại" variant="secondary" />
    </div>
  );
}

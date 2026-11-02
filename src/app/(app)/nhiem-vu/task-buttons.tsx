"use client";
// Nút cập nhật trạng thái nhiệm vụ: Xong, Hủy (xác nhận) hoặc Mở lại.
import { useActionState, useEffect } from "react";
import { ConfirmButton } from "@/components/confirm";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { setTaskStatusAction } from "./actions";

function StatusActionButton({
  id,
  targetStatus,
  label,
  ariaLabel,
  variant,
}: {
  id: string;
  targetStatus: "OPEN" | "DONE";
  label: string;
  ariaLabel: string;
  variant: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(setTaskStatusAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(state.message || (state.ok ? "Đã cập nhật trạng thái việc." : "Không thể cập nhật trạng thái việc."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={targetStatus} />
      <Button type="submit" size="sm" variant={variant} aria-label={ariaLabel} disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

export function TaskButtons({
  id,
  status,
  title,
}: {
  id: string;
  status: "OPEN" | "DONE" | "CANCELLED";
  title?: string;
}) {
  const context = title ?? id;

  if (status === "OPEN") {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <StatusActionButton
          id={id}
          targetStatus="DONE"
          label="Xong"
          ariaLabel={`Xong nhiệm vụ ${context}`}
          variant="primary"
        />
        <ConfirmButton
          action={setTaskStatusAction}
          fields={{ id, status: "CANCELLED" }}
          label="Hủy"
          ariaLabel={`Hủy nhiệm vụ ${context}`}
          title="Hủy nhiệm vụ này?"
          description="Nhiệm vụ sẽ chuyển sang trạng thái đã hủy; bạn vẫn có thể mở lại sau nếu cần."
          confirmLabel="Hủy nhiệm vụ"
          danger
          variant="ghost"
          okMessage="Đã cập nhật trạng thái việc."
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <StatusActionButton
        id={id}
        targetStatus="OPEN"
        label="Mở lại"
        ariaLabel={`Mở lại nhiệm vụ ${context}`}
        variant="secondary"
      />
    </div>
  );
}

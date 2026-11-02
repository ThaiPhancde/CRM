"use client";
import { useActionState, useEffect } from "react";
import { ConfirmButton } from "@/components/confirm";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/components/form";
import { linkAction, rejectAction, unmergeAction } from "./actions";

function Act({
  action,
  id,
  label,
  ariaLabel,
  variant,
}: {
  action: (s: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  id: string;
  label: string;
  ariaLabel: string;
  variant: "primary" | "secondary" | "ghost";
}) {
  const [state, run, pending] = useActionState(action, null);
  const toast = useToast();
  useEffect(() => {
    if (state) {
      toast(state.message || (state.ok ? "Đã cập nhật xác minh đơn." : "Không thực hiện được."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);
  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} aria-label={ariaLabel} disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

export function ReviewButtons({ id, unmerge, orderNumber }: { id: string; unmerge?: boolean; orderNumber?: string }) {
  const context = orderNumber ?? id;
  if (unmerge) {
    return (
      <ConfirmButton
        action={unmergeAction}
        fields={{ id }}
        label="Tách lại"
        ariaLabel={`Tách lại đơn ${context}`}
        title="Tách lại thành hai đơn?"
        description="Hai đơn sẽ được tách riêng về trạng thái như trước khi gộp."
        confirmLabel="Tách lại đơn"
        okMessage="Đã tách lại thành hai đơn."
      />
    );
  }
  return (
    <>
      <Act
        action={rejectAction}
        id={id}
        label="Không phải cùng đơn"
        ariaLabel={`Không phải cùng đơn ${context}`}
        variant="secondary"
      />
      <ConfirmButton
        action={linkAction}
        fields={{ id }}
        label="Cùng một đơn — gộp"
        ariaLabel={`Gộp đơn ${context}`}
        variant="primary"
        title="Gộp hai đơn thành một?"
        description="Doanh thu chỉ tính một lần; bạn có thể tách lại sau nếu cần."
        confirmLabel="Gộp hai đơn"
        okMessage="Đã gộp hai đơn thành một."
      />
    </>
  );
}

"use client";
// Nút "Tính lại ngay" — dựng lại chỉ số R12M và chấm điểm toàn bộ khách hàng của team.
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { recomputeAction } from "./actions";

const CONFIRM_MESSAGE = "Dựng lại chỉ số và chấm điểm toàn bộ khách của team? Có thể mất vài chục giây.";

export function RecomputeButton() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recomputeAction, null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã dựng chỉ số và chấm điểm lại cho toàn bộ khách hàng.", "success");
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(CONFIRM_MESSAGE)) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? "Đang tính lại…" : "Tính lại ngay"}
      </Button>
    </form>
  );
}

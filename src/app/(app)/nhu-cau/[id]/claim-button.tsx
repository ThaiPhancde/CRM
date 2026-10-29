"use client";
// Nút nhận lead chưa có người phụ trách về cho Sales hiện tại.
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { claimLeadAction } from "../actions";

export function ClaimButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(claimLeadAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(
        state.message ?? (state.ok ? "Bạn đã nhận lead này." : "Không thể nhận lead này."),
        state.ok ? "success" : "danger",
      );
    }
  }, [state, toast]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={leadId} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Đang nhận…" : "Nhận lead này"}
      </Button>
    </form>
  );
}

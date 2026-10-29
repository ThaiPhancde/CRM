"use client";
// Nút đánh dấu thông báo đã đọc (tất cả hoặc từng thông báo) qua server action markReadAction.
import { useActionState, useEffect } from "react";
import { markReadAction } from "@/app/(app)/nhiem-vu/actions";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";

export function MarkReadButton({
  id = "",
  label = "Đánh dấu đã đọc tất cả",
  variant = "secondary",
}: {
  id?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(markReadAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(
        state.message ?? (state.ok ? "Đã đánh dấu đã đọc." : "Không thể cập nhật thông báo."),
        state.ok ? "success" : "danger",
      );
    }
  }, [state, toast]);

  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

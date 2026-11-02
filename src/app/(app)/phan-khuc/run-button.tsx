"use client";
// Nút "Chạy ngay": tính lại danh sách khách của phân khúc (lưu ảnh chụp mới, xóa danh sách lần trước — D-55).
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { runSegmentAction } from "./actions";

export function RunButton({ id, name }: { id: string; name?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(runSegmentAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state) toast(state.message ?? (state.ok ? "Đã chạy." : "Không chạy được."), state.ok ? "success" : "danger");
  }, [state, toast]);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button size="sm" type="submit" disabled={pending} aria-label={name ? `Chạy ngay phân khúc ${name}` : undefined}>{pending ? "Đang chạy…" : "Chạy ngay"}</Button>
    </form>
  );
}

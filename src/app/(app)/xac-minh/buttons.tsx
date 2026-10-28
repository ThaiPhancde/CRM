"use client";
import { useActionState, useEffect } from "react";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/components/form";
import { linkAction, rejectAction, unmergeAction } from "./actions";

function Act({ action, id, label, variant, confirm }: { action: (s: ActionResult | null, fd: FormData) => Promise<ActionResult>; id: string; label: string; variant: "primary" | "secondary" | "ghost"; confirm?: string }) {
  const [state, run, pending] = useActionState(action, null);
  const toast = useToast();
  useEffect(() => {
    if (state) toast(state.message ?? "", state.ok ? "success" : "danger");
  }, [state, toast]);
  return (
    <form action={run} onSubmit={(e) => confirm && !window.confirm(confirm) && e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>{pending ? "Đang xử lý…" : label}</Button>
    </form>
  );
}

export function ReviewButtons({ id, unmerge }: { id: string; unmerge?: boolean }) {
  if (unmerge) return <Act action={unmergeAction} id={id} label="Tách lại" variant="secondary" confirm="Tách lại thành hai đơn như trước khi gộp?" />;
  return (
    <>
      <Act action={rejectAction} id={id} label="Không phải cùng đơn" variant="secondary" />
      <Act action={linkAction} id={id} label="Cùng một đơn — gộp" variant="primary" confirm="Gộp hai đơn thành một? Doanh thu chỉ tính một lần; có thể tách lại sau." />
    </>
  );
}

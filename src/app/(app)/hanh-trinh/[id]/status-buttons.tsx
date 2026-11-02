"use client";
// Bật / tạm dừng hành trình. Bật cần quyền journey.activate (Quản lý) — kiểm lại ở server.
import { useActionState, useEffect } from "react";
import type { JourneyStatus } from "@prisma/client";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { setJourneyStatusAction } from "../actions";

export function JourneyStatusButtons({ id, status, canActivate }: { id: string; status: JourneyStatus; canActivate: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setJourneyStatusAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state) toast(state.message ?? "", state.ok ? "success" : "danger");
  }, [state, toast]);

  const next: { to: JourneyStatus; label: string; primary?: boolean; confirm?: string } | null =
    status === "ACTIVE" ? { to: "PAUSED", label: "Tạm dừng", confirm: "Tạm dừng hành trình? Khách đang ở giữa sẽ đứng yên tới khi bật lại." }
    : canActivate ? { to: "ACTIVE", label: status === "PAUSED" ? "Bật lại" : "Bật hành trình", primary: true, confirm: "Bật hành trình? Worker sẽ đưa khách trong phân khúc vào và bắt đầu gửi tin (giả lập)." }
    : null;
  if (!next) return <span className="text-xs text-fg-muted">Chờ Quản lý bật</span>;
  return (
    <form action={action} onSubmit={(e) => { if (next.confirm && !window.confirm(next.confirm)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next.to} />
      <Button type="submit" variant={next.primary ? "primary" : "secondary"} disabled={pending}>{pending ? "Đang lưu…" : next.label}</Button>
    </form>
  );
}

"use client";
// Nút chuyển trạng thái chiến dịch: Nháp → Đang chạy, Đang chạy → Đã kết thúc (có xác nhận), Đã kết thúc → Đang chạy.
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import type { CampaignDetail } from "@/modules/marketing/campaigns";
import { setCampaignStatusAction } from "../actions";

export function StatusButtons({
  id,
  status,
}: {
  id: string;
  status: CampaignDetail["status"];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setCampaignStatusAction, null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã cập nhật trạng thái chiến dịch.", "success");
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const nextStatus: CampaignDetail["status"] = status === "RUNNING" ? "ENDED" : "RUNNING";
  const label =
    status === "DRAFT"
      ? "Bắt đầu chạy"
      : status === "RUNNING"
        ? "Kết thúc"
        : "Mở lại";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (status === "RUNNING" && !window.confirm("Bạn có chắc chắn muốn kết thúc chiến dịch này?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

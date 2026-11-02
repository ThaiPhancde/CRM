"use client";
// Nút chuyển trạng thái chiến dịch: Nháp → Đang chạy, Đang chạy → Đã kết thúc (có xác nhận), Đã kết thúc → Đang chạy.
import { useActionState, useEffect } from "react";
import { ConfirmButton } from "@/components/confirm";
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

  if (status === "RUNNING") {
    return (
      <ConfirmButton
        action={setCampaignStatusAction}
        fields={{ id, status: "ENDED" }}
        label="Kết thúc"
        size="md"
        danger
        variant="secondary"
        title="Kết thúc chiến dịch này?"
        description="Chiến dịch sẽ ngừng ghi nhận điểm chạm mới cho tới khi được mở lại."
        confirmLabel="Kết thúc chiến dịch"
        okMessage="Đã cập nhật trạng thái chiến dịch."
      />
    );
  }

  const label = status === "DRAFT" ? "Bắt đầu chạy" : "Mở lại";

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="RUNNING" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

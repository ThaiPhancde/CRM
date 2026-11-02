"use client";
// Bật / tạm dừng hành trình. Bật cần quyền journey.activate (Quản lý) — kiểm lại ở server.
import type { JourneyStatus } from "@prisma/client";
import { ConfirmButton } from "@/components/confirm";
import { setJourneyStatusAction } from "../actions";

export function JourneyStatusButtons({ id, status, canActivate }: { id: string; status: JourneyStatus; canActivate: boolean }) {
  if (status === "ACTIVE") {
    return (
      <ConfirmButton
        action={setJourneyStatusAction}
        fields={{ id, status: "PAUSED" }}
        label="Tạm dừng"
        size="md"
        variant="secondary"
        title="Tạm dừng hành trình này?"
        description="Khách hàng đang ở giữa hành trình sẽ đứng yên tại bước hiện tại cho tới khi bật lại."
        confirmLabel="Tạm dừng"
        okMessage="Đã tạm dừng hành trình."
      />
    );
  }

  if (!canActivate) {
    return <span className="text-xs text-fg-muted">Chờ Quản lý bật</span>;
  }

  const isPaused = status === "PAUSED";
  const label = isPaused ? "Bật lại" : "Bật hành trình";

  return (
    <ConfirmButton
      action={setJourneyStatusAction}
      fields={{ id, status: "ACTIVE" }}
      label={label}
      size="md"
      variant="primary"
      title={isPaused ? "Bật lại hành trình này?" : "Bật hành trình này?"}
      description="Hệ thống sẽ đưa khách hàng thuộc phân khúc vào hành trình và bắt đầu gửi tin tự động."
      confirmLabel={label}
      okMessage="Đã bật hành trình."
    />
  );
}

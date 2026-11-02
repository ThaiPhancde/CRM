"use client";
// Nút "Tính lại ngay" — dựng lại chỉ số R12M và chấm điểm toàn bộ khách hàng của team.
import { ConfirmButton } from "@/components/confirm";
import { recomputeAction } from "./actions";

export function RecomputeButton() {
  return (
    <ConfirmButton
      action={recomputeAction}
      fields={{}}
      label="Tính lại ngay"
      size="md"
      variant="primary"
      title="Tính lại điểm toàn bộ khách hàng?"
      description="Hệ thống sẽ dựng lại chỉ số 12 tháng và chấm điểm lại cho toàn bộ khách hàng; có thể mất vài chục giây."
      confirmLabel="Tính lại điểm"
      okMessage="Đã dựng chỉ số và chấm điểm lại cho toàn bộ khách hàng."
    />
  );
}

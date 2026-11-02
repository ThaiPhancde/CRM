"use client";
// Nút tách lại hồ sơ khách hàng đã gộp — yêu cầu xác nhận trước khi thực hiện.
import { ConfirmButton } from "@/components/confirm";
import { unmergeCustomerAction } from "../actions";

export function UnmergeButton({ mergeId, customerName }: { mergeId: string; customerName?: string }) {
  return (
    <ConfirmButton
      action={unmergeCustomerAction}
      fields={{ id: mergeId }}
      label="Tách lại"
      ariaLabel={`Tách lại hồ sơ ${customerName ?? mergeId}`}
      title="Tách lại hồ sơ khách hàng này?"
      description="Các danh tính, đơn hàng, địa chỉ và lựa chọn liên hệ đã chuyển khi gộp sẽ trả về hồ sơ cũ."
      confirmLabel="Tách lại hồ sơ"
      okMessage="Đã tách lại hồ sơ."
    />
  );
}

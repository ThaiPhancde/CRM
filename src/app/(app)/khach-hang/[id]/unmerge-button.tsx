"use client";
// Nút tách lại hồ sơ khách hàng đã gộp — yêu cầu xác nhận trước khi thực hiện.
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { unmergeCustomerAction } from "../actions";

export function UnmergeButton({ mergeId }: { mergeId: string }) {
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(unmergeCustomerAction, null);
  const toast = useToast();

  useEffect(() => {
    if (state) {
      toast(state.message ?? (state.ok ? "Đã tách lại hồ sơ." : "Không thể tách hồ sơ."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm("Tách lại hồ sơ khách hàng này? Các danh tính, đơn hàng, địa chỉ và lựa chọn liên hệ đã chuyển khi gộp sẽ trả về hồ sơ cũ.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={mergeId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Đang xử lý…" : "Tách lại"}
      </Button>
    </form>
  );
}

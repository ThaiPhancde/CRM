"use client";
// Biểu mẫu đặt hạn mức ngân sách AI hàng tháng (USD); để trống nghĩa là không giới hạn.
import { useActionState, useEffect, useState } from "react";
import { FormError, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { setBudgetAction } from "./actions";

export function BudgetForm({ limit }: { limit?: number | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setBudgetAction, null);
  const [monthlyUsd, setMonthlyUsd] = useState<string>(limit != null ? String(limit) : "");
  const toast = useToast();

  useEffect(() => {
    setMonthlyUsd(limit != null ? String(limit) : "");
  }, [limit]);

  useEffect(() => {
    if (state?.message) {
      toast(state.message, state.ok ? "success" : "danger");
    }
  }, [state, toast]);

  return (
    <form action={action} className="mt-4 space-y-2 border-t border-border pt-3">
      <FormError result={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="monthlyUsd" className="mb-1 block text-xs font-medium text-fg">
            Hạn mức ngân sách tháng (USD, để trống = không giới hạn)
          </label>
          <input
            id="monthlyUsd"
            name="monthlyUsd"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            value={monthlyUsd}
            onChange={(e) => setMonthlyUsd(e.target.value)}
            placeholder="Không giới hạn"
            className="tabular h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring"
          />
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu hạn mức"}
        </Button>
      </div>
    </form>
  );
}

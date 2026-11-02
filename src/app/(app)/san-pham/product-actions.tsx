"use client";
// Nút "Lấy giá vốn từ Mua hàng" và ô ánh xạ mã SKU nguồn → biến thể (dùng trên /san-pham).
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { mapSkuAction, syncCostsAction } from "./actions";

function useResultToast(state: ActionResult | null) {
  const toast = useToast();
  useEffect(() => {
    if (state?.message) toast(state.message, state.ok ? "success" : "danger");
  }, [state, toast]);
}

/** Ghi giá vốn hiện hành của Mua hàng vào danh mục (chỉ biến thể có giá khác). */
export function SyncCostsButton({ pending: count }: { pending: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(syncCostsAction, null);
  useResultToast(state);
  return (
    <form action={action}>
      <Button type="submit" disabled={pending || count === 0} title={count === 0 ? "Giá vốn đã khớp với Mua hàng" : undefined}>
        {pending ? "Đang lấy…" : `Lấy giá vốn từ Mua hàng${count ? ` (${count})` : ""}`}
      </Button>
    </form>
  );
}

/** Một dòng mã nguồn chưa khớp: chọn biến thể rồi gắn. */
export function MapSkuForm({ sourceSku, variants }: { sourceSku: string; variants: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(mapSkuAction, null);
  useResultToast(state);
  const id = `map-${sourceSku}`;
  return (
    <form action={action} noValidate className="flex items-center gap-2">
      <input type="hidden" name="sourceSku" value={sourceSku} />
      <label htmlFor={id} className="sr-only">Biến thể cho mã {sourceSku}</label>
      <select id={id} name="variantId" required defaultValue="" className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus:border-brand-ring">
        <option value="" disabled>Chọn biến thể…</option>
        {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <Button type="submit" size="sm" disabled={pending} aria-label={`Gắn mã ${sourceSku} vào biến thể đã chọn`}>{pending ? "Đang gắn…" : "Gắn"}</Button>
    </form>
  );
}

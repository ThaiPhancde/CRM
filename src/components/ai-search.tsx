"use client";
// Tìm tự nhiên ở thanh trên (HLD §14.1 mục 2): câu tự do → bộ lọc minh bạch; người dùng bỏ bớt bộ lọc rồi mới mở danh sách.
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { searchAction, type AiResult } from "@/app/(app)/ai/actions";
import { Button } from "./ui";

type Out = { target: "orders" | "customers"; filters: Record<string, string>; explain: { field: string; value: string; phrase: string; label: string }[]; href: string; message?: string };
const FIELD: Record<string, string> = { fulfillment: "Giao hàng", status: "Trạng thái", market: "Thị trường", from: "Từ ngày", to: "Đến ngày", lastFrom: "Mua từ", lastTo: "Mua đến", repeat: "Mua lại", q: "Từ khóa" };

export function AiSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AiResult | null>(null);
  const [drop, setDrop] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const out = res?.ok ? (res.output as Out) : null;
  const go = () => {
    if (!out) return;
    const p = new URLSearchParams(Object.entries(out.filters).filter(([k]) => !drop.includes(k)));
    router.push(`/${out.target === "orders" ? "don-hang" : "khach-hang"}?${p.toString()}`);
    setRes(null); setQ("");
  };

  return (
    <div ref={box} className="relative w-full max-w-md" onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setRes(null); }}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim().length > 1) start(async () => { setDrop([]); setRes(await searchAction(q)); }); }}>
        <label htmlFor="ai-search" className="sr-only">Tìm bằng câu tự nhiên</label>
        <input id="ai-search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder={pending ? "Đang hiểu câu tìm…" : "Tìm tự nhiên: “đơn giao thất bại ở UAE tháng này”"}
          className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg-subtle px-3 text-sm placeholder:text-fg-subtle focus:border-brand-ring focus:bg-bg" />
      </form>
      {res && (
        <div className="absolute left-0 right-0 top-11 z-[var(--z-dropdown)] rounded-[var(--radius-md)] border border-border bg-bg p-3 shadow-lg" aria-live="polite">
          {!res.ok ? <p className="text-sm text-danger" role="alert">{res.message}</p> : !out || out.explain.length === 0 ? (
            <p className="text-sm text-fg-muted">{(res.output as { message?: string }).message ?? "Chưa nhận ra bộ lọc nào. Thử nêu trạng thái giao, thị trường hoặc khoảng thời gian."}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-fg-muted">Đã hiểu là tìm <strong className="text-fg">{out.target === "orders" ? "đơn hàng" : "khách hàng"}</strong> với bộ lọc (bấm × để bỏ):</p>
              <ul className="flex flex-wrap gap-1.5">
                {out.explain.filter((e) => !drop.includes(e.field)).map((e) => (
                  <li key={e.field} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-fg">
                    <span title={`từ cụm “${e.phrase}”`}>{FIELD[e.field] ?? e.field}: {e.label}</span>
                    <button type="button" onClick={() => setDrop((d) => [...d, e.field])} aria-label={`Bỏ bộ lọc ${FIELD[e.field] ?? e.field}`} className="text-fg-muted hover:text-danger">×</button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setRes(null)}>Đóng</Button>
                <Button size="sm" variant="primary" onClick={go}>Mở danh sách</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

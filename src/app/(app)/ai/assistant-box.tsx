"use client";
// Ô trợ lý: câu lệnh tự nhiên → tool (tạo việc/lịch hẹn, tìm khách/đơn, hỏi báo cáo). Tên khách mơ hồ → danh sách để chọn, AI không tự đoán.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from "@/modules/ai/labels";
import { assistantAction, type AiResult } from "./actions";
import { EvidenceList } from "./evidence";

type Out = {
  kind?: "task" | "pending" | "report" | "customers" | "orders"; message?: string; text?: string;
  candidates?: { id: string; name: string; phone: string | null; market: string | null }[]; pending?: { text: string };
  facts?: string[]; hypothesis?: string | null; period?: string; scope?: string; source?: string; freshness?: string | null; moneyHidden?: boolean;
  rows?: { id: string; orderNumber: string; customer: string; fulfillment: string }[]; href?: string;
};
const EXAMPLES = ["Tạo lịch hẹn với khách \"Sara Al Harbi\" lúc 10h ngày mai", "Nhắc tôi gọi lại khách Omar ngày mai", "Doanh thu giao thành công theo thị trường", "Tìm đơn giao thất bại tháng này"];

export function AssistantBox() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<AiResult | null>(null);
  const [pending, start] = useTransition();
  const ask = (t: string, customerId?: string) => start(async () => setRes(await assistantAction({ text: t, customerId })));
  const out = res?.ok ? (res.output as Out) : null;

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask(text); }} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ai-ask" className="sr-only">Yêu cầu cho trợ lý</label>
        <input id="ai-ask" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Nhập yêu cầu bằng tiếng Việt, English, العربية hoặc Deutsch…"
          className="h-10 flex-1 rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm focus:border-brand-ring" />
        <Button variant="primary" type="submit" disabled={pending || !text.trim()}>{pending ? "Đang xử lý…" : "Gửi"}</Button>
      </form>
      {!res && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-fg-muted">Ví dụ:</span>
          {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setText(e)} className="rounded-full border border-border px-2 py-0.5 text-fg-muted hover:border-brand hover:text-brand">{e}</button>)}
        </div>
      )}
      {res && !res.ok && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">{res.message}</p>}
      {res?.ok && out && (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-border p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={RUN_STATUS_TONE[res.status as keyof typeof RUN_STATUS_TONE] ?? "neutral"}>{RUN_STATUS_LABEL[res.status as keyof typeof RUN_STATUS_LABEL] ?? res.status}</Badge>
            <Link href={`/ai/${res.runId}`} className="text-xs text-fg-muted hover:text-brand">Xem lần chạy</Link>
          </div>
          {(out.message || out.text) && <p className="text-sm text-fg">{out.text ?? out.message}</p>}
          {out.candidates && out.candidates.length > 0 && (
            <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
              {out.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span><Link href={`/khach-hang/${c.id}`} className="font-medium text-fg hover:text-brand">{c.name}</Link> <span className="text-fg-muted">{[c.market, c.phone].filter(Boolean).join(" · ")}</span></span>
                  {out.pending && <Button size="sm" disabled={pending} onClick={() => ask(out.pending!.text, c.id)}>Chọn khách này</Button>}
                </li>
              ))}
            </ul>
          )}
          {out.kind === "report" && (
            <div className="space-y-2 text-sm">
              {out.facts && out.facts.length > 0 && (
                <div><p className="text-xs font-medium text-fg-muted">Dữ kiện</p><ul className="list-disc pl-5">{out.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>
              )}
              {out.hypothesis && <p className="rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-fg">{out.hypothesis}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                <dt>Kỳ</dt><dd>{out.period}</dd><dt>Phạm vi</dt><dd>{out.scope}</dd><dt>Nguồn</dt><dd>{out.source}</dd>
              </dl>
            </div>
          )}
          {out.kind === "orders" && out.rows && (
            <div className="text-sm">
              <ul className="list-disc pl-5">{out.rows.map((o) => <li key={o.id}><Link href={`/don-hang/${o.id}`} className="hover:text-brand">{o.orderNumber}</Link> · {o.customer}</li>)}</ul>
              {out.href && <Link href={out.href} className="text-xs text-brand">Mở danh sách đơn với bộ lọc này</Link>}
            </div>
          )}
          <EvidenceList items={res.evidence} compact />
        </div>
      )}
    </div>
  );
}

"use client";
// AI ở ticket / nhu cầu mua: tóm tắt hội thoại (HLD §14.1 mục 3) và soạn phản hồi đa ngôn ngữ (mục 4). Bản nháp chỉ để người gửi chỉnh
// rồi tự gửi qua ô trả lời — AI không gửi gì cho khách. Khách có nhiều đơn → chọn đơn, AI không đoán.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Drawer, useToast } from "@/components/overlay";
import { Badge, Button } from "@/components/ui";
import { FULFILLMENT_STATUS } from "@/lib/status-badge";
import { REPLY_LANGUAGES } from "@/modules/ai/labels";
import { conversationAction, draftAction, type AiResult } from "./actions";
import { EvidenceList, type Ev } from "./evidence";

type Conv = { bullets: { text: string; evidence: Ev[] }[]; waitingForReply: boolean; suggestion: { id: string; interest: string } | null };
type Draft = { text?: string; language?: string; message?: string; candidates?: { id: string; orderNumber: string; fulfillment: string; bookedAt: string }[] };

export function ConversationPanel({ ticketId, leadId, canDraft, defaultLanguage = "vi" }: { ticketId?: string; leadId?: string; canDraft: boolean; defaultLanguage?: string }) {
  const [mode, setMode] = useState<"conv" | "draft" | null>(null);
  const [conv, setConv] = useState<AiResult | null>(null);
  const [draft, setDraft] = useState<AiResult | null>(null);
  const [text, setText] = useState("");
  const [lang, setLang] = useState(REPLY_LANGUAGES.some((l) => l.value === defaultLanguage) ? defaultLanguage : "vi");
  const [pending, start] = useTransition();
  const toast = useToast();
  const summarize = () => { setMode("conv"); start(async () => setConv(await conversationAction({ ticketId, leadId }))); };
  const compose = (orderId?: string) => { setMode("draft"); start(async () => { const r = await draftAction({ ticketId, leadId, language: lang, orderId }); setDraft(r); if (r.ok) setText((r.output as Draft).text ?? ""); }); };
  const c = conv?.ok ? (conv.output as Conv) : null;
  const d = draft?.ok ? (draft.output as Draft) : null;
  const res = mode === "conv" ? conv : draft;

  return (
    <>
      <Button onClick={summarize}>✦ Tóm tắt hội thoại</Button>
      {canDraft && <Button onClick={() => compose()}>✦ Soạn phản hồi</Button>}
      <Drawer open={mode !== null} onClose={() => setMode(null)} size="lg" title={mode === "conv" ? "Tóm tắt hội thoại" : "Soạn phản hồi bằng AI"}
        description={mode === "conv" ? "Từ tin nhắn trong hồ sơ này; mỗi ý dẫn tin gốc." : "Từ trạng thái đơn mới nhất và bài tri thức. Bạn sửa rồi tự gửi qua ô trả lời."}
        footer={<Button onClick={() => setMode(null)}>Đóng</Button>}>
        {pending ? <p className="text-sm text-fg-muted">Đang xử lý…</p> : res && !res.ok ? (
          <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">{res.message}</p>
        ) : mode === "conv" && c ? (
          <div className="space-y-3">
            {c.waitingForReply && <Badge tone="warning">Khách đang chờ phản hồi</Badge>}
            <ul className="space-y-3">{c.bullets.map((b, i) => <li key={i} className="space-y-1"><p className="text-sm">{b.text}</p><EvidenceList items={b.evidence} compact /></li>)}</ul>
            {c.suggestion && (
              <p className="rounded-[var(--radius-sm)] bg-brand-soft px-3 py-2 text-sm">AI đề xuất ghi nhu cầu <strong>“{c.suggestion.interest}”</strong> — đã gửi Trưởng nhóm/Quản lý duyệt ở <Link href="/ai?tab=duyet" className="text-brand">Trung tâm AI</Link>.</p>
            )}
          </div>
        ) : mode === "draft" && d ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">Ngôn ngữ
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm">
                {REPLY_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <Button size="sm" onClick={() => compose()}>Soạn lại</Button>
            </label>
            {d.candidates ? (
              <div className="space-y-2">
                <p className="text-sm text-fg">{d.message}</p>
                <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                  {d.candidates.map((o) => (
                    <li key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span><Link href={`/don-hang/${o.id}`} className="font-medium hover:text-brand">{o.orderNumber}</Link> <span className="text-fg-muted">· {new Date(o.bookedAt).toLocaleDateString("vi-VN")} · {FULFILLMENT_STATUS[o.fulfillment]?.label ?? o.fulfillment}</span></span>
                      <Button size="sm" onClick={() => compose(o.id)}>Dùng đơn này</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <label htmlFor="ai-draft" className="sr-only">Bản nháp phản hồi</label>
                <textarea id="ai-draft" value={text} onChange={(e) => setText(e.target.value)} rows={10} dir={lang === "ar" ? "rtl" : "ltr"}
                  className="w-full rounded-[var(--radius-sm)] border border-border bg-bg p-3 text-sm focus:border-brand-ring" />
                <div className="flex items-center justify-between gap-2">
                  <EvidenceList items={draft?.ok ? draft.evidence : []} compact />
                  <Button size="sm" variant="primary" onClick={() => navigator.clipboard.writeText(text).then(() => toast("Đã chép bản nháp — dán vào ô trả lời để gửi.", "success"), () => toast("Không chép được, hãy chọn và chép tay.", "danger"))}>Chép bản nháp</Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

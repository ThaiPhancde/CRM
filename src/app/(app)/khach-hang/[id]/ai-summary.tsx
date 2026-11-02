"use client";
// Nút "Tóm tắt AI" ở hồ sơ khách: drawer liệt kê từng câu kèm bằng chứng (HLD §14.1 mục 1). Mỗi lần bấm là một lần chạy có chi phí.
import Link from "next/link";
import { useState, useTransition } from "react";
import { summarizeAction, type AiResult } from "@/app/(app)/ai/actions";
import { EvidenceList, type Ev } from "@/app/(app)/ai/evidence";
import { Drawer } from "@/components/overlay";
import { Button, Skeleton } from "@/components/ui";

export function AiSummary({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<AiResult | null>(null);
  const [pending, start] = useTransition();
  // Lỗi mạng / máy chủ khi gọi action → hiện thông báo trong drawer thay vì drawer trống.
  const run = () => start(async () => {
    try { setRes(await summarizeAction(customerId)); } catch { setRes({ ok: false, message: "Không tóm tắt được (lỗi kết nối). Thử lại." } as AiResult); }
  });
  const sentences = res?.ok ? ((res.output as { sentences?: { text: string; evidence: Ev[] }[] }).sentences ?? null) : null;

  return (
    <>
      <Button onClick={() => { setOpen(true); if (!res) run(); }}>✦ Tóm tắt AI</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Tóm tắt khách bằng AI" description="Chỉ từ dữ liệu bạn được xem; mỗi câu dẫn nguồn. Bấm nguồn để kiểm tra."
        footer={<><Button onClick={() => setOpen(false)}>Đóng</Button><Button onClick={run} disabled={pending}>{pending ? "Đang tóm tắt…" : "Tóm tắt lại"}</Button></>}>
        {pending ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : res && !res.ok ? (
          <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">{res.message}</p>
        ) : res?.ok && !sentences ? (
          <p className="text-sm text-fg-muted">{(res.output as { message?: string }).message ?? "Không tóm tắt được."}</p>
        ) : sentences?.length === 0 ? (
          <p className="text-sm text-fg-muted">Chưa có dữ liệu đủ để tóm tắt.</p>
        ) : sentences ? (
          <div className="space-y-4">
            <ol className="space-y-3">
              {sentences.map((s, i) => (
                <li key={i} className="space-y-1.5 border-b border-border pb-3 last:border-0">
                  <p className="text-sm text-fg">{s.text}</p>
                  <EvidenceList items={s.evidence} compact />
                </li>
              ))}
            </ol>
            <p className="text-xs text-fg-subtle">Điểm là giả thuyết có phiên bản, không phải xác suất mua. <Link href={`/ai/${res!.ok ? res!.runId : ""}`} className="hover:text-brand">Xem lần chạy</Link></p>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

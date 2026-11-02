// Danh sách bằng chứng của một câu trả lời AI: mỗi mục trỏ về bản ghi nguồn (đơn, ticket, tin nhắn, bài tri thức, chỉ số).
import Link from "next/link";

export type Ev = { id: string; kind: string; label: string; href?: string };

export function EvidenceList({ items, compact }: { items: Ev[]; compact?: boolean }) {
  if (!items.length) return compact ? null : <p className="text-xs text-fg-subtle">Không có bằng chứng kèm theo.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Bằng chứng">
      {items.map((e) => (
        <li key={e.id}>
          {e.href ? (
            <Link href={e.href} className="inline-flex items-center rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted hover:border-brand hover:text-brand">{e.label}</Link>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">{e.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

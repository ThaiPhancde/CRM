// Bốn mốc COD (đặt → giao → thu → về) — trình bày dùng chung cho trang đơn và trang khách. Dữ liệu từ orderCodSteps (đã che tiền theo quyền).
import type { CodStep } from "@/modules/fulfillment/milestones";
import { dateTime, money } from "@/lib/format";

const STATE: Record<CodStep["state"], { label: string; dot: string; text: string }> = {
  done: { label: "Xong", dot: "border-success bg-success", text: "text-fg" },
  partial: { label: "Một phần", dot: "border-warning bg-warning-soft", text: "text-fg" },
  pending: { label: "Chưa tới", dot: "border-border-strong bg-bg", text: "text-fg-muted" },
  failed: { label: "Không đạt", dot: "border-danger bg-danger-soft", text: "text-fg" },
  skipped: { label: "Không áp dụng", dot: "border-border bg-bg-muted", text: "text-fg-subtle" },
};

export function CodSteps({ steps, currency, compact = false }: { steps: CodStep[]; currency: string; compact?: boolean }) {
  return (
    <ol className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-4"}`} aria-label="Bốn mốc COD">
      {steps.map((s) => {
        const st = STATE[s.state];
        return (
          <li key={s.key} className="min-w-0">
            <div className="flex items-center gap-2">
              <span aria-hidden className={`size-[11px] shrink-0 rounded-full border-2 ${st.dot}`} />
              <span className={`text-sm font-medium ${st.text}`}>{s.label}</span>
            </div>
            <p className="mt-0.5 pl-[19px] text-[11px] text-fg-subtle">{s.metric} · <span className="sr-only">trạng thái </span>{st.label}</p>
            {s.at && <p className="tabular pl-[19px] text-xs text-fg-muted">{dateTime(s.at)}</p>}
            {s.amount != null && <p className="tabular pl-[19px] text-xs text-fg">{money(s.amount, currency)}</p>}
            {s.note && !compact && <p className="pl-[19px] text-xs text-fg-muted">{s.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

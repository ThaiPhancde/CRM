// Thẻ hiển thị Điểm ưu tiên sales ở trang chi tiết nhu cầu mua (Phase 6 — D-11, D-33, D-52).
import { Badge, Card, SectionTitle, type Tone } from "@/components/ui";
import { dateTime, num } from "@/lib/format";
import type { getLeadScore } from "@/modules/scoring/service";

export type LeadScoreData = Awaited<ReturnType<typeof getLeadScore>>;

const BAND_LABEL: Record<string, string> = {
  CAO: "Cao",
  VUA: "Vừa",
  THAP: "Thấp",
  CHUA_DU_DU_LIEU: "Chưa đủ dữ liệu",
};

const BAND_TONE: Record<string, Tone> = {
  CAO: "success",
  VUA: "warning",
  THAP: "neutral",
  CHUA_DU_DU_LIEU: "neutral",
};

export function LeadScoreCard({ score }: { score: LeadScoreData }) {
  if (!score) {
    return (
      <Card>
        <SectionTitle>Điểm ưu tiên sales</SectionTitle>
        <div className="space-y-2 px-4 py-3 text-sm">
          <p className="text-fg-muted">
            Chưa chấm — worker chấm trong vài phút sau khi có tương tác
          </p>
          <p className="text-xs text-fg-subtle">
            Điểm là giả thuyết v1, không phải xác suất mua
          </p>
        </div>
      </Card>
    );
  }

  const bandLabel = BAND_LABEL[score.band] ?? score.band;
  const bandTone = BAND_TONE[score.band] ?? "neutral";

  return (
    <Card>
      <SectionTitle
        actions={
          <span className="text-xs font-normal text-fg-muted">
            Phiên bản v{score.version}
          </span>
        }
      >
        Điểm ưu tiên sales
      </SectionTitle>

      <div className="space-y-3 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            {score.value === null ? (
              <span className="text-base font-semibold text-fg-muted">
                Chưa đủ dữ liệu
              </span>
            ) : (
              <span className="text-2xl tabular font-semibold text-fg">
                {num(score.value)}
                <span className="text-xs font-normal text-fg-muted">/100</span>
              </span>
            )}
            <Badge tone={bandTone}>{bandLabel}</Badge>
          </div>
          <span className="tabular text-xs text-fg-muted">
            Phiên bản v{score.version} · {dateTime(score.computedAt)}
          </span>
        </div>

        <p className="text-xs text-fg-muted">
          Điểm là giả thuyết v1, không phải xác suất mua
        </p>

        {score.reasons.length > 0 && (
          <ul className="space-y-2.5 border-t border-border pt-2.5">
            {score.reasons.map((r) => {
              const pct =
                r.max > 0
                  ? Math.max(0, Math.min(100, Math.round((r.points / r.max) * 100)))
                  : 0;
              return (
                <li key={r.part} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-fg">
                      {r.part} —{" "}
                      <span className="tabular">
                        {r.points}/{r.max}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-fg-muted">{r.evidence}</p>
                </li>
              );
            })}
          </ul>
        )}

        {score.missingData.length > 0 && (
          <div className="rounded-[var(--radius-sm)] border border-border bg-warning-soft/50 px-3 py-2 text-xs text-warning">
            <p className="font-medium">Dữ liệu còn thiếu:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {score.missingData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {score.suggestedAction && (
          <div className="rounded-[var(--radius-sm)] bg-brand-soft px-3 py-2 text-xs font-medium text-brand-active">
            Gợi ý: {score.suggestedAction}
          </div>
        )}
      </div>
    </Card>
  );
}

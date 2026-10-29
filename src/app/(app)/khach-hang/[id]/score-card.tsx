// Thẻ hiển thị điểm khách hàng (RFM, Rủi ro giao dịch, Nhu cầu hỗ trợ) — thành phần server thuần trình bày.
import { Badge, Card, SectionTitle, type Tone } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { SCORE_LABEL, type CustomerScores } from "@/modules/scoring/service";

export type ScoreItem = CustomerScores["scores"][number];
export type CustomerScoreType = "RFM" | "TXN_RISK" | "SUPPORT_NEED" | "SALES_PRIORITY";

const BAND_LABEL: Record<string, string> = {
  CAO: "Cao",
  VUA: "Vừa",
  THAP: "Thấp",
  CHUA_DU_DU_LIEU: "Chưa đủ dữ liệu",
  CHAMPIONS: "Khách tốt nhất",
  TRUNG_THANH: "Trung thành",
  MOI: "Mới",
  CO_NGUY_CO: "Có nguy cơ rời bỏ",
  NGU_DONG: "Ngủ đông",
  CAN_CHAM_SOC: "Cần chăm sóc",
};

const GOOD_HIGH_TONE: Record<string, Tone> = {
  CAO: "success",
  VUA: "warning",
  THAP: "neutral",
  CHAMPIONS: "success",
  TRUNG_THANH: "success",
  MOI: "info",
  CO_NGUY_CO: "warning",
  NGU_DONG: "neutral",
  CAN_CHAM_SOC: "info",
  CHUA_DU_DU_LIEU: "neutral",
};

const BAD_HIGH_TONE: Record<string, Tone> = {
  CAO: "danger",
  VUA: "warning",
  THAP: "success",
  CHUA_DU_DU_LIEU: "neutral",
};

function scoreBandTone(type: CustomerScoreType, band: string): Tone {
  if (band === "CHUA_DU_DU_LIEU") return "neutral";
  if (type === "TXN_RISK" || type === "SUPPORT_NEED") {
    return BAD_HIGH_TONE[band] ?? "neutral";
  }
  return GOOD_HIGH_TONE[band] ?? "neutral";
}

export function ScoreCard({
  type,
  score,
}: {
  type?: CustomerScoreType;
  score: ScoreItem | null;
}) {
  const resolvedType: CustomerScoreType = score?.type ?? type ?? "RFM";
  const title = SCORE_LABEL[resolvedType] ?? resolvedType;
  const band = score?.band ?? "CHUA_DU_DU_LIEU";
  const hasValue = score != null && score.value !== null && band !== "CHUA_DU_DU_LIEU";
  const tone = hasValue ? scoreBandTone(resolvedType, band) : "neutral";
  const bandLabel = hasValue ? (BAND_LABEL[band] ?? band) : BAND_LABEL.CHUA_DU_DU_LIEU;
  const hypothesisText =
    resolvedType === "RFM"
      ? "Phân hạng theo ngũ phân vị trong team"
      : "Điểm là giả thuyết v1, không phải xác suất mua";

  return (
    <Card className="flex flex-col">
      <SectionTitle
        actions={
          <Badge tone={tone}>{bandLabel}</Badge>
        }
      >
        {title}
      </SectionTitle>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {hasValue ? (
            <p className="text-2xl font-semibold tabular text-fg">{score.value}</p>
          ) : (
            <p className="text-base font-medium text-fg-muted">Chưa đủ dữ liệu</p>
          )}
          <span className="tabular text-xs text-fg-muted">
            {score ? `Phiên bản v${score.version} · ${dateTime(score.computedAt)}` : "Phiên bản v1 · chưa chấm"}
          </span>
        </div>

        <p className="text-xs text-fg-subtle">{hypothesisText}</p>

        {score && score.reasons.length > 0 && (
          <ul className="space-y-2.5 border-t border-border pt-2.5 text-xs">
            {score.reasons.map((r) => {
              const pct = r.max > 0 ? Math.max(0, Math.min(100, Math.round((r.points / r.max) * 100))) : 0;
              return (
                <li key={r.part} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-fg">
                    <span className="font-medium">
                      {r.part} — <span className="tabular">{r.points}/{r.max}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-fg-muted">{r.evidence}</p>
                </li>
              );
            })}
          </ul>
        )}

        {score && score.missingData.length > 0 && (
          <div className="rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-warning">
            <p className="font-medium">Thiếu dữ liệu:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {score.missingData.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {!score && (
          <p className="rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-warning">
            Chưa đủ dữ liệu chấm điểm — chạy tính điểm định kỳ hoặc tính lại ngay ở trang Quản trị.
          </p>
        )}

        {score?.suggestedAction && (
          <p className="mt-auto rounded-[var(--radius-sm)] bg-brand-soft px-3 py-2 text-xs text-fg">
            <span className="font-medium text-brand-active">Gợi ý: {score.suggestedAction}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

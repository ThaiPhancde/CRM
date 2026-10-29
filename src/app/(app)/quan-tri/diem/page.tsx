// Trang cấu hình Điểm khách hàng & phiên bản trọng số (Quản trị › Điểm khách hàng, quyền score.config).
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, num } from "@/lib/format";
import { listScoreVersions, SCORE_LABEL } from "@/modules/scoring/service";
import { RecomputeButton } from "./recompute-button";
import { VersionForm, type WeightedScoreType } from "./version-form";

const PART_LABEL: Record<string, string> = {
  fit: "Nhu cầu phù hợp",
  intent: "Tín hiệu mua",
  engagement: "Tương tác",
  readiness: "Sẵn sàng đặt",
  failRate: "Từ chối nhận",
  missingInfo: "Thiếu thông tin",
  address: "Địa chỉ",
  openTickets: "Ticket mở",
  severity: "Mức nghiêm trọng",
  wait: "Thời gian chờ",
};

const WEIGHTED_TYPES = new Set<string>(["SALES_PRIORITY", "TXN_RISK", "SUPPORT_NEED"]);

function formatWeights(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  if (entries.length === 0) return "Ngũ phân vị R · F · M (1–5)";
  return entries.map(([k, v]) => `${PART_LABEL[k] ?? k} ${v}`).join(" · ");
}

export default async function ScoreAdminPage() {
  const user = await pageUser("score.config");
  bindTenant(user);
  const data = await listScoreVersions(user);

  return (
    <>
      <PageHeader
        title="Điểm khách hàng"
        crumbs={[{ label: "Quản trị" }, { label: "Điểm khách hàng" }]}
        description="Trọng số là giả thuyết (D-33). Đổi trọng số tạo phiên bản mới; điểm của phiên bản cũ giữ nguyên để so sánh."
        actions={<RecomputeButton />}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-bg-subtle px-4 py-3 text-sm">
        <span className="font-medium text-fg">
          {data.metricsAsOf ? `Chỉ số tính lúc ${dateTime(data.metricsAsOf)}` : "Chưa dựng chỉ số"}
        </span>
        <span className="text-xs text-fg-muted">
          Điểm là giả thuyết v1, không phải xác suất mua · Khi chưa đủ dữ liệu hệ thống trả &ldquo;Chưa đủ dữ liệu&rdquo;, không gán rủi ro cao.
        </span>
      </div>

      <div className="space-y-6">
        {data.types.map((item) => {
          const active = item.versions.find((v) => v.active) ?? item.versions[0];
          const label = SCORE_LABEL[item.type] ?? item.label;
          const isWeighted = WEIGHTED_TYPES.has(item.type);

          return (
            <Card key={item.type}>
              <SectionTitle
                actions={
                  active ? (
                    <Badge tone="brand">Phiên bản v{active.version}</Badge>
                  ) : (
                    <Badge tone="neutral">Chưa có phiên bản</Badge>
                  )
                }
              >
                {label}
              </SectionTitle>

              <p className="border-b border-border bg-bg-subtle px-4 py-2 text-xs text-fg-muted">
                {item.type === "RFM"
                  ? "Phân hạng theo ngũ phân vị trong team (CUS-01: R độ gần · F tần suất · M giá trị REV-03 12 tháng)."
                  : "Điểm là giả thuyết v1, không phải xác suất mua. Đổi trọng số sẽ tạo phiên bản mới và lưu vết kiểm toán."}
              </p>

              {item.versions.length === 0 ? (
                <EmptyState
                  title="Chưa có phiên bản nào"
                  description="Tạo phiên bản trọng số đầu tiên bên dưới để bắt đầu chấm điểm."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">Danh sách phiên bản trọng số {label}</caption>
                    <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                      <tr>
                        <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Phiên bản</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Trọng số</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Ghi chú</th>
                        <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Trạng thái</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Số điểm đã chấm</th>
                        <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Tạo lúc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.versions.map((v) => (
                        <tr key={v.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                          <td className="tabular px-4 py-2.5 font-mono text-xs font-semibold whitespace-nowrap text-fg">
                            v{v.version}
                          </td>
                          <td className="px-4 py-2.5 text-fg">
                            {formatWeights(v.weights)}
                          </td>
                          <td className="px-4 py-2.5 text-fg-muted">
                            {v.note ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {v.active ? (
                              <Badge tone="success">Đang dùng</Badge>
                            ) : (
                              <Badge tone="neutral">Phiên bản cũ</Badge>
                            )}
                          </td>
                          <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                            {num(v.scored)}
                          </td>
                          <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                            {dateTime(v.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isWeighted ? (
                <VersionForm
                  key={`${item.type}-${active?.version ?? 0}`}
                  type={item.type as WeightedScoreType}
                  activeVersion={active?.version ?? 0}
                  initialWeights={
                    active && Object.keys(active.weights).length > 0
                      ? active.weights
                      : item.defaults
                  }
                />
              ) : (
                <div className="border-t border-border bg-bg-subtle px-4 py-3 text-xs text-fg-muted">
                  RFM không có trọng số — chia 5 bậc theo ngũ phân vị trong team
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

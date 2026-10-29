// Trang Từ điển chỉ số (Quản trị › Từ điển chỉ số, quyền catalog.view).
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { num } from "@/lib/format";
import { listMetricDefinitions } from "@/modules/scoring/service";

const GROUP_META: Record<string, { title: string; subtitle: string }> = {
  REV: {
    title: "Nhóm REV — Doanh thu theo 4 mốc ghi nhận",
    subtitle: "Cấm ghi 'doanh thu' trần (L1). Quy về VND theo tỷ giá chốt của đơn (L2, D-44).",
  },
  OPS: {
    title: "Nhóm OPS — Vận hành & giao vận",
    subtitle: "Theo dõi tỷ lệ giao thành công, hoàn hàng, thời gian giao và lý do thất bại.",
  },
  CASH: {
    title: "Nhóm CASH — Dòng tiền & đối soát COD",
    subtitle: "Bốn mốc COD tách biệt: đặt đơn, giao hàng, thu hộ và đối soát tiền về.",
  },
  CUS: {
    title: "Nhóm CUS — Khách hàng & chất lượng giao dịch",
    subtitle: "Phân hạng RFM, chu kỳ mua lại, tỷ lệ mua lại và rủi ro giao dịch từ phía khách.",
  },
  MKT: {
    title: "Nhóm MKT — Tiếp thị & chuyển đổi nhu cầu",
    subtitle: "Hiệu quả nguồn nhu cầu mua, chi phí trên mỗi nhu cầu và tỷ lệ chuyển đổi.",
  },
  AI: {
    title: "Nhóm AI — Trợ lý AI & kiểm soát công cụ",
    subtitle: "Lượt chạy, chi phí mô hình, tỷ lệ chấp nhận đề xuất và kiểm soát phân quyền.",
  },
};

const GROUP_ORDER = ["REV", "OPS", "CASH", "CUS", "MKT", "AI"];

export default async function MetricDictionaryPage() {
  const user = await pageUser("catalog.view");
  bindTenant(user);
  const rows = await listMetricDefinitions(user);

  const groups = Array.from(new Set([...GROUP_ORDER, ...rows.map((r) => r.group)])).filter((g) =>
    rows.some((r) => r.group === g),
  );

  return (
    <>
      <PageHeader
        title="Từ điển chỉ số"
        crumbs={[{ label: "Quản trị" }, { label: "Từ điển chỉ số" }]}
        description="Mọi số liệu tiền và doanh thu ghi mã chỉ số (L1). Quy về VND (D-44)."
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa nạp từ điển — chạy npm run db:seed"
            description="Từ điển chỉ số chuẩn hóa công thức, mốc thời gian và nguồn dữ liệu cho toàn bộ báo cáo và trợ lý AI."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const items = rows.filter((r) => r.group === group);
            const meta = GROUP_META[group] ?? {
              title: `Nhóm ${group}`,
              subtitle: "Các chỉ số chuẩn hóa trong hệ thống.",
            };

            return (
              <Card key={group}>
                <SectionTitle actions={<Badge tone="brand">{num(items.length)} chỉ số</Badge>}>
                  {meta.title}
                </SectionTitle>
                <p className="border-b border-border bg-bg-subtle px-4 py-2 text-xs text-fg-muted">
                  {meta.subtitle}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">Danh sách chỉ số thuộc {meta.title}</caption>
                    <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                      <tr>
                        <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Mã</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Tên</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Công thức</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Mốc thời gian</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Nguồn</th>
                        <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Phụ trách</th>
                        <th scope="col" className="h-10 border-b border-border px-4">Cạm bẫy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.code} className="border-b border-border align-top last:border-0 hover:bg-bg-subtle">
                          <td className="px-4 py-3 font-mono text-[13px] font-semibold whitespace-nowrap text-brand-active">
                            {m.code}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-fg">{m.nameVi}</div>
                            {m.nameEn && <div className="mt-0.5 text-xs text-fg-muted">{m.nameEn}</div>}
                          </td>
                          <td className="px-4 py-3 text-fg">{m.formula}</td>
                          <td className="px-4 py-3 text-fg-muted">{m.timeAnchor ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-fg-muted">{m.source}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-fg">{m.owner ?? "—"}</td>
                          <td className="px-4 py-3 text-fg-muted">{m.pitfalls ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// Mục lục báo cáo: chỉ hiện nhóm người dùng được xem (nhóm tài chính cần thêm quyền xem tiền).
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { currentUserOrRedirect } from "@/lib/current-user";
import { visibleGroups, type ReportGroupKey } from "@/modules/reports/service";
import { GROUP_LABEL } from "./report-ui";

const ABOUT: Record<ReportGroupKey, string> = {
  sales: "Phản hồi đầu, liên hệ được, chuyển đổi, kết quả theo người phụ trách.",
  "khach-hang": "Hạng RFM, cohort mua lại, giá trị và biên đóng góp theo hạng.",
  marketing: "Nguồn lead, chiến dịch, chi phí và chi phí trên lead (MKT-01, MKT-02).",
  "van-don": "Giao thành công, thất bại, hoàn, thời gian giao, COD (OPS-01…04).",
  "tai-chinh": "REV-01…04 theo mốc từng chỉ số, nguyên tệ và tỷ giá đã dùng.",
  ai: "Mức dùng, chất lượng, lỗi và chi phí AI (AI-01…03).",
};

export default async function ReportsIndex() {
  const user = await currentUserOrRedirect();
  const groups = visibleGroups(user);
  return (
    <>
      <PageHeader title="Báo cáo" crumbs={[{ label: "Phân tích" }, { label: "Báo cáo" }]} description="Mỗi báo cáo ghi mã chỉ số, kỳ, phạm vi, tiền tệ và độ mới dữ liệu; số liệu đi qua lớp phân tích (Warehouse), không tải danh sách chi tiết." />
      {groups.length === 0 ? (
        <EmptyState title="Bạn chưa được xem báo cáo nào" description="Quản trị cấp quyền báo cáo theo vai trò (Quản trị › Vai trò)." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Link key={g} href={`/bao-cao/${g}`} className="group">
              <Card className="h-full p-4 transition-colors group-hover:border-brand">
                <h2 className="text-base font-semibold text-fg group-hover:text-brand">{GROUP_LABEL[g]}</h2>
                <p className="mt-1 text-sm text-fg-muted">{ABOUT[g]}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

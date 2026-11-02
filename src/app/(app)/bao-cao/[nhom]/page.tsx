// Trang một nhóm báo cáo (HLD §9.2). Quyền kiểm ở service; nhóm không được xem → 404 (không lộ là có).
import { notFound } from "next/navigation";
import { currentUserOrRedirect } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { parseReportFilter, todayVN } from "@/modules/reports/period";
import { REPORT_GROUP_KEYS, reportContext, visibleGroups, type ReportGroupKey } from "@/modules/reports/service";
import { ReportShell } from "../report-ui";
import { AiSection } from "./sections/ai";
import { CustomerSection } from "./sections/khach-hang";
import { MarketingSection } from "./sections/marketing";
import { SalesSection } from "./sections/sales";
import { FinanceSection } from "./sections/tai-chinh";
import { FulfillmentSection } from "./sections/van-don";

const DESC: Record<ReportGroupKey, string> = {
  sales: "Phản hồi đầu, liên hệ được, chuyển đổi và kết quả theo người phụ trách — tổng hợp ở cơ sở dữ liệu, không tải danh sách thẻ.",
  "khach-hang": "Hạng RFM, cohort mua lại theo tháng đầu mua, giá trị và biên đóng góp theo hạng.",
  marketing: "Nguồn lead, chiến dịch, chi phí và chi phí trên mỗi lead.",
  "van-don": "Giao thành công, thất bại, hoàn, thời gian giao và COD theo thị trường.",
  "tai-chinh": "REV-01…04 theo mốc của từng chỉ số, hoàn tiền, nguyên tệ và tỷ giá đã dùng.",
  ai: "Mức dùng, chất lượng, lỗi và chi phí của trợ lý AI.",
};
const GROUP_BY: Partial<Record<ReportGroupKey, string[]>> = { "tai-chinh": ["market", "brand", "store", "month", "brand_market", "none"] };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ nhom: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ nhom }, sp] = await Promise.all([params, searchParams]);
  const user = await currentUserOrRedirect();
  bindTenant(user);
  if (!(REPORT_GROUP_KEYS as readonly string[]).includes(nhom) || !visibleGroups(user).includes(nhom as ReportGroupKey)) notFound();
  const g = nhom as ReportGroupKey;
  const f = parseReportFilter(sp, todayVN(), g === "tai-chinh" ? "market" : "none");
  const ctx = await reportContext(user, g, f);
  const props = { user, f, ctx };
  return (
    <ReportShell group={g} f={f} ctx={ctx} description={DESC[g]} groupBy={GROUP_BY[g]}
      notes={g === "tai-chinh" ? "REV-04 hiện chỉ gồm thanh toán trực tuyến trừ hoàn; COD đã đối soát vào REV-04 khi có đối soát COD (Phase 10). Đừng so REV-04 cùng kỳ với REV-01 (docs/metrics.md)." : undefined}>
      {g === "tai-chinh" && <FinanceSection {...props} />}
      {g === "sales" && <SalesSection {...props} />}
      {g === "khach-hang" && <CustomerSection {...props} />}
      {g === "marketing" && <MarketingSection {...props} />}
      {g === "van-don" && <FulfillmentSection {...props} />}
      {g === "ai" && <AiSection {...props} />}
    </ReportShell>
  );
}

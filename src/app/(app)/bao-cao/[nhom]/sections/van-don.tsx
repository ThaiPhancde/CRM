// Tạm — Gemini (batch p9-reports) thay bằng phần báo cáo thật.
import { EmptyState } from "@/components/ui";
import type { SessionUser } from "@/lib/session";
import type { ReportFilter } from "@/modules/reports/period";
import type { ReportContext } from "@/modules/reports/service";

export async function FulfillmentSection(_props: { user: SessionUser; f: ReportFilter; ctx: ReportContext }) {
  return <EmptyState title="Đang dựng" />;
}

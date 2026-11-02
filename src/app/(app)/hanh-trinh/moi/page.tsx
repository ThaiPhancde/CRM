// Tạo hành trình — mẫu khởi đầu theo HLD §8.5 (nhắc mua lại → chờ → kiểm tồn → ưu đãi → giao sales gọi).
import { PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { listSegments, segmentFields } from "@/modules/marketing/segments";
import { JourneyEditor } from "../journey-editor";

export default async function NewJourneyPage() {
  const user = await pageUser("journey.manage");
  bindTenant(user);
  const [segments, fields] = await Promise.all([listSegments(user), segmentFields(user)]);
  return (
    <>
      <PageHeader title="Tạo hành trình" crumbs={[{ label: "Marketing" }, { href: "/hanh-trinh", label: "Hành trình" }, { label: "Tạo mới" }]} description="Lưu xong hành trình ở trạng thái Nháp; Quản lý bật để bắt đầu đưa khách vào." />
      <JourneyEditor
        segments={segments}
        brands={fields.find((f) => f.key === "brand")?.options ?? []}
        fields={fields}
        initial={{
          name: "", description: "", segmentId: segments[0]?.id ?? "", brandId: "", reentryDays: 30,
          exitRules: { purchased: true, optOut: true, openTicket: true, expireDays: 30 },
          steps: [
            { type: "SEND", channel: "EMAIL", template: "repurchase_reminder" },
            { type: "WAIT", days: 3 },
            { type: "STOCK_CHECK" },
            { type: "SEND", channel: "EMAIL", template: "repurchase_offer" },
            { type: "TASK", title: "Gọi chăm sóc khách sắp tới chu kỳ mua lại", dueDays: 1 },
          ],
        }}
      />
    </>
  );
}

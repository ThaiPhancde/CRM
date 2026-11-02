// Danh sách hành trình tự động (quyền journey.manage): trạng thái, phân khúc vào, số khách theo trạng thái.
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { ago, num } from "@/lib/format";
import { listJourneys } from "@/modules/marketing/journeys";
import { JOURNEY_STATUS_LABEL, JOURNEY_STATUS_TONE } from "@/modules/marketing/labels";

export default async function JourneysPage() {
  const user = await pageUser("journey.manage");
  bindTenant(user);
  const rows = await listJourneys(user);

  return (
    <>
      <PageHeader
        title="Hành trình"
        crumbs={[{ label: "Marketing" }, { label: "Hành trình" }]}
        description="Chuỗi bước tự động cho khách trong phân khúc: chờ, kiểm điều kiện, kiểm tồn, gửi tin (giả lập), tạo việc. Marketing soạn, Quản lý bật."
        actions={<ButtonLink variant="primary" href="/hanh-trinh/moi">Tạo hành trình</ButtonLink>}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có hành trình" description="Tạo phân khúc trước, rồi tạo hành trình mua lại: nhắc → chờ 3 ngày → ưu đãi → giao sales gọi." action={<ButtonLink href="/phan-khuc">Mở Phân khúc</ButtonLink>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách hành trình</caption>
              <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4">Hành trình</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Trạng thái</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Phân khúc vào</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Bước</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Đang trong</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Hoàn tất</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Đã ra</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5"><Link href={`/hanh-trinh/${j.id}`} className="font-medium text-fg hover:text-brand">{j.name}</Link></td>
                    <td className="px-4 py-2.5"><Badge tone={JOURNEY_STATUS_TONE[j.status]}>{JOURNEY_STATUS_LABEL[j.status]}</Badge></td>
                    <td className="px-4 py-2.5 text-fg-muted">{j.segment.name}</td>
                    <td className="tabular px-4 py-2.5 text-right">{j.steps}</td>
                    <td className="tabular px-4 py-2.5 text-right font-medium text-fg">{num(j.running)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{num(j.completed)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{num(j.exited)}</td>
                    <td className="px-4 py-2.5 text-fg-muted">{ago(j.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

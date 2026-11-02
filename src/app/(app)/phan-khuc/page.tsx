// Danh sách phân khúc động (quyền segment.manage): số khách lần chạy gần nhất, nơi dùng, tạo/sửa/chạy.
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { ago, dateTime, num } from "@/lib/format";
import { listSegments, segmentFields } from "@/modules/marketing/segments";
import { RunButton } from "./run-button";
import { SegmentEditor } from "./segment-editor";

export default async function SegmentsPage() {
  const user = await pageUser("segment.manage");
  bindTenant(user);
  const [rows, fields] = await Promise.all([listSegments(user), segmentFields(user)]);

  return (
    <>
      <PageHeader
        title="Phân khúc"
        crumbs={[{ label: "Marketing" }, { label: "Phân khúc" }]}
        description="Nhóm khách theo điều kiện (RFM, chu kỳ mua, thị trường, thẻ…). Worker chạy lại hằng ngày; mỗi lần chạy lưu ảnh chụp danh sách khách."
        actions={<SegmentEditor fields={fields} />}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có phân khúc" description="Tạo phân khúc đầu tiên, ví dụ &ldquo;Gần chu kỳ mua lại&rdquo;: hạng RFM tốt và còn ≤ 7 ngày tới chu kỳ mua." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách phân khúc</caption>
              <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4">Phân khúc</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right">Số khách</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Chạy lần cuối</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Đang dùng ở</th>
                  <th scope="col" className="h-10 border-b border-border px-4"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-fg">{s.name}</div>
                      {s.description && <div className="text-xs text-fg-muted">{s.description}</div>}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-medium text-fg">{s.lastCount == null ? "—" : num(s.lastCount)}</td>
                    <td className="px-4 py-2.5 text-fg-muted" title={s.lastRunAt ? dateTime(s.lastRunAt) : undefined}>{s.lastRunAt ? ago(s.lastRunAt) : <Badge tone="warning">Chưa chạy</Badge>}</td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {s.journeys || s.campaigns ? `${num(s.journeys)} hành trình · ${num(s.campaigns)} chiến dịch` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <RunButton id={s.id} />
                        <SegmentEditor fields={fields} initial={{ id: s.id, name: s.name, description: s.description, rules: s.rules }} trigger="Sửa" />
                      </div>
                    </td>
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

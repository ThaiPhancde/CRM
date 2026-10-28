import { pageUser } from "@/lib/current-user";
import { rootDb } from "@/lib/db";
import { listAudit } from "@/modules/admin/service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const ACTION: Record<string, { label: string; tone: "success" | "info" | "danger" }> = {
  create: { label: "Tạo", tone: "success" },
  update: { label: "Sửa", tone: "info" },
  delete: { label: "Xóa", tone: "danger" },
};

export default async function AuditPage() {
  const user = await pageUser("admin.audit");
  const rows = await listAudit(user, 200);
  const actors = new Map((await rootDb.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } } })).map((u) => [u.id, u.name]));
  return (
    <>
      <PageHeader title="Nhật ký thao tác" crumbs={[{ label: "Hệ thống" }, { label: "Nhật ký" }]}
        description="200 thay đổi gần nhất của team. Nhật ký chỉ thêm, không sửa hay xóa được." />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có thay đổi nào" description="Thao tác thêm/sửa ở Danh mục và Người dùng sẽ hiện ở đây." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                    <Badge tone={ACTION[r.action]?.tone ?? "info"}>{ACTION[r.action]?.label ?? r.action}</Badge>
                    <span className="font-medium text-fg">{r.entity}</span>
                    <span className="text-fg-muted">bởi {actors.get(r.actorId) ?? r.actorId}</span>
                    <time className="tabular ml-auto text-xs text-fg-subtle" dateTime={r.at.toISOString()}>{r.at.toLocaleString("vi-VN")}</time>
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Pre label="Trước" v={r.before} />
                    <Pre label="Sau" v={r.after} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Pre({ label, v }: { label: string; v: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs text-fg-muted">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-[var(--radius-sm)] bg-bg-subtle p-2 text-xs text-fg">{v == null ? "—" : JSON.stringify(v, null, 2)}</pre>
    </div>
  );
}

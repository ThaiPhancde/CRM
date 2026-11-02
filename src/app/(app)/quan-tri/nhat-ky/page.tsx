import Link from "next/link";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/current-user";
import { dateTime, num } from "@/lib/format";
import { auditFilter, listAuditLog, type AuditFilter } from "@/modules/admin/audit";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, type Tone } from "@/components/ui";

const ACTION_MAP: Record<string, { label: string; tone: Tone }> = {
  create: { label: "Tạo", tone: "success" },
  update: { label: "Sửa", tone: "info" },
  delete: { label: "Xóa", tone: "danger" },
};

function flatten(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("admin.audit");
  const sp = await searchParams;
  const f = auditFilter.parse(flatten(sp));
  const data = await listAuditLog(user, f);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasFilter = Boolean(f.actor || f.entity || f.entityId || f.action || f.from || f.to);

  const qs = (patch: Partial<Record<keyof AuditFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/quan-tri/nhat-ky";
  };

  return (
    <>
      <PageHeader
        title="Nhật ký thao tác"
        crumbs={[{ label: "Hệ thống" }, { label: "Nhật ký" }]}
        description="Mọi thay đổi của team, chỉ thêm — không sửa hay xóa được. Lọc theo người, loại bản ghi, kỳ hoặc mã bản ghi."
      />

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <FilterField id="filter-actor" label="Người thực hiện">
            <select
              id="filter-actor"
              name="actor"
              defaultValue={f.actor ?? ""}
              className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">Tất cả</option>
              {data.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField id="filter-entity" label="Loại bản ghi">
            <select
              id="filter-entity"
              name="entity"
              defaultValue={f.entity ?? ""}
              className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">Tất cả</option>
              {data.entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField id="filter-action" label="Thao tác">
            <input
              id="filter-action"
              name="action"
              type="text"
              defaultValue={f.action ?? ""}
              placeholder="vd update, privacy.erase"
              className="h-8 w-44 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle"
            />
          </FilterField>

          <FilterField id="filter-entityId" label="Mã bản ghi">
            <input
              id="filter-entityId"
              name="entityId"
              type="text"
              defaultValue={f.entityId ?? ""}
              placeholder="Nhập mã bản ghi…"
              className="h-8 w-44 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle"
            />
          </FilterField>

          <FilterField id="filter-from" label="Từ ngày">
            <input
              id="filter-from"
              name="from"
              type="date"
              defaultValue={f.from ?? ""}
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            />
          </FilterField>

          <FilterField id="filter-to" label="Đến ngày">
            <input
              id="filter-to"
              name="to"
              type="date"
              defaultValue={f.to ?? ""}
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            />
          </FilterField>

          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>
          <Link
            href="/quan-tri/nhat-ky"
            className="inline-flex h-8 items-center rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            Đặt lại
          </Link>
        </form>

        {data.rows.length === 0 ? (
          hasFilter ? (
            <EmptyState
              title="Không có thay đổi khớp bộ lọc"
              description="Thử điều chỉnh điều kiện lọc hoặc đặt lại để xem toàn bộ nhật ký thao tác."
              action={<ButtonLink href="/quan-tri/nhat-ky">Đặt lại</ButtonLink>}
            />
          ) : (
            <EmptyState
              title="Chưa có thay đổi nào"
              description="Mọi thao tác thêm, sửa, xóa trên hệ thống sẽ được ghi nhận tại đây."
            />
          )
        ) : (
          <ul className="divide-y divide-border">
            {data.rows.map((r) => {
              const act = ACTION_MAP[r.action];
              return (
                <li key={r.id} className="px-4 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                      <Badge tone={act ? act.tone : "neutral"}>{act ? act.label : r.action}</Badge>
                      <span className="font-medium text-fg">{r.entity}</span>
                      <code
                        className="max-w-44 truncate rounded bg-bg-muted px-1.5 py-0.5 font-mono text-xs text-fg-muted"
                        title={r.entityId}
                      >
                        {r.entityId}
                      </code>
                      <span className="text-fg-muted">bởi {r.actor}</span>
                      {r.reason && <span className="text-xs text-fg-muted">Lý do: {r.reason}</span>}
                      {r.changed.length > 0 && (
                        <span className="text-xs text-fg-muted">Đổi: {r.changed.join(", ")}</span>
                      )}
                      <time className="tabular ml-auto text-xs text-fg-subtle" dateTime={r.at}>
                        {dateTime(r.at)}
                      </time>
                    </summary>

                    {r.changed.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                        <span>Trường thay đổi:</span>
                        <ul className="flex flex-wrap items-center gap-1" aria-label="Danh sách trường thay đổi">
                          {r.changed.map((k) => (
                            <li key={k}>
                              <Badge tone="warning">{k}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Pre label="Trước" v={r.before} />
                      <Pre label="Sau" v={r.after} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {data.total > 0 && (
          <nav
            aria-label="Phân trang"
            className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted"
          >
            <span className="tabular">
              Trang {data.page}/{pages} · {num(data.total)} thay đổi
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link
                  className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                  href={qs({ page: data.page - 1 })}
                >
                  ‹ Trước
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">‹ Trước</span>
              )}
              {data.page < pages ? (
                <Link
                  className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                  href={qs({ page: data.page + 1 })}
                >
                  Sau ›
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">Sau ›</span>
              )}
            </div>
          </nav>
        )}
      </Card>
    </>
  );
}

function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pre({ label, v }: { label: string; v: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs text-fg-muted">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-[var(--radius-sm)] bg-bg-subtle p-2 text-xs text-fg">
        {v == null ? "—" : JSON.stringify(v, null, 2)}
      </pre>
    </div>
  );
}

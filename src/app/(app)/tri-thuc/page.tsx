// Trang danh sách bài tri thức (Knowledge Base) — kiểm quyền knowledge.view ở server, giữ bộ lọc trên URL.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, type Tone } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { ago, dateTime, num } from "@/lib/format";
import { getCatalog } from "@/modules/admin/service";
import {
  KB_LANGUAGES,
  listArticles,
  parseKbFilter,
  type KbFilter,
} from "@/modules/service/knowledge";
import { KNOWLEDGE_STATUS_LABEL } from "@/modules/service/labels";

const LANGUAGE_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

const KB_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export default async function KnowledgeListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("knowledge.view");
  bindTenant(user);

  const sp = await searchParams;
  const f = parseKbFilter(sp);

  const [data, catalog] = await Promise.all([
    listArticles(user, f),
    getCatalog(user),
  ]);

  const qs = (patch: Partial<Record<keyof KbFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q: f.q,
      language: f.language,
      brand: f.brand,
      market: f.market,
      status: data.canEdit ? f.status : undefined,
      page: f.page,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/tri-thuc";
  };

  const filtered = Boolean(
    f.q || f.language || f.brand || f.market || (data.canEdit && f.status),
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <PageHeader
        title="Tri thức"
        crumbs={[{ href: "/cham-soc", label: "Chăm sóc" }, { label: "Tri thức" }]}
        description="Bài hướng dẫn theo brand, thị trường và ngôn ngữ — mỗi lần sửa là một phiên bản mới"
        actions={
          data.canEdit ? (
            <ButtonLink href="/tri-thuc/moi" variant="primary">
              Viết bài mới
            </ButtonLink>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-2.5 px-4 py-3">
          <Filter label="Tìm kiếm">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Tiêu đề, thẻ…"
              className="h-8 w-52 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring"
            />
          </Filter>

          <Filter label="Ngôn ngữ">
            <Select
              name="language"
              value={f.language}
              options={KB_LANGUAGES.map((l) => [l, LANGUAGE_LABEL[l] ?? l])}
            />
          </Filter>

          <Filter label="Brand">
            <Select
              name="brand"
              value={f.brand}
              options={catalog.brands.map((b) => [b.id, `${b.code} · ${b.name}`])}
            />
          </Filter>

          <Filter label="Thị trường">
            <Select
              name="market"
              value={f.market}
              options={catalog.markets.map((m) => [m.id, `${m.code} · ${m.name}`])}
            />
          </Filter>

          {data.canEdit && (
            <Filter label="Trạng thái">
              <Select
                name="status"
                value={f.status}
                options={KB_STATUSES.map((s) => [s, KNOWLEDGE_STATUS_LABEL[s] ?? s])}
              />
            </Filter>
          )}

          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>

          {filtered && (
            <Link href="/tri-thuc" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
              Xóa lọc
            </Link>
          )}
        </form>
      </Card>

      <Card>
        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Không có bài tri thức khớp bộ lọc"
              description="Thử thay đổi từ khóa hoặc xóa điều kiện lọc."
              action={<ButtonLink href="/tri-thuc">Xóa lọc</ButtonLink>}
            />
          ) : data.canEdit ? (
            <EmptyState
              title="Chưa có bài nào được xuất bản"
              description="Tạo bài hướng dẫn đầu tiên theo brand, thị trường và ngôn ngữ."
              action={
                <ButtonLink href="/tri-thuc/moi" variant="primary">
                  Viết bài mới
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Chưa có bài nào được xuất bản"
              description="Các bài hướng dẫn đang được biên soạn và sẽ hiển thị tại đây sau khi xuất bản."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách bài tri thức</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  {[
                    "Tiêu đề",
                    "Ngôn ngữ",
                    "Brand · Thị trường",
                    "Trạng thái",
                    "Phiên bản",
                    "Cập nhật",
                  ].map((h) => (
                    <th key={h} scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((a) => (
                  <tr key={a.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="max-w-md px-4 py-2.5">
                      <Link
                        href={`/tri-thuc/${a.id}`}
                        className="font-medium text-fg hover:text-brand-active"
                        dir="auto"
                      >
                        {a.title}
                      </Link>
                      {a.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.tags.map((t) => (
                            <Badge key={t} tone="neutral">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                      {LANGUAGE_LABEL[a.language] ?? a.language}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-fg">{a.brand ?? "Mọi brand"}</span>
                      <span className="mx-1.5 text-fg-subtle">·</span>
                      <span className="text-fg-muted">{a.market ?? "Mọi thị trường"}</span>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                          {KNOWLEDGE_STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                        {a.hasDraft && <Badge tone="info">Có bản nháp mới</Badge>}
                      </div>
                    </td>

                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                      v{a.publishedVersion ?? a.latestVersion}
                    </td>

                    <td
                      className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted"
                      title={dateTime(a.updatedAt)}
                    >
                      {ago(a.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <nav
            aria-label="Phân trang"
            className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted"
          >
            <span className="tabular">
              Trang {data.page}/{pages} · {num(data.total)} bài
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

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-fg-muted">
      {label}
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value?: string; options: [string, string][] }) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus:border-brand-ring"
    >
      <option value="">Tất cả</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

// Trang danh sách & bảng Kanban nhu cầu mua (Leads) — kiểm quyền lead.view ở server, giữ bộ lọc trên URL.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, money, num } from "@/lib/format";
import { getCatalog } from "@/modules/admin/service";
import {
  LEAD_STAGES,
  leadBoard,
  listLeads,
  parseLeadFilter,
  STAGE_LABEL,
  type LeadFilter,
} from "@/modules/sales/leads";
import { SOURCE_LABEL, STAGE_TONE } from "@/modules/sales/labels";
import { LeadBoard } from "./board";
import { CreateLead } from "./create-lead";

const LANGUAGE_SHORT: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("lead.view");
  bindTenant(user);

  const sp = await searchParams;
  const f = parseLeadFilter(sp);
  const rawView = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const isBoard = rawView === "board";

  const [catalog, listData, boardData] = await Promise.all([
    getCatalog(user),
    isBoard ? Promise.resolve(null) : listLeads(user, f),
    isBoard ? leadBoard(user, f) : Promise.resolve(null),
  ]);

  const canEdit = isBoard ? boardData!.canEdit : listData!.canEdit;

  const qs = (patch: Partial<Record<keyof LeadFilter | "view", string | number | undefined>>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q: f.q,
      stage: f.stage,
      owner: f.owner,
      brand: f.brand,
      market: f.market,
      overdue: f.overdue ? "1" : undefined,
      page: f.page,
      view: isBoard ? "board" : undefined,
      ...patch,
    };
    if (merged.view === "board") {
      delete merged.stage;
      delete merged.page;
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/nhu-cau";
  };

  const filtered = Boolean(f.q || (!isBoard && f.stage) || f.owner || f.brand || f.market || f.overdue);
  const clearHref = isBoard ? "/nhu-cau?view=board" : "/nhu-cau";

  const totalCount = isBoard
    ? boardData!.columns.reduce((sum, c) => sum + c.total, 0)
    : listData!.total;
  const visibleRows = isBoard ? boardData!.columns.flatMap((c) => c.rows) : listData!.rows;
  const overdueCount = visibleRows.filter((r) => r.overdue).length;
  const unassignedCount = visibleRows.filter((r) => !r.owner).length;
  const pages = listData ? Math.max(1, Math.ceil(listData.total / listData.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Nhu cầu mua"
        crumbs={[{ href: "/khach-hang", label: "Khách hàng" }, { label: "Nhu cầu mua" }]}
        description="Mỗi nhu cầu có người phụ trách, hạn phản hồi và lịch sử"
        actions={
          <>
            <div
              role="group"
              aria-label="Chế độ hiển thị"
              className="inline-flex rounded-[var(--radius-sm)] border border-border bg-bg p-0.5 text-sm"
            >
              <Link
                href={qs({ view: undefined, page: undefined })}
                aria-current={!isBoard ? "page" : undefined}
                className={cx(
                  "rounded-[calc(var(--radius-sm)-2px)] px-3 py-1 font-medium transition-colors",
                  !isBoard ? "bg-brand-soft text-brand-active" : "text-fg-muted hover:text-fg",
                )}
              >
                Danh sách
              </Link>
              <Link
                href={qs({ view: "board", stage: undefined, page: undefined })}
                aria-current={isBoard ? "page" : undefined}
                className={cx(
                  "rounded-[calc(var(--radius-sm)-2px)] px-3 py-1 font-medium transition-colors",
                  isBoard ? "bg-brand-soft text-brand-active" : "text-fg-muted hover:text-fg",
                )}
              >
                Kanban
              </Link>
            </div>
            {canEdit && <CreateLead brands={catalog.brands} markets={catalog.markets} />}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng nhu cầu (theo bộ lọc)" value={num(totalCount)} />
        <StatCard
          label="Quá hạn phản hồi"
          value={<span className={cx(overdueCount > 0 && "text-danger")}>{num(overdueCount)}</span>}
          hint={f.overdue ? "Đang lọc các nhu cầu quá hạn" : "Chưa phản hồi lần đầu đúng hạn"}
          href={qs({ overdue: f.overdue ? undefined : "1", page: undefined })}
        />
        <StatCard
          label="Chưa giao phụ trách"
          value={num(unassignedCount)}
          hint={f.owner === "none" ? "Đang lọc nhu cầu chưa giao" : "Nhấn để lọc nhu cầu chưa có người nhận"}
          href={qs({ owner: f.owner === "none" ? undefined : "none", page: undefined })}
        />
      </div>

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-2.5 px-4 py-3">
          {isBoard && <input type="hidden" name="view" value="board" />}

          <Filter label="Tìm kiếm">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Tên, nhu cầu, SĐT, email…"
              className="h-8 w-52 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring"
            />
          </Filter>

          {!isBoard && (
            <Filter label="Giai đoạn">
              <Select
                name="stage"
                value={f.stage}
                options={LEAD_STAGES.map((s) => [s, STAGE_LABEL[s]])}
              />
            </Filter>
          )}

          <Filter label="Phụ trách">
            <Select
              name="owner"
              value={f.owner}
              options={[
                ["me", "Của tôi"],
                ["none", "Chưa giao"],
              ]}
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

          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-xs font-medium text-fg hover:bg-bg-subtle">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={Boolean(f.overdue)}
              className="size-3.5 accent-[var(--brand)]"
            />
            Quá hạn phản hồi
          </label>

          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>

          {filtered && (
            <Link href={clearHref} className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
              Xóa lọc
            </Link>
          )}
        </form>
      </Card>

      {isBoard ? (
        totalCount === 0 ? (
          <Card>
            {filtered ? (
              <EmptyState
                title="Không có nhu cầu khớp bộ lọc"
                description="Thử thay đổi từ khóa hoặc xóa điều kiện lọc để xem bảng Kanban."
                action={<ButtonLink href={clearHref}>Xóa lọc</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Chưa có nhu cầu mua"
                description="Tạo nhu cầu mua đầu tiên để phân công tư vấn và theo dõi tiến độ theo từng giai đoạn."
                action={canEdit ? <CreateLead brands={catalog.brands} markets={catalog.markets} /> : undefined}
              />
            )}
          </Card>
        ) : (
          <LeadBoard columns={boardData!.columns} canEdit={boardData!.canEdit} />
        )
      ) : (
        <Card>
          {listData!.rows.length === 0 ? (
            filtered ? (
              <EmptyState
                title="Không có nhu cầu khớp bộ lọc"
                description="Thử thay đổi từ khóa hoặc xóa điều kiện lọc."
                action={<ButtonLink href={clearHref}>Xóa lọc</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Chưa có nhu cầu mua"
                description="Tạo nhu cầu mua đầu tiên để phân công tư vấn và theo dõi hạn phản hồi."
                action={canEdit ? <CreateLead brands={catalog.brands} markets={catalog.markets} /> : undefined}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Danh sách nhu cầu mua</caption>
                <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                  <tr className="text-left text-xs font-medium text-fg-muted">
                    {[
                      "Khách",
                      "Nhu cầu",
                      "Nguồn",
                      "Brand · Thị trường",
                      "Giai đoạn",
                      "Phụ trách",
                      "Hạn phản hồi",
                      "Tạo lúc",
                    ].map((h) => (
                      <th key={h} scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listData!.rows.map((l) => (
                    <tr key={l.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Link
                          href={`/nhu-cau/${l.id}`}
                          className="font-medium text-fg hover:text-brand-active"
                        >
                          {l.contactName}
                        </Link>
                        <p className="tabular text-xs text-fg-subtle">
                          {[l.phone, l.email].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>

                      <td className="max-w-xs px-4 py-2.5">
                        <p className="truncate text-fg" title={l.interest ?? undefined}>
                          {l.interest ?? "—"}
                        </p>
                        {l.budget && l.budget.currency && (
                          <p className="tabular text-xs text-fg-subtle">
                            Ngân sách: {money(l.budget.amount, l.budget.currency)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-fg">{SOURCE_LABEL[l.source] ?? l.source}</span>
                        {l.language && (
                          <p className="text-xs text-fg-subtle">{LANGUAGE_SHORT[l.language] ?? l.language}</p>
                        )}
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="text-fg">{l.brand ? `${l.brand.code} · ${l.brand.name}` : "—"}</p>
                        <p className="text-xs text-fg-subtle">
                          {l.market ? `${l.market.code} · ${l.market.name}` : "—"}
                        </p>
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={STAGE_TONE[l.stage]}>{STAGE_LABEL[l.stage]}</Badge>
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {l.owner ? (
                          <>
                            <p className="text-fg">{l.owner.name}</p>
                            {l.team && <p className="text-xs text-fg-subtle">{l.team}</p>}
                          </>
                        ) : (
                          <Badge tone="warning">Chưa giao</Badge>
                        )}
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {l.firstRespondedAt ? (
                          <div>
                            <span className="text-xs text-fg-muted">Đã phản hồi</span>
                            <p className="tabular text-xs text-fg-subtle">{dateTime(l.firstRespondedAt)}</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cx("tabular", l.overdue ? "font-medium text-danger" : "text-fg-muted")}>
                              {dateTime(l.firstResponseDueAt)}
                            </span>
                            {l.overdue && <Badge tone="danger">Quá hạn</Badge>}
                          </div>
                        )}
                      </td>

                      <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                        {dateTime(l.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {listData!.total > 0 && (
            <nav
              aria-label="Phân trang"
              className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted"
            >
              <span className="tabular">
                Trang {listData!.page}/{pages} · {num(listData!.total)} nhu cầu
              </span>
              <div className="flex gap-2">
                {listData!.page > 1 ? (
                  <Link
                    className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                    href={qs({ page: listData!.page - 1 })}
                  >
                    ‹ Trước
                  </Link>
                ) : (
                  <span className="px-2.5 py-1 opacity-40">‹ Trước</span>
                )}
                {listData!.page < pages ? (
                  <Link
                    className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                    href={qs({ page: listData!.page + 1 })}
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
      )}
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

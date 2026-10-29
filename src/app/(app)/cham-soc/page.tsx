// Trang danh sách ticket chăm sóc sau bán — kiểm quyền ticket.view ở server, lọc & phân trang qua URL.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, num } from "@/lib/format";
import { assignableUsers } from "@/modules/sales/leads";
import {
  OPEN_TICKET,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TICKET_PRIORITIES,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  TICKET_STATUSES,
  TICKET_TYPE_LABEL,
  TICKET_TYPES,
} from "@/modules/service/labels";
import { listTickets, parseTicketFilter, type TicketFilter } from "@/modules/service/tickets";
import { CreateTicket } from "./create-ticket";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("ticket.view");
  bindTenant(user);

  const sp = await searchParams;
  const f = parseTicketFilter(sp);
  const data = await listTickets(user, f);
  const people = data.canAssign ? await assignableUsers(user) : [];
  const otherUsers = people.filter((u) => u.id !== user.id);

  const defaultOrderId = typeof sp.orderId === "string" ? sp.orderId : undefined;
  const defaultCustomerId = typeof sp.customerId === "string" ? sp.customerId : undefined;

  const qs = (patch: Partial<Record<keyof TicketFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q: f.q,
      status: f.status,
      priority: f.priority,
      type: f.type,
      owner: f.owner,
      overdue: f.overdue ? "1" : undefined,
      page: f.page,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/cham-soc";
  };

  const filtered = Boolean(f.q || f.status || f.priority || f.type || f.owner || f.overdue);
  const openCount =
    f.status === "open"
      ? data.total
      : data.rows.filter((r) => OPEN_TICKET.includes(r.status)).length;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <PageHeader
        title="Ticket chăm sóc"
        crumbs={[{ href: "/cham-soc", label: "Chăm sóc" }, { label: "Ticket" }]}
        description="Sự cố sau bán có hạn phản hồi và hạn xử lý theo mức ưu tiên"
        actions={
          data.canEdit ? (
            <CreateTicket
              canAssign={data.canAssign}
              users={otherUsers}
              defaultOrderId={defaultOrderId}
              defaultCustomerId={defaultCustomerId}
            />
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng (theo lọc)"
          value={num(data.total)}
          hint={filtered ? "Theo điều kiện lọc hiện tại" : "Tất cả ticket trong phạm vi"}
        />
        <StatCard
          label="Quá hạn xử lý"
          value={<span className={cx(data.overdue > 0 && "text-danger")}>{num(data.overdue)}</span>}
          hint={f.overdue ? "Đang lọc ticket quá hạn xử lý" : "Ticket đang mở đã quá hạn xử lý"}
          href={qs({ overdue: f.overdue ? undefined : "1", page: undefined })}
        />
        <StatCard
          label="Đang mở"
          value={num(openCount)}
          hint={f.status === "open" ? "Đang lọc các ticket mở" : "Nhấn để xem các ticket đang mở"}
          href="?status=open"
        />
      </div>

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-2.5 px-4 py-3">
          <Filter label="Tìm kiếm">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Mã TK-…, tiêu đề, tên khách…"
              className="h-8 w-56 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring"
            />
          </Filter>

          <Filter label="Trạng thái">
            <Select
              name="status"
              value={f.status}
              options={[
                ["open", "Đang mở"],
                ...TICKET_STATUSES.map((s): [string, string] => [s, TICKET_STATUS_LABEL[s]]),
              ]}
            />
          </Filter>

          <Filter label="Mức ưu tiên">
            <Select
              name="priority"
              value={f.priority}
              options={TICKET_PRIORITIES.map((p): [string, string] => [p, PRIORITY_LABEL[p]])}
            />
          </Filter>

          <Filter label="Loại sự cố">
            <Select
              name="type"
              value={f.type}
              options={TICKET_TYPES.map((t): [string, string] => [t, TICKET_TYPE_LABEL[t]])}
            />
          </Filter>

          <Filter label="Phụ trách">
            <Select
              name="owner"
              value={f.owner}
              options={[
                ["me", "Của tôi"],
                ["none", "Chưa giao"],
                ...otherUsers.map((u): [string, string] => [
                  u.id,
                  u.team ? `${u.name} — ${u.team}` : u.name,
                ]),
              ]}
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
            Quá hạn
          </label>

          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>

          {filtered && (
            <Link href="/cham-soc" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
              Xóa lọc
            </Link>
          )}
        </form>
      </Card>

      <Card>
        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Không có ticket khớp bộ lọc"
              description="Thử thay đổi từ khóa hoặc xóa điều kiện lọc để xem danh sách."
              action={<ButtonLink href="/cham-soc">Xóa lọc</ButtonLink>}
            />
          ) : (
            <EmptyState
              title="Chưa có ticket chăm sóc"
              description="Tạo ticket đầu tiên khi khách hàng phản ánh giao chậm, lỗi hàng, đổi trả hoặc bảo hành."
              action={
                data.canEdit ? (
                  <CreateTicket
                    canAssign={data.canAssign}
                    users={otherUsers}
                    defaultOrderId={defaultOrderId}
                    defaultCustomerId={defaultCustomerId}
                  />
                ) : undefined
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách ticket chăm sóc</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  {[
                    "Mã",
                    "Tiêu đề",
                    "Khách",
                    "Mức",
                    "Trạng thái",
                    "Phụ trách",
                    "Hạn phản hồi",
                    "Hạn xử lý",
                    "Tạo lúc",
                  ].map((h) => (
                    <th key={h} scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((t) => (
                  <tr key={t.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/cham-soc/${t.id}`}
                          className="tabular font-medium text-fg hover:text-brand-active"
                        >
                          {t.code}
                        </Link>
                        {t.vip && <Badge tone="warning">Khách giá trị cao</Badge>}
                      </div>
                    </td>

                    <td className="max-w-xs px-4 py-2.5">
                      <Link
                        href={`/cham-soc/${t.id}`}
                        className="block truncate font-medium text-fg hover:text-brand-active"
                        title={t.subject}
                      >
                        {t.subject}
                      </Link>
                      <p className="text-xs text-fg-subtle">{TICKET_TYPE_LABEL[t.type]}</p>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.customer ? (
                        <Link
                          href={`/khach-hang/${t.customer.id}`}
                          className="text-fg hover:text-brand-active"
                        >
                          {t.customer.displayName}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.owner ? (
                        <span className="text-fg">{t.owner.name}</span>
                      ) : (
                        <Badge tone="warning">Chưa giao</Badge>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.firstRespondedAt ? (
                        <div>
                          <span className="text-xs text-fg-muted">Đã phản hồi</span>
                          <p className="tabular text-xs text-fg-subtle">{dateTime(t.firstRespondedAt)}</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cx(
                              "tabular",
                              t.responseOverdue ? "font-medium text-danger" : "text-fg-muted",
                            )}
                          >
                            {dateTime(t.firstResponseDueAt)}
                          </span>
                          {t.responseOverdue && <Badge tone="danger">Quá hạn</Badge>}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cx(
                            "tabular",
                            t.resolveOverdue ? "font-medium text-danger" : "text-fg-muted",
                          )}
                        >
                          {dateTime(t.resolveDueAt)}
                        </span>
                        {t.resolveOverdue && <Badge tone="danger">Quá hạn</Badge>}
                      </div>
                    </td>

                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                      {dateTime(t.createdAt)}
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
              Trang {data.page}/{pages} · {num(data.total)} ticket
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

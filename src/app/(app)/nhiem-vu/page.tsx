// Trang Danh sách nhiệm vụ (/nhiem-vu) — lọc theo hạn, trạng thái, phạm vi; tạo việc mới và cập nhật trạng thái.
import Link from "next/link";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, num } from "@/lib/format";
import { assignableUsers } from "@/modules/sales/leads";
import { listTasks, parseTaskFilter, type TaskFilter } from "@/modules/sales/tasks";
import { TASK_TYPE_LABEL } from "@/modules/sales/labels";
import { CreateTask } from "./create-task";
import { TaskButtons } from "./task-buttons";

const TASK_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Đang mở", tone: "info" },
  DONE: { label: "Xong", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

const DUE_TABS: { value: TaskFilter["due"]; label: string }[] = [
  { value: undefined, label: "Tất cả" },
  { value: "overdue", label: "Quá hạn" },
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "7 ngày" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("task.manage");
  bindTenant(user);
  const f = parseTaskFilter(await searchParams);
  const [data, users] = await Promise.all([
    listTasks(user, f),
    assignableUsers(user),
  ]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const overdueCount = data.rows.filter((r) => r.overdue).length;
  const mineCount = data.rows.filter((r) => r.mine).length;

  const qs = (patch: Partial<Record<keyof TaskFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/nhiem-vu";
  };

  const filtered = Boolean(f.due || f.status || f.who);

  return (
    <>
      <PageHeader
        title="Nhiệm vụ"
        description="Quản lý việc gọi lại, theo dõi và hẹn gặp khách hàng theo hạn xử lý."
        crumbs={[{ label: "Khách hàng" }, { label: "Nhiệm vụ" }]}
        actions={<CreateTask users={users} currentUserId={user.id} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Số việc (theo bộ lọc)" value={num(data.total)} />
        <StatCard
          label="Quá hạn (trang này)"
          value={<span className={overdueCount > 0 ? "text-danger" : undefined}>{num(overdueCount)}</span>}
          hint="Việc đang mở đã qua hạn xử lý"
        />
        <StatCard
          label="Việc của tôi (trang này)"
          value={num(mineCount)}
          hint="Việc được giao trực tiếp cho bạn"
        />
      </div>

      <Card>
        <SectionTitle>Danh sách công việc</SectionTitle>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div role="tablist" aria-label="Lọc theo hạn" className="flex flex-wrap items-center gap-1">
            {DUE_TABS.map((tab) => {
              const active = f.due === tab.value;
              return (
                <Link
                  key={tab.value ?? "all"}
                  role="tab"
                  aria-selected={active}
                  href={qs({ due: tab.value, page: undefined })}
                  className={cx(
                    "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-brand-soft font-medium text-brand-active"
                      : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <form method="get" className="flex flex-wrap items-end gap-2">
            {f.due && <input type="hidden" name="due" value={f.due} />}
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Trạng thái
              <select
                name="status"
                defaultValue={f.status ?? ""}
                className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg"
              >
                <option value="">Tất cả</option>
                <option value="OPEN">Đang mở</option>
                <option value="DONE">Xong</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Người làm
              <select
                name="who"
                defaultValue={f.who === "me" ? "me" : ""}
                className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg"
              >
                <option value="">Trong phạm vi</option>
                <option value="me">Của tôi</option>
              </select>
            </label>
            <button
              type="submit"
              className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Lọc
            </button>
            {filtered && (
              <Link href="/nhiem-vu" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
                Xóa lọc
              </Link>
            )}
          </form>
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Không có việc khớp bộ lọc"
              description="Thử đổi mốc hạn, trạng thái hoặc xóa bộ lọc để xem toàn bộ nhiệm vụ."
              action={<ButtonLink href="/nhiem-vu">Xóa lọc</ButtonLink>}
            />
          ) : (
            <EmptyState
              title="Chưa có nhiệm vụ nào"
              description="Tạo việc gọi lại, theo dõi hoặc hẹn gặp để không bỏ lỡ lịch chăm sóc khách hàng."
              action={<CreateTask users={users} currentUserId={user.id} />}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách nhiệm vụ</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  {["Việc", "Loại", "Hạn", "Người làm", "Liên quan", "Trạng thái", "Thao tác"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cx("h-10 border-b border-border px-4 whitespace-nowrap", i === 6 && "text-right")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((t) => {
                  const st = TASK_STATUS_BADGE[t.status] ?? { label: t.status, tone: "neutral" as Tone };
                  const hasRelated = Boolean(t.lead || t.customer || t.order);
                  return (
                    <tr key={t.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-fg">{t.title}</p>
                        {t.note && <p className="mt-0.5 max-w-md truncate text-xs text-fg-muted">{t.note}</p>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                        {TASK_TYPE_LABEL[t.type] ?? t.type}
                      </td>
                      <td className="tabular px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={cx(t.overdue ? "font-medium text-danger" : "text-fg-muted")}>
                            {dateTime(t.dueAt)}
                          </span>
                          {t.overdue && <Badge tone="danger">Quá hạn</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-fg">{t.assignee.name}</span>
                          {t.mine && <Badge tone="brand">Của tôi</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {hasRelated ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {t.lead && (
                              <Link href={`/nhu-cau/${t.lead.id}`} className="font-medium text-fg hover:text-brand-active hover:underline">
                                Lead: {t.lead.contactName}
                              </Link>
                            )}
                            {t.customer && (
                              <Link href={`/khach-hang/${t.customer.id}`} className="text-fg-muted hover:text-brand-active hover:underline">
                                Khách: {t.customer.displayName}
                              </Link>
                            )}
                            {t.order && (
                              <Link href={`/don-hang/${t.order.id}`} className="text-fg-muted hover:text-brand-active hover:underline">
                                Đơn: {t.order.orderNumber}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <TaskButtons id={t.id} status={t.status} />
                      </td>
                    </tr>
                  );
                })}
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
              Trang {data.page}/{pages} · {num(data.total)} việc
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

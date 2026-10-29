// Trang Hàng đợi của tôi (/hang-doi) — việc cần làm sắp theo mức gấp (quá hạn trước) và thông báo cá nhân.
import Link from "next/link";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from "@/components/ui";
import { currentUserOrRedirect } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { ago, dateTime, num } from "@/lib/format";
import { listNotifications, myQueue, type QueueItem } from "@/modules/sales/queue";
import { MarkReadButton } from "./read-button";

const KIND_BADGE: Record<QueueItem["kind"], { label: string; tone: Tone }> = {
  lead_response: { label: "Chờ phản hồi", tone: "warning" },
  lead_followup: { label: "Liên hệ lại", tone: "info" },
  lead_unassigned: { label: "Chưa giao", tone: "neutral" },
  task: { label: "Việc", tone: "brand" },
};

export default async function MyQueuePage() {
  const user = await currentUserOrRedirect();
  bindTenant(user);
  const [queue, notifications] = await Promise.all([
    myQueue(user),
    listNotifications(user),
  ]);

  return (
    <>
      <PageHeader
        title="Hàng đợi của tôi"
        crumbs={[{ label: "Khách hàng" }, { label: "Hàng đợi của tôi" }]}
        description="Việc cần làm sắp theo mức gấp: quá hạn trước"
        actions={
          <>
            <ButtonLink href="/nhiem-vu" variant="secondary">
              Nhiệm vụ
            </ButtonLink>
            <ButtonLink href="/nhu-cau" variant="primary">
              Nhu cầu mua
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng việc"
          value={num(queue.items.length)}
          hint="Nhu cầu chờ phản hồi, hẹn liên hệ lại và việc trong 24 giờ"
        />
        <StatCard
          label="Quá hạn"
          value={<span className="text-danger">{num(queue.overdue)}</span>}
          hint={queue.overdue > 0 ? "Cần ưu tiên xử lý ngay" : "Không có việc nào quá hạn"}
        />
        <StatCard
          label="Thông báo chưa đọc"
          value={num(notifications.unread)}
          hint={notifications.unread > 0 ? `${num(notifications.rows.length)} thông báo gần nhất` : "Đã đọc hết thông báo"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <SectionTitle>Danh sách việc cần xử lý ({num(queue.items.length)})</SectionTitle>
            {queue.items.length === 0 ? (
              <EmptyState
                title="Không còn việc gấp — làm tốt lắm!"
                description="Mọi nhu cầu mua chờ phản hồi và nhiệm vụ đến hạn của bạn đều đã được giải quyết."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <ButtonLink href="/nhu-cau" variant="primary">
                      Mở Nhu cầu mua
                    </ButtonLink>
                    <ButtonLink href="/nhiem-vu" variant="secondary">
                      Mở Nhiệm vụ
                    </ButtonLink>
                  </div>
                }
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {queue.items.map((item) => {
                  const kb = KIND_BADGE[item.kind];
                  return (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={kb.tone}>{kb.label}</Badge>
                          <Link
                            href={item.link}
                            className="font-medium text-fg hover:text-brand-active hover:underline"
                          >
                            {item.title}
                          </Link>
                        </div>
                        <p className="mt-1 truncate text-xs text-fg-muted">
                          {item.detail ?? "—"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cx(
                            "tabular text-xs whitespace-nowrap",
                            item.overdue ? "font-medium text-danger" : "text-fg-muted",
                          )}
                        >
                          {dateTime(item.dueAt)}
                        </span>
                        {item.overdue && <Badge tone="danger">Quá hạn</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <SectionTitle actions={notifications.unread > 0 ? <MarkReadButton /> : undefined}>
              Thông báo
            </SectionTitle>
            {notifications.rows.length === 0 ? (
              <EmptyState
                title="Chưa có thông báo nào"
                description="Thông báo phân công nhu cầu mua hoặc nhắc hạn công việc sẽ xuất hiện tại đây."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {notifications.rows.map((n) => (
                  <li key={n.id} className="flex items-start gap-2.5 px-4 py-3 hover:bg-bg-subtle">
                    <span
                      aria-label={n.read ? "Đã đọc" : "Chưa đọc"}
                      title={n.read ? "Đã đọc" : "Chưa đọc"}
                      className={cx(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.read ? "bg-border" : "bg-brand",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      {n.link ? (
                        <Link
                          href={n.link}
                          className={cx(
                            "block hover:text-brand-active hover:underline",
                            n.read ? "font-medium text-fg" : "font-semibold text-fg",
                          )}
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className={cx(n.read ? "font-medium text-fg" : "font-semibold text-fg")}>
                          {n.title}
                        </p>
                      )}
                      {n.body && <p className="mt-0.5 text-xs text-fg-muted">{n.body}</p>}
                      <p className="tabular mt-1 text-xs text-fg-subtle" title={dateTime(n.createdAt)}>
                        {ago(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

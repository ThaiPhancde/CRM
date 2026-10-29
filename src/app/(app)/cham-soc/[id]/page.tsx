// Trang chi tiết ticket chăm sóc sau bán — phản hồi khách, ghi chú nội bộ, dòng thời gian, trạng thái/mức ưu tiên và bài tri thức gợi ý.
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  cx,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { dateTime, num } from "@/lib/format";
import { assignableUsers } from "@/modules/sales/leads";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABEL,
} from "@/modules/service/labels";
import { getTicket, type TicketDetail } from "@/modules/service/tickets";
import { AssignTicketDrawer } from "./assign";
import { ReplyForm } from "./reply-form";
import { StatusPriorityForm } from "./status-form";
import { DELIVERY_EVENT } from "@/lib/status-badge";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Tạo ticket",
  CUSTOMER: "Khách nhắn",
  NOTE: "Ghi chú nội bộ",
  REPLY: "Trả lời khách",
  STATUS: "Đổi trạng thái",
  ASSIGN: "Chuyển phụ trách",
  PRIORITY: "Đổi mức ưu tiên",
  SYSTEM: "Hệ thống",
};

const EVENT_DOT: Record<string, string> = {
  CUSTOMER: "border-info bg-info-soft",
  CREATED: "border-info bg-info-soft",
  REPLY: "border-brand bg-brand-soft",
  NOTE: "border-warning bg-warning-soft",
  STATUS: "border-success bg-success-soft",
  ASSIGN: "border-info bg-info-soft",
  PRIORITY: "border-warning bg-warning-soft",
  SYSTEM: "border-border-strong bg-bg-muted",
};

const LANGUAGE_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

const ORDER_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Nháp", tone: "neutral" },
  CONFIRMED: { label: "Đã xác nhận", tone: "info" },
  PACKING: { label: "Đang đóng gói", tone: "info" },
  SHIPPED: { label: "Đang giao", tone: "brand" },
  DELIVERED: { label: "Đã giao", tone: "success" },
  RETURNED: { label: "Hoàn hàng", tone: "warning" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "warning" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
};

const FULFILLMENT_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  UNFULFILLED: { label: "Chưa xử lý", tone: "neutral" },
  PARTIAL: { label: "Giao một phần", tone: "warning" },
  FULFILLED: { label: "Đã xuất kho", tone: "info" },
  DELIVERED: { label: "Đã giao thành công", tone: "success" },
  RETURNED: { label: "Đã hoàn kho", tone: "danger" },
};

const TASK_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Đang mở", tone: "info" },
  DONE: { label: "Xong", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

function formatTransition(type: string, meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const from = typeof m.from === "string" ? m.from : null;
  const to = typeof m.to === "string" ? m.to : null;
  if (!from && !to) return null;
  if (type === "STATUS") {
    const fLabel = from ? (TICKET_STATUS_LABEL[from as TicketDetail["status"]] ?? from) : "—";
    const tLabel = to ? (TICKET_STATUS_LABEL[to as TicketDetail["status"]] ?? to) : "—";
    return `${fLabel} → ${tLabel}`;
  }
  if (type === "PRIORITY") {
    const fLabel = from ? (PRIORITY_LABEL[from as TicketDetail["priority"]] ?? from) : "—";
    const tLabel = to ? (PRIORITY_LABEL[to as TicketDetail["priority"]] ?? to) : "—";
    return `${fLabel} → ${tLabel}`;
  }
  return null;
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser("ticket.view");
  bindTenant(user);
  const { id } = await params;

  let ticket: TicketDetail;
  try {
    ticket = await getTicket(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const users = ticket.canAssign
    ? (await assignableUsers(user)).map((u) => ({
        id: u.id,
        name: u.name,
        team: u.team,
      }))
    : [];

  const typeLabel = TICKET_TYPE_LABEL[ticket.type] ?? ticket.type;
  const nowMs = Date.now();

  return (
    <>
      <PageHeader
        title={`${ticket.code}: ${ticket.subject}`}
        crumbs={[
          { label: "Chăm sóc" },
          { href: "/cham-soc", label: "Ticket" },
          { label: ticket.code },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {typeLabel} · tạo {dateTime(ticket.createdAt)}
            </span>
            <Badge tone={PRIORITY_TONE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
            <Badge tone={TICKET_STATUS_TONE[ticket.status]}>
              {TICKET_STATUS_LABEL[ticket.status]}
            </Badge>
            {ticket.vip && <Badge tone="warning">Khách giá trị cao</Badge>}
          </span>
        }
        actions={
          ticket.canAssign ? (
            <AssignTicketDrawer
              ticketId={ticket.id}
              currentOwnerId={ticket.owner?.id ?? null}
              users={users}
            />
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hạn phản hồi đầu"
          value={
            <span className={cx("text-xl font-semibold", ticket.responseOverdue && "text-danger")}>
              {dateTime(ticket.firstResponseDueAt)}
            </span>
          }
          hint={
            ticket.firstRespondedAt ? (
              `Đã phản hồi ${dateTime(ticket.firstRespondedAt)}`
            ) : ticket.responseOverdue ? (
              <Badge tone="danger">Quá hạn</Badge>
            ) : (
              "Chưa phản hồi"
            )
          }
        />
        <StatCard
          label="Hạn xử lý"
          value={
            <span className={cx("text-xl font-semibold", ticket.resolveOverdue && "text-danger")}>
              {dateTime(ticket.resolveDueAt)}
            </span>
          }
          hint={
            ticket.resolvedAt ? (
              `Đã giải quyết ${dateTime(ticket.resolvedAt)}`
            ) : ticket.resolveOverdue ? (
              <Badge tone="danger">Quá hạn</Badge>
            ) : (
              "Đang trong hạn"
            )
          }
        />
        <StatCard
          label="Phụ trách"
          value={
            <span className="text-xl font-semibold">
              {ticket.owner ? ticket.owner.name : "Chưa giao"}
            </span>
          }
          hint={ticket.owner ? "Người phụ trách hiện tại" : <Badge tone="warning">Chưa giao</Badge>}
        />
        <StatCard
          label="Mức ưu tiên"
          value={
            <Badge tone={PRIORITY_TONE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
          }
          hint={
            <Badge tone={TICKET_STATUS_TONE[ticket.status]}>
              {TICKET_STATUS_LABEL[ticket.status]}
            </Badge>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Cột trái 2/3: Biểu mẫu trả lời/ghi chú + Dòng thời gian sự kiện */}
        <div className="space-y-4 xl:col-span-2">
          {ticket.canEdit && (
            <Card>
              <SectionTitle>Phản hồi & ghi chú</SectionTitle>
              <ReplyForm ticketId={ticket.id} />
            </Card>
          )}

          <Card>
            <SectionTitle>Dòng thời gian xử lý ({num(ticket.events.length)})</SectionTitle>
            {ticket.events.length === 0 ? (
              <EmptyState
                title="Chưa có sự kiện nào"
                description="Mọi trao đổi với khách hàng, ghi chú nội bộ và thay đổi trạng thái sẽ hiển thị theo thứ tự thời gian tại đây."
              />
            ) : (
              <ol className="px-4 py-4">
                {ticket.events.map((e, idx) => {
                  const isReply = e.type === "REPLY";
                  const isNote = e.type === "NOTE";
                  const isCustomer = e.type === "CUSTOMER";
                  const transition = formatTransition(e.type, e.meta);
                  return (
                    <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < ticket.events.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[5px] top-3 h-full w-px bg-border"
                        />
                      )}
                      <span
                        aria-hidden
                        className={cx(
                          "mt-1.5 size-[11px] shrink-0 rounded-full border-2",
                          EVENT_DOT[e.type] ?? EVENT_DOT.SYSTEM,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-fg">
                            {EVENT_LABEL[e.type] ?? e.type}
                          </span>
                          {isNote && <Badge tone="warning">Nội bộ</Badge>}
                          {transition && (
                            <span className="rounded-[var(--radius-sm)] bg-bg-muted px-2 py-0.5 font-medium text-fg">
                              {transition}
                            </span>
                          )}
                          <span className="text-fg-muted">· {e.actor ?? (isCustomer || e.type === "CREATED" ? "Khách" : "Hệ thống")}</span>
                          <span className="tabular text-fg-subtle">· {dateTime(e.at)}</span>
                        </div>
                        {e.body && (
                          <div
                            className={cx(
                              "mt-1.5",
                              isReply &&
                                "rounded-[var(--radius-sm)] border border-brand-ring/50 bg-brand-soft p-3 text-fg",
                              isNote &&
                                "rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-fg",
                              isCustomer && "rounded-[var(--radius-sm)] border border-border bg-bg-subtle p-3 text-fg",
                              !isReply && !isNote && !isCustomer && "text-fg-muted",
                            )}
                          >
                            <p dir="auto" className="whitespace-pre-line text-sm">
                              {e.body}
                            </p>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {/* Cột phải 1/3: Khách hàng, Đơn liên quan, Trạng thái & mức, Việc, Bài tri thức gợi ý */}
        <div className="space-y-4">
          <Card>
            <SectionTitle>Khách hàng</SectionTitle>
            {ticket.customerInfo ? (
              <dl className="space-y-2.5 px-4 py-3 text-sm">
                <InfoRow
                  label="Họ tên"
                  value={
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <Link
                        href={`/khach-hang/${ticket.customerInfo.id}`}
                        className="font-medium text-brand-active hover:underline"
                      >
                        {ticket.customerInfo.name}
                      </Link>
                      {ticket.vip && <Badge tone="warning">Khách giá trị cao</Badge>}
                    </span>
                  }
                />
                <InfoRow
                  label="Số điện thoại"
                  value={<span className="tabular">{ticket.customerInfo.phone ?? "—"}</span>}
                />
                <InfoRow label="Email" value={ticket.customerInfo.email ?? "—"} />
                <InfoRow
                  label="Đơn đã giao / Tổng"
                  value={
                    <span className="tabular font-medium">
                      {num(ticket.customerInfo.deliveredOrders)} /{" "}
                      {num(ticket.customerInfo.orderCount)} đơn
                    </span>
                  }
                />
              </dl>
            ) : (
              <p className="px-4 py-4 text-sm text-fg-muted">Chưa gắn khách</p>
            )}
          </Card>

          <Card>
            <SectionTitle>Đơn liên quan</SectionTitle>
            {ticket.orderInfo ? (
              <div className="space-y-3 px-4 py-3 text-sm">
                <dl className="space-y-2">
                  <InfoRow
                    label="Mã đơn"
                    value={
                      <Link
                        href={`/don-hang/${ticket.orderInfo.id}`}
                        className="tabular font-medium text-brand-active hover:underline"
                      >
                        {ticket.orderInfo.orderNumber}
                      </Link>
                    }
                  />
                  <InfoRow
                    label="Trạng thái đơn"
                    value={
                      <Badge
                        tone={ORDER_STATUS_LABEL[ticket.orderInfo.status]?.tone ?? "neutral"}
                      >
                        {ORDER_STATUS_LABEL[ticket.orderInfo.status]?.label ??
                          ticket.orderInfo.status}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Giao vận"
                    value={
                      <Badge
                        tone={
                          FULFILLMENT_STATUS_LABEL[ticket.orderInfo.fulfillmentStatus]?.tone ??
                          "neutral"
                        }
                      >
                        {FULFILLMENT_STATUS_LABEL[ticket.orderInfo.fulfillmentStatus]?.label ??
                          ticket.orderInfo.fulfillmentStatus}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Đặt lúc"
                    value={<span className="tabular">{dateTime(ticket.orderInfo.bookedAt)}</span>}
                  />
                </dl>

                <div className="border-t border-border pt-2.5">
                  <p className="mb-1.5 text-xs font-semibold text-fg-muted">Vận đơn</p>
                  {ticket.orderInfo.shipments.length === 0 ? (
                    <p className="text-xs text-fg-muted">Chưa có vận đơn</p>
                  ) : (
                    <ul className="space-y-2">
                      {ticket.orderInfo.shipments.map((s, sIdx) => (
                        <li
                          key={`${s.carrier}-${s.trackingNo ?? sIdx}`}
                          className="rounded-[var(--radius-sm)] border border-border bg-bg-subtle p-2.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-fg">{s.carrier}</span>
                            <span className="tabular text-fg-muted">
                              {s.trackingNo ?? "Chưa có mã vận đơn"}
                            </span>
                          </div>
                          {s.events.length > 0 && (
                            <ul className="mt-1.5 space-y-1 border-t border-border pt-1.5 text-fg-muted">
                              {s.events.map((ev, evIdx) => (
                                <li
                                  key={`${ev.type}-${ev.at}-${evIdx}`}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span>
                                    {DELIVERY_EVENT[ev.type] ?? ev.type}
                                    {ev.reasonCode ? ` (${ev.reasonCode})` : ""}
                                  </span>
                                  <span className="tabular text-fg-subtle">{dateTime(ev.at)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-fg-muted">—</p>
            )}
          </Card>

          {ticket.canEdit && (
            <Card>
              <SectionTitle>Trạng thái & mức</SectionTitle>
              <StatusPriorityForm
                ticketId={ticket.id}
                currentStatus={ticket.status}
                currentPriority={ticket.priority}
              />
            </Card>
          )}

          <Card>
            <SectionTitle>Việc ({num(ticket.tasks.length)})</SectionTitle>
            {ticket.tasks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">
                Chưa có việc nào gắn với ticket này.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {ticket.tasks.map((t) => {
                  const statusBadge = TASK_STATUS_BADGE[t.status] ?? {
                    label: t.status,
                    tone: "neutral" as Tone,
                  };
                  const taskOverdue = t.status === "OPEN" && new Date(t.dueAt).getTime() < nowMs;
                  return (
                    <li key={t.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-fg">{t.title}</p>
                        <div className="flex items-center gap-1.5">
                          {taskOverdue && <Badge tone="danger">Quá hạn</Badge>}
                          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        <span>Phụ trách: {t.assignee}</span>
                        {" · "}
                        <span className={cx("tabular", taskOverdue && "font-medium text-danger")}>
                          Hạn {dateTime(t.dueAt)}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>Bài tri thức gợi ý</SectionTitle>
            {ticket.articles.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Chưa có bài phù hợp</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {ticket.articles.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <Link
                      href={`/tri-thuc/${a.id}`}
                      dir="auto"
                      className="font-medium text-brand-active hover:underline"
                    >
                      {a.title}
                    </Link>
                    <Badge tone="neutral">{LANGUAGE_LABEL[a.language] ?? a.language}</Badge>
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{value}</dd>
    </div>
  );
}

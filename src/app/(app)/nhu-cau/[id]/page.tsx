// Trang chi tiết nhu cầu mua (Lead Detail) — tương tác, giai đoạn, việc, kịch bản tư vấn và lịch sử phụ trách.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { date, dateTime, money, num } from "@/lib/format";
import { assignableUsers, getLead, STAGE_LABEL, type LeadDetail } from "@/modules/sales/leads";
import { getLeadScore } from "@/modules/scoring/service";
import { ActivityForm } from "./activity-form";
import { ClaimButton } from "./claim-button";
import { LeadScoreCard } from "./lead-score";
import { ReassignDrawer } from "./reassign";
import { StageForm } from "./stage-form";
import { TaskForm } from "./task-form";

const STAGE_TONE: Record<LeadDetail["stage"], Tone> = {
  MOI: "info",
  DANG_TU_VAN: "brand",
  CHO_QUYET_DINH: "warning",
  DA_MUA: "success",
  TU_CHOI: "neutral",
  MAT_LIEN_LAC: "danger",
};

const SOURCE_LABEL: Record<string, string> = {
  inbox: "Hộp thư",
  website: "Website",
  ads: "Quảng cáo",
  referral: "Giới thiệu",
  manual: "Nhập tay",
};

const LANGUAGE_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

const ACTIVITY_LABEL: Record<string, string> = {
  CALL: "Cuộc gọi",
  MESSAGE: "Tin nhắn",
  MEETING: "Gặp mặt",
  NOTE: "Ghi chú",
  SYSTEM: "Hệ thống",
};

const ACTIVITY_DOT: Record<string, string> = {
  CALL: "border-brand bg-brand-soft",
  MESSAGE: "border-info bg-info-soft",
  MEETING: "border-success bg-success-soft",
  NOTE: "border-warning bg-warning-soft",
  SYSTEM: "border-border-strong bg-bg-muted",
};

const DIRECTION_LABEL: Record<string, string> = {
  IN: "Khách gửi",
  OUT: "Gửi khách",
};

const CHANNEL_LABEL: Record<string, string> = {
  PHONE: "Điện thoại",
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
  EMAIL: "Email",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  CALL_BACK: "Gọi lại",
  FOLLOW_UP: "Theo dõi",
  MEETING: "Hẹn gặp",
  OTHER: "Khác",
};

const TASK_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Đang mở", tone: "info" },
  DONE: { label: "Xong", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser("lead.view");
  bindTenant(user);
  const { id } = await params;

  let lead: LeadDetail;
  try {
    lead = await getLead(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const score = await getLeadScore(user, id);

  const users =
    lead.canAssign || lead.canEdit
      ? (await assignableUsers(user)).map((u) => ({
          id: u.id,
          name: u.name,
          team: u.team,
        }))
      : [];

  const sourceText = SOURCE_LABEL[lead.source] ?? lead.source;
  const brandMarket =
    [
      lead.brand ? `${lead.brand.code} · ${lead.brand.name}` : null,
      lead.market ? `${lead.market.code} · ${lead.market.name}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  const nowMs = Date.now();

  return (
    <>
      <PageHeader
        title={lead.contactName}
        crumbs={[
          { label: "Khách hàng" },
          { href: "/nhu-cau", label: "Nhu cầu mua" },
          { label: lead.contactName },
        ]}
        description={`${sourceText} · tạo ${dateTime(lead.createdAt)}`}
        actions={
          lead.canClaim || lead.canAssign ? (
            <>
              {lead.canClaim && <ClaimButton leadId={lead.id} />}
              {lead.canAssign && (
                <ReassignDrawer
                  leadId={lead.id}
                  currentOwnerId={lead.owner?.id ?? null}
                  users={users}
                />
              )}
            </>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Giai đoạn"
          value={<Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>}
          hint={lead.lostReason ? `Lý do: ${lead.lostReason}` : undefined}
        />
        <StatCard
          label="Phụ trách"
          value={
            <span className="text-xl font-semibold">
              {lead.owner ? lead.owner.name : "Chưa giao"}
            </span>
          }
          hint={lead.team ? `Nhóm: ${lead.team}` : "Chưa phân nhóm"}
        />
        <StatCard
          label="Hạn phản hồi"
          value={
            <span className={cx("text-xl font-semibold", lead.overdue && "text-danger")}>
              {dateTime(lead.firstResponseDueAt)}
            </span>
          }
          hint={
            lead.firstRespondedAt ? (
              `Đã phản hồi ${dateTime(lead.firstRespondedAt)}`
            ) : lead.overdue ? (
              <Badge tone="danger">Quá hạn</Badge>
            ) : (
              "Chưa phản hồi"
            )
          }
        />
        <StatCard
          label="Hẹn liên hệ lại"
          value={
            <span className="text-xl font-semibold">
              {lead.nextActionAt ? dateTime(lead.nextActionAt) : "—"}
            </span>
          }
          hint={lead.nextActionAt ? "Lịch hẹn tiếp theo" : "Chưa đặt lịch hẹn"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Cột trái 2/3: Ghi tương tác + Dòng thời gian tương tác */}
        <div className="space-y-4 xl:col-span-2">
          {lead.canEdit && (
            <Card>
              <SectionTitle>Ghi tương tác</SectionTitle>
              <ActivityForm leadId={lead.id} />
            </Card>
          )}

          <Card>
            <SectionTitle>Dòng thời gian tương tác ({num(lead.activities.length)})</SectionTitle>
            {lead.activities.length === 0 ? (
              <EmptyState
                title="Chưa có tương tác nào"
                description="Ghi nhận cuộc gọi, tin nhắn, buổi gặp mặt hoặc ghi chú đầu tiên với khách hàng."
              />
            ) : (
              <ol className="px-4 py-3">
                {lead.activities.map((a, idx) => {
                  const isSystem = a.type === "SYSTEM";
                  return (
                    <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < lead.activities.length - 1 && (
                        <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-border" />
                      )}
                      <span
                        aria-hidden
                        className={cx(
                          "mt-1.5 size-[11px] shrink-0 rounded-full border-2",
                          ACTIVITY_DOT[a.type] ?? ACTIVITY_DOT.SYSTEM,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={cx("font-semibold", isSystem ? "text-fg-muted" : "text-fg")}>
                            {ACTIVITY_LABEL[a.type] ?? a.type}
                          </span>
                          {a.direction && (
                            <Badge tone={a.direction === "IN" ? "info" : "brand"}>
                              {DIRECTION_LABEL[a.direction] ?? a.direction}
                            </Badge>
                          )}
                          {a.channel && (
                            <Badge tone="neutral">{CHANNEL_LABEL[a.channel] ?? a.channel}</Badge>
                          )}
                          <span className="text-fg-muted">
                            · {a.actor ?? (a.type === "SYSTEM" ? "Tự động" : "Khách")}
                          </span>
                          {a.durationSec != null && (
                            <span className="tabular text-fg-muted">
                              · {num(a.durationSec)} giây
                            </span>
                          )}
                          <span className="tabular text-fg-subtle">
                            · {dateTime(a.occurredAt)}
                          </span>
                        </div>
                        <p
                          dir="auto"
                          className={cx(
                            "mt-1 whitespace-pre-line text-sm",
                            isSystem ? "text-fg-muted" : "text-fg",
                          )}
                        >
                          {a.body}
                        </p>
                        {a.outcome && (
                          <p className="mt-1 text-xs text-fg-muted">
                            Kết quả: <span className="font-medium text-fg">{a.outcome}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {/* Cột phải 1/3: Điểm ưu tiên sales, Thông tin liên hệ, Giai đoạn, Việc, Kịch bản tư vấn, Lịch sử phụ trách */}
        <div className="space-y-4">
          <LeadScoreCard score={score} />

          <Card>
            <SectionTitle>Thông tin liên hệ</SectionTitle>
            <dl className="space-y-2.5 px-4 py-3 text-sm">
              <InfoRow label="Số điện thoại" value={<span className="tabular">{lead.phone ?? "—"}</span>} />
              <InfoRow label="Email" value={lead.email ?? "—"} />
              <InfoRow
                label="Ngôn ngữ"
                value={lead.language ? (LANGUAGE_LABEL[lead.language] ?? lead.language) : "—"}
              />
              <InfoRow label="Brand · Thị trường" value={brandMarket} />
              <InfoRow label="Nhu cầu" value={lead.interest ?? "—"} />
              <InfoRow
                label="Ngân sách"
                value={
                  <span className="tabular">
                    {lead.budget && lead.budget.currency
                      ? money(lead.budget.amount, lead.budget.currency)
                      : "—"}
                  </span>
                }
              />
              <InfoRow
                label="Hồ sơ khách hàng"
                value={
                  lead.customer ? (
                    <div className="text-right">
                      <Link
                        href={`/khach-hang/${lead.customer.id}`}
                        className="font-medium text-brand-active hover:underline"
                      >
                        {lead.customer.displayName}
                      </Link>
                      <p className="tabular text-xs text-fg-muted">
                        {num(lead.customer.orderCount)} đơn · mua gần nhất {date(lead.customer.lastOrderAt)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-fg-muted">Chưa gắn hồ sơ khách</span>
                  )
                }
              />
            </dl>
          </Card>

          {lead.canEdit && (
            <Card>
              <SectionTitle>Giai đoạn</SectionTitle>
              <StageForm
                leadId={lead.id}
                currentStage={lead.stage}
                currentLostReason={lead.lostReason}
                currentNextActionAt={lead.nextActionAt}
              />
            </Card>
          )}

          <Card>
            <SectionTitle>Việc ({num(lead.tasks.length)})</SectionTitle>
            {lead.tasks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Chưa có việc nào gắn với nhu cầu này.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {lead.tasks.map((t) => {
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
                        <span>{TASK_TYPE_LABEL[t.type] ?? t.type}</span>
                        {" · "}
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
            {lead.canEdit && (
              <TaskForm leadId={lead.id} canAssign={lead.canAssign} users={users} />
            )}
          </Card>

          <Card>
            <SectionTitle>Kịch bản tư vấn</SectionTitle>
            {lead.scripts.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Chưa có kịch bản phù hợp</p>
            ) : (
              <div className="divide-y divide-border">
                {lead.scripts.map((s) => (
                  <details key={s.id} dir="auto" className="group px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-fg hover:text-brand-active">
                      {s.title}
                    </summary>
                    <p
                      dir="auto"
                      className="mt-2 whitespace-pre-line rounded-[var(--radius-sm)] bg-bg-subtle p-3 text-sm text-fg-muted"
                    >
                      {s.body}
                    </p>
                  </details>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Lịch sử phụ trách</SectionTitle>
            {lead.assignments.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Chưa có lịch sử phụ trách.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {lead.assignments.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <p className="font-medium text-fg">
                      {a.from ?? "Chưa giao"} → {a.to ?? "Chưa giao"}
                    </p>
                    {a.reason && <p className="mt-0.5 text-xs text-fg-muted">{a.reason}</p>}
                    <p className="mt-1 text-xs text-fg-subtle">
                      Người chuyển: <span className="text-fg-muted">{a.by ?? "Tự động"}</span> ·{" "}
                      <span className="tabular">{dateTime(a.at)}</span>
                    </p>
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

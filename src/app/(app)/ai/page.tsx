// Trung tâm AI: Trợ lý, lịch sử lần chạy (AI-01), hàng chờ duyệt (ai.approve), chi phí & chỉ số AI-01..03 (ai.budget).
import Link from "next/link";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, SectionTitle, StatCard, cx } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, num } from "@/lib/format";
import { can } from "@/lib/permissions";
import { aiStats, listApprovals, listRuns, type ApprovalRow } from "@/modules/ai/history";
import {
  AI_FEATURES,
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  FEATURE_LABEL,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  TOOL_LABEL,
  TOOL_STATUS_LABEL,
  TOOL_STATUS_TONE,
  type AiFeatureKey,
} from "@/modules/ai/labels";
import { ApprovalButtons } from "./approval-buttons";
import { AssistantBox } from "./assistant-box";
import { BudgetForm } from "./budget-form";

const RUN_STATUSES = ["OK", "NEEDS_CLARIFICATION", "DENIED", "ERROR"] as const;
const APPROVAL_FILTERS = [
  ["PENDING", APPROVAL_STATUS_LABEL.PENDING],
  ["APPROVED", APPROVAL_STATUS_LABEL.APPROVED],
  ["REJECTED", APPROVAL_STATUS_LABEL.REJECTED],
  ["ALL", "Tất cả"],
] as const;

const usd = (v: string | number | null | undefined) =>
  `${Number(v ?? 0).toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD`;

const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "0%");

function renderApprovalContent(a: ApprovalRow) {
  if (a.kind === "suggestion" && a.suggestion) {
    const interest = String((a.suggestion.payload as { interest?: unknown } | null)?.interest ?? "");
    return (
      <div className="space-y-0.5">
        <Link href={`/nhu-cau/${a.suggestion.entityId}`} className="font-medium text-brand hover:underline">
          Cập nhật nhu cầu: {interest || "—"}
        </Link>
        {a.runId && (
          <div>
            <Link href={`/ai/${a.runId}`} className="text-xs text-fg-muted hover:text-brand">
              Xem lần chạy
            </Link>
          </div>
        )}
      </div>
    );
  }
  const args = (a.args ?? {}) as { title?: unknown; dueAt?: unknown; at?: unknown; assigneeId?: unknown };
  const details = [
    args.title ? `“${String(args.title)}”` : null,
    args.dueAt ? `hạn ${dateTime(String(args.dueAt))}` : args.at ? `lúc ${dateTime(String(args.at))}` : null,
    args.assigneeId ? `giao cho ${String(args.assigneeId)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-0.5">
      <div>
        <span className="font-medium text-fg">{(a.tool && TOOL_LABEL[a.tool]) || a.tool || "Công cụ"}</span>
        {details.length > 0 && <span className="ml-1.5 text-fg-muted">· {details.join(" · ")}</span>}
      </div>
      {a.runId && (
        <div>
          <Link href={`/ai/${a.runId}`} className="text-xs text-fg-muted hover:text-brand">
            Xem lần chạy
          </Link>
        </div>
      )}
    </div>
  );
}

export default async function AiCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await pageUser("ai.run");
  bindTenant(user);

  const canApprove = can(user.roles, "ai.approve");
  const canBudget = can(user.roles, "ai.budget");

  const tabs: [string, string][] = [
    ["tro-ly", "Trợ lý"],
    ["lich-su", "Lịch sử chạy"],
    ...(canApprove ? ([["duyet", "Chờ duyệt"]] as [string, string][]) : []),
    ...(canBudget ? ([["chi-phi", "Chi phí & chỉ số"]] as [string, string][]) : []),
  ];
  const tab = tabs.some(([k]) => k === sp.tab) ? (sp.tab as string) : "tro-ly";

  const feature = AI_FEATURES.includes(sp.feature as AiFeatureKey) ? (sp.feature as AiFeatureKey) : undefined;
  const status = RUN_STATUSES.includes(sp.status as (typeof RUN_STATUSES)[number])
    ? (sp.status as (typeof RUN_STATUSES)[number])
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const approvalStatus = APPROVAL_FILTERS.some(([k]) => k === sp["trang-thai"])
    ? (sp["trang-thai"] as "PENDING" | "APPROVED" | "REJECTED" | "ALL")
    : "PENDING";

  const [runs, approvals, stats] = await Promise.all([
    tab === "lich-su" ? listRuns(user, { page, feature, status }) : Promise.resolve(null),
    tab === "duyet" && canApprove ? listApprovals(user, approvalStatus) : Promise.resolve(null),
    tab === "chi-phi" && canBudget ? aiStats(user) : Promise.resolve(null),
  ]);

  const qs = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: "lich-su", feature, status, page, ...p })) {
      if (v && !(k === "page" && v === 1)) u.set(k, String(v));
    }
    return `/ai?${u.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Trung tâm AI"
        crumbs={[{ label: "Phân tích" }, { label: "Trung tâm AI" }]}
        description="Trợ lý chạy với quyền của bạn; mọi câu trả lời có bằng chứng, mọi lần chạy có chi phí. Demo dùng mô hình replay — không gọi mạng."
      />

      <nav aria-label="Chuyên mục Trung tâm AI" className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map(([k, label]) => (
          <Link
            key={k}
            href={`/ai?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cx(
              "rounded-[var(--radius-sm)] px-2.5 py-1 text-sm",
              tab === k ? "bg-brand-soft font-medium text-brand" : "text-fg-muted hover:bg-bg-subtle",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "tro-ly" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle>Trợ lý</SectionTitle>
            <div className="p-4">
              <AssistantBox />
            </div>
          </Card>
          <Card>
            <SectionTitle>Bạn có thể hỏi</SectionTitle>
            <ul className="list-disc space-y-2 p-4 pl-8 text-sm text-fg">
              <li>Tóm tắt khách ở trang khách hàng kèm bằng chứng đơn hàng và hội thoại.</li>
              <li>Tìm tự nhiên đơn hàng và khách hàng ở thanh tìm kiếm đầu trang.</li>
              <li>Tóm tắt hội thoại nhanh tại màn hình chi tiết ticket hoặc nhu cầu mua.</li>
              <li>Soạn phản hồi đa ngôn ngữ (Việt, Anh, Ả Rập, Đức) tại ticket hoặc nhu cầu mua.</li>
              <li>Tạo việc theo dõi hoặc đặt lịch hẹn với khách hàng ngay tại ô trợ lý.</li>
              <li>Hỏi báo cáo doanh thu chuẩn REV-01…04 theo thị trường hoặc toàn đội.</li>
            </ul>
          </Card>
        </div>
      )}

      {tab === "lich-su" && runs && (
        <Card>
          <SectionTitle actions={<span className="text-xs text-fg-muted">{num(runs.total)} lần chạy</span>}>
            Lịch sử lần chạy AI
          </SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <nav aria-label="Lọc theo trạng thái lần chạy" className="flex flex-wrap gap-1">
              {(
                [
                  ["", "Tất cả"],
                  ...RUN_STATUSES.map((s) => [s, RUN_STATUS_LABEL[s]] as const),
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  href={qs({ status: v || undefined, page: 1 })}
                  aria-current={(status ?? "") === v ? "page" : undefined}
                  className={cx(
                    "rounded-[var(--radius-sm)] px-2.5 py-1 text-sm",
                    (status ?? "") === v ? "bg-brand-soft font-medium text-brand" : "text-fg-muted hover:bg-bg-subtle",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <form method="get" action="/ai" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="lich-su" />
              {status && <input type="hidden" name="status" value={status} />}
              <label htmlFor="filter-feature" className="text-xs font-medium text-fg-muted">
                Tính năng
              </label>
              <select
                id="filter-feature"
                name="feature"
                defaultValue={feature ?? ""}
                className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg focus:border-brand-ring"
              >
                <option value="">Tất cả tính năng</option>
                {AI_FEATURES.map((f) => (
                  <option key={f} value={f}>
                    {FEATURE_LABEL[f]}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Lọc
              </Button>
            </form>
          </div>

          {runs.rows.length === 0 ? (
            <EmptyState
              title="Chưa có lần chạy nào"
              description="Thử hỏi trợ lý ở tab Trợ lý"
              action={
                <ButtonLink variant="primary" size="sm" href="/ai?tab=tro-ly">
                  Mở tab Trợ lý
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Lịch sử các lần chạy AI, trang {runs.page}</caption>
                <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                  <tr>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Thời điểm</th>
                    {runs.seesAll && (
                      <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Người dùng</th>
                    )}
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Tính năng</th>
                    <th scope="col" className="h-10 border-b border-border px-4">Yêu cầu</th>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Kết quả</th>
                    <th scope="col" className="h-10 border-b border-border px-4">Tool</th>
                    <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Bằng chứng</th>
                    <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Token (vào/ra)</th>
                    <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Chi phí</th>
                    <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="tabular px-4 py-2.5 whitespace-nowrap">
                        <Link href={`/ai/${r.id}`} className="font-medium text-fg hover:text-brand">
                          {dateTime(r.createdAt)}
                        </Link>
                      </td>
                      {runs.seesAll && <td className="px-4 py-2.5 whitespace-nowrap text-fg">{r.user}</td>}
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                        {FEATURE_LABEL[r.feature as AiFeatureKey] ?? r.feature}
                      </td>
                      <td className="px-4 py-2.5 text-fg">
                        <Link href={`/ai/${r.id}`} className="hover:text-brand">
                          {r.input.length > 80 ? `${r.input.slice(0, 80)}…` : r.input || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.tools.length === 0 ? (
                          <span className="text-fg-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.tools.map((t, idx) => (
                              <Badge key={idx} tone={TOOL_STATUS_TONE[t.status]} >
                                {TOOL_LABEL[t.tool] ?? t.tool}: {TOOL_STATUS_LABEL[t.status]}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-fg">{num(r.evidenceCount)}</td>
                      <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg-muted">
                        {num(r.inputTokens)} / {num(r.outputTokens)}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">{usd(r.usd)}</td>
                      <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg-muted">{num(r.ms)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(() => {
            const pages = Math.max(1, Math.ceil(runs.total / runs.pageSize));
            if (pages <= 1) return null;
            return (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-fg-muted">
                <span>
                  Trang {runs.page}/{pages}
                </span>
                <div className="flex gap-2">
                  {runs.page > 1 && (
                    <ButtonLink size="sm" href={qs({ page: runs.page - 1 })}>
                      Trước
                    </ButtonLink>
                  )}
                  {runs.page < pages && (
                    <ButtonLink size="sm" href={qs({ page: runs.page + 1 })}>
                      Sau
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {tab === "duyet" && canApprove && approvals && (
        <Card>
          <SectionTitle actions={<span className="text-xs text-fg-muted">{num(approvals.length)} yêu cầu</span>}>
            Hàng chờ phê duyệt AI
          </SectionTitle>
          <nav aria-label="Lọc trạng thái phê duyệt" className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
            {APPROVAL_FILTERS.map(([k, label]) => (
              <Link
                key={k}
                href={`/ai?tab=duyet&trang-thai=${k}`}
                aria-current={approvalStatus === k ? "page" : undefined}
                className={cx(
                  "rounded-[var(--radius-sm)] px-2.5 py-1 text-sm",
                  approvalStatus === k ? "bg-brand-soft font-medium text-brand" : "text-fg-muted hover:bg-bg-subtle",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {approvals.length === 0 ? (
            <EmptyState
              title="Không có yêu cầu chờ duyệt"
              description="Các thao tác giao việc cho người khác hoặc đề xuất cập nhật nhu cầu mua sẽ hiển thị tại đây."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Danh sách yêu cầu phê duyệt AI</caption>
                <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                  <tr>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Lúc tạo</th>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Người yêu cầu</th>
                    <th scope="col" className="h-10 border-b border-border px-4">Nội dung</th>
                    <th scope="col" className="h-10 border-b border-border px-4">Lý do</th>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Trạng thái</th>
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Người duyệt</th>
                    <th scope="col" className="h-10 border-b border-border px-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">{dateTime(a.createdAt)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg">{a.requestedBy}</td>
                      <td className="px-4 py-2.5">{renderApprovalContent(a)}</td>
                      <td className="px-4 py-2.5 text-fg">
                        <div>{a.reason}</div>
                        {a.note && <div className="mt-0.5 text-xs text-fg-muted">Ghi chú: {a.note}</div>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={APPROVAL_STATUS_TONE[a.status]}>{APPROVAL_STATUS_LABEL[a.status]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg-muted">
                        {a.decidedBy ? `${a.decidedBy} · ${dateTime(a.decidedAt)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.status === "PENDING" ? (
                          a.mine ? (
                            <span className="text-xs text-fg-muted">Yêu cầu của bạn</span>
                          ) : (
                            <ApprovalButtons id={a.id} />
                          )
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "chi-phi" && canBudget && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Lượt chạy · AI-01"
              metric="AI-01"
              value={num(stats.ai01.runs)}
              hint={`Tháng ${stats.month}`}
            />
            <StatCard
              label="Token · AI-01"
              metric="AI-01"
              value={num(stats.ai01.tokens)}
              hint="Tổng token đầu vào & đầu ra"
            />
            <StatCard
              label="Chi phí tháng · AI-01"
              metric="AI-01"
              value={usd(stats.ai01.usd)}
              hint="Tính theo bảng giá cấu hình"
            />
            <StatCard
              label="Chấp nhận đề xuất · AI-02"
              metric="AI-02"
              value={`${num(stats.ai02.accepted)}/${num(stats.ai02.total)}`}
              hint={`Tỷ lệ chấp nhận ${pct(stats.ai02.accepted, stats.ai02.total)}`}
            />
            <StatCard
              label="Từ chối quyền · AI-03"
              metric="AI-03"
              value={`${num(stats.ai03.denied)}/${num(stats.ai03.total)}`}
              hint={`Tỷ lệ từ chối ${pct(stats.ai03.denied, stats.ai03.total)}`}
            />
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-fg">Ngân sách AI tháng {stats.month}</h2>
                <p className="mt-0.5 text-sm text-fg-muted">
                  Đã dùng: <span className="tabular font-medium text-fg">{usd(stats.budget.spent)}</span> /{" "}
                  <span className="tabular font-medium text-fg">
                    {stats.budget.limit != null ? usd(stats.budget.limit) : "Không giới hạn"}
                  </span>
                </p>
              </div>
              {stats.budget.limit != null && stats.budget.limit > 0 && (
                <Badge tone={stats.budget.spent / stats.budget.limit >= 0.9 ? "danger" : "brand"}>
                  {Math.round((stats.budget.spent / stats.budget.limit) * 100)}% hạn mức
                </Badge>
              )}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-muted">
              <div
                className={cx(
                  "h-full transition-all",
                  stats.budget.limit != null && stats.budget.limit > 0 && stats.budget.spent / stats.budget.limit >= 0.9
                    ? "bg-danger"
                    : "bg-brand",
                )}
                style={{
                  width: `${
                    stats.budget.limit != null && stats.budget.limit > 0
                      ? Math.min(100, (stats.budget.spent / stats.budget.limit) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <BudgetForm limit={stats.budget.limit} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <SectionTitle>Chi phí theo tính năng</SectionTitle>
              {stats.byFeature.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu tính năng" description="Chưa ghi nhận lượt chạy nào trong tháng." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">Chi phí AI theo tính năng</caption>
                    <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                      <tr>
                        <th scope="col" className="h-10 border-b border-border px-4">Tính năng</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Lượt chạy</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Token</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Chi phí</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byFeature.map((r) => (
                        <tr key={r.feature} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                          <td className="px-4 py-2.5 text-fg">{FEATURE_LABEL[r.feature as AiFeatureKey] ?? r.feature}</td>
                          <td className="tabular px-4 py-2.5 text-right text-fg">{num(r.runs)}</td>
                          <td className="tabular px-4 py-2.5 text-right text-fg-muted">
                            {num(r.inputTokens + r.outputTokens)}
                          </td>
                          <td className="tabular px-4 py-2.5 text-right text-fg">{usd(r.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle>Chi phí theo mô hình</SectionTitle>
              {stats.byModel.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu mô hình" description="Chưa ghi nhận lượt chạy nào trong tháng." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">Chi phí AI theo mô hình</caption>
                    <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                      <tr>
                        <th scope="col" className="h-10 border-b border-border px-4">Mô hình</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Lượt chạy</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Token</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Chi phí</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byModel.map((r) => (
                        <tr key={`${r.provider}-${r.model}`} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                          <td className="px-4 py-2.5 text-fg">
                            {r.provider} · {r.model}
                          </td>
                          <td className="tabular px-4 py-2.5 text-right text-fg">{num(r.runs)}</td>
                          <td className="tabular px-4 py-2.5 text-right text-fg-muted">
                            {num(r.inputTokens + r.outputTokens)}
                          </td>
                          <td className="tabular px-4 py-2.5 text-right text-fg">{usd(r.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle>Theo người dùng</SectionTitle>
              {stats.byUser.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu người dùng" description="Chưa ghi nhận lượt chạy nào trong tháng." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">Lượt chạy AI theo người dùng</caption>
                    <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                      <tr>
                        <th scope="col" className="h-10 border-b border-border px-4">Người dùng</th>
                        <th scope="col" className="h-10 border-b border-border px-4 text-right">Lượt chạy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byUser.map((r, i) => (
                        <tr key={`${r.user}-${i}`} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                          <td className="px-4 py-2.5 text-fg">{r.user}</td>
                          <td className="tabular px-4 py-2.5 text-right text-fg">{num(r.runs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <p className="text-xs text-fg-muted">
            Giá ước tính theo bảng giá cấu hình (USD / 1 triệu token); mô hình replay = 0 USD.
          </p>
        </div>
      )}
    </>
  );
}

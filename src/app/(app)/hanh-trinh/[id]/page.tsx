// Chi tiết hành trình: sơ đồ bước + kết quả từng bước, số khách theo trạng thái, lý do ra, danh sách khách (lọc + phân trang ở server).
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, SectionTitle, StatCard, cx } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { dateTime, num } from "@/lib/format";
import { getJourney, listJourneyRuns, type Step } from "@/modules/marketing/journeys";
import { CHANNEL_LABEL, JOURNEY_STATUS_LABEL, JOURNEY_STATUS_TONE, OUTCOME_LABEL, OUTCOME_TONE, RUN_STATUS_LABEL, RUN_STATUS_TONE, STEP_LABEL, TEMPLATE_KEYS } from "@/modules/marketing/labels";
import { JourneyStatusButtons } from "./status-buttons";

const RUN_FILTERS = [["", "Tất cả"], ["RUNNING", "Đang trong"], ["COMPLETED", "Hoàn tất"], ["EXITED", "Đã ra"]] as const;

function summary(s: Step): string {
  switch (s.type) {
    case "WAIT": return `Chờ ${s.days} ngày`;
    case "CONDITION": return `Còn thỏa "${s.label}" thì đi tiếp, không thì ra`;
    case "STOCK_CHECK": return "Sản phẩm khách mua gần nhất còn hàng thì đi tiếp, hết thì ra";
    case "SEND": return `${CHANNEL_LABEL[s.channel]} · mẫu "${TEMPLATE_KEYS.find((t) => t.value === s.template)?.label ?? s.template}"`;
    case "TASK": return `${s.title} · hạn ${s.dueDays} ngày`;
    case "TAG": return `Gán thẻ "${s.tag}"`;
    default: return "Kết thúc hành trình";
  }
}

export default async function JourneyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await pageUser("journey.manage");
  bindTenant(user);
  const status = RUN_FILTERS.some(([v]) => v === sp.status) ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const [j, runs] = await Promise.all([
    getJourney(user, id).catch((e) => { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }),
    listJourneyRuns(user, id, { status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(runs.total / runs.pageSize));
  const qs = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, page, ...p })) if (v && !(k === "page" && v === 1)) u.set(k, String(v));
    const s = u.toString();
    return s ? `?${s}` : `/hanh-trinh/${id}`;
  };

  return (
    <>
      <PageHeader
        title={j.name}
        crumbs={[{ label: "Marketing" }, { href: "/hanh-trinh", label: "Hành trình" }, { label: j.name }]}
        description={j.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={JOURNEY_STATUS_TONE[j.status]}>{JOURNEY_STATUS_LABEL[j.status]}</Badge>
            {j.status !== "ACTIVE" && <ButtonLink href={`/hanh-trinh/${id}/sua`}>Sửa</ButtonLink>}
            <JourneyStatusButtons id={id} status={j.status} canActivate={j.canActivate} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Phân khúc vào" value={<Link href="/phan-khuc" className="text-lg hover:text-brand">{j.segment.name}</Link>} hint={j.segment.lastCount != null ? `${num(j.segment.lastCount)} khách lần chạy gần nhất` : "Chưa chạy phân khúc"} />
        <StatCard label="Đang trong hành trình" value={num(j.stats.RUNNING ?? 0)} hint={j.activatedAt ? `Bật lúc ${dateTime(j.activatedAt)}` : "Chưa bật lần nào"} />
        <StatCard label="Hoàn tất" value={num(j.stats.COMPLETED ?? 0)} />
        <StatCard label="Đã ra giữa chừng" value={num(j.stats.EXITED ?? 0)} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Các bước</SectionTitle>
          <ol className="p-4">
            {j.steps.map((s, i) => {
              const outs = j.perStep.filter((p) => p.stepIndex === i);
              return (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < j.steps.length - 1 && <span aria-hidden className="absolute left-3 top-7 h-[calc(100%-1.5rem)] w-px bg-border" />}
                  <span className={cx("tabular relative flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", s.type === "SEND" || s.type === "TASK" ? "bg-brand text-white" : "bg-bg-muted text-fg-muted")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm"><span className="font-medium text-fg">{STEP_LABEL[s.type]}</span> <span className="text-fg-muted">— {summary(s)}</span></div>
                    {outs.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {outs.map((o) => <Badge key={o.outcome} tone={OUTCOME_TONE(o.outcome)}>{OUTCOME_LABEL[o.outcome] ?? o.outcome}: {num(o.count)}</Badge>)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Luật thoát</SectionTitle>
            <ul className="space-y-1.5 p-4 text-sm text-fg">
              {j.exitRules.purchased && <li>Khách đã mua sau khi vào hành trình</li>}
              {j.exitRules.optOut && <li>Khách từ chối nhận tin</li>}
              {j.exitRules.openTicket && <li>Khách đang có khiếu nại cần xử lý</li>}
              <li>Quá {j.exitRules.expireDays} ngày trong hành trình</li>
              <li className="text-fg-muted">Cho vào lại sau {j.reentryDays} ngày</li>
            </ul>
          </Card>
          <Card>
            <SectionTitle>Lý do ra</SectionTitle>
            {j.exitReasons.length === 0 ? (
              <p className="p-4 text-sm text-fg-muted">Chưa có khách nào ra giữa chừng.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {j.exitReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2 px-4 py-2"><span className="text-fg">{r.reason}</span><span className="tabular font-medium">{num(r.count)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle actions={<span className="text-xs text-fg-muted">{num(runs.total)} khách</span>}>Khách trong hành trình</SectionTitle>
        <nav aria-label="Lọc theo trạng thái" className="flex gap-1 border-b border-border px-4 py-2">
          {RUN_FILTERS.map(([v, label]) => (
            <Link key={v} href={qs({ status: v || undefined, page: 1 })} aria-current={(status ?? "") === v ? "page" : undefined}
              className={cx("rounded-[var(--radius-sm)] px-2.5 py-1 text-sm", (status ?? "") === v ? "bg-brand-soft font-medium text-brand" : "text-fg-muted hover:bg-bg-subtle")}>{label}</Link>
          ))}
        </nav>
        {runs.rows.length === 0 ? (
          status || page > 1 ? <EmptyState title="Không có kết quả khớp bộ lọc" description="Thử chọn trạng thái khác hoặc xóa bộ lọc để xem toàn bộ khách trong hành trình." action={<ButtonLink size="sm" href={`/hanh-trinh/${id}`}>Xóa lọc</ButtonLink>} /> : <EmptyState title="Chưa có khách" description={j.status === "ACTIVE" ? "Hệ thống tự động đưa khách trong phân khúc vào ở lượt chạy kế tiếp (mỗi phút)." : "Bật hành trình để bắt đầu đưa khách vào."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Khách trong hành trình, trang {runs.page}</caption>
              <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4">Khách</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Trạng thái</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Bước</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Kết quả gần nhất</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Vào lúc</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Bước kế / Ra lúc</th>
                </tr>
              </thead>
              <tbody>
                {runs.rows.map((r) => {
                  const last = r.logs.at(-1);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5"><Link href={`/khach-hang/${r.customer.id}`} className="font-medium text-fg hover:text-brand">{r.customer.displayName}</Link></td>
                      <td className="px-4 py-2.5"><Badge tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Badge></td>
                      <td className="tabular px-4 py-2.5 text-fg-muted">{Math.min(r.stepIndex + (r.status === "RUNNING" ? 1 : 0), j.steps.length)}/{j.steps.length}</td>
                      <td className="px-4 py-2.5">
                        {r.exitReason ? <span className="text-fg">{r.exitReason}</span> : last ? (
                          <span title={last.detail ?? undefined}><Badge tone={OUTCOME_TONE(last.outcome)}>{OUTCOME_LABEL[last.outcome] ?? last.outcome}</Badge>{last.detail && <span className="ml-1.5 text-xs text-fg-muted">{last.detail}</span>}</span>
                        ) : r.status === "RUNNING" ? (
                          <span className="text-xs text-fg-muted">{j.steps[r.stepIndex]?.type === "SEND" ? "Chờ khung giờ gửi 9–20 giờ địa phương" : "Chờ lượt chạy kế tiếp"}</span>
                        ) : <span className="text-fg-muted">—</span>}
                      </td>
                      <td className="tabular px-4 py-2.5 text-fg-muted">{dateTime(r.enteredAt)}</td>
                      <td className="tabular px-4 py-2.5 text-fg-muted">{r.status === "RUNNING" ? dateTime(r.nextAt) : dateTime(r.exitedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-fg-muted">
            <span>Trang {runs.page}/{pages}</span>
            <div className="flex gap-2">
              {runs.page > 1 && <ButtonLink size="sm" href={qs({ page: runs.page - 1 })}>Trước</ButtonLink>}
              {runs.page < pages && <ButtonLink size="sm" href={qs({ page: runs.page + 1 })}>Sau</ButtonLink>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

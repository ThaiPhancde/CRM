// Chi tiết một lần chạy AI: thông tin, chi phí token/USD, yêu cầu đã che PII/bí mật, kết quả, bằng chứng, tool đã gọi và đề xuất.
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, PageHeader, SectionTitle } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { dateTime, num } from "@/lib/format";
import { getRun } from "@/modules/ai/history";
import {
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
import { EvidenceList } from "../evidence";

const usd = (v: string | number | null | undefined) =>
  `${Number(v ?? 0).toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD`;

function shortJson(v: unknown, max = 140) {
  const s = JSON.stringify(v ?? {});
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default async function AiRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser("ai.run");
  bindTenant(user);

  const run = await getRun(user, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });

  const featureName = FEATURE_LABEL[run.feature as AiFeatureKey] ?? run.feature;
  const inTokens = run.cost?.inputTokens ?? 0;
  const outTokens = run.cost?.outputTokens ?? 0;

  return (
    <>
      <PageHeader
        title={`Lần chạy · ${featureName}`}
        crumbs={[
          { href: "/ai", label: "Trung tâm AI" },
          { href: "/ai?tab=lich-su", label: "Lịch sử" },
        ]}
        description={`Mã lần chạy: ${run.id}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Badge>
            <ButtonLink href="/ai?tab=lich-su">Quay lại lịch sử</ButtonLink>
          </div>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Thông tin</SectionTitle>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg-muted">Người dùng</dt>
              <dd className="mt-0.5 font-medium text-fg">{run.user}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Thời điểm</dt>
              <dd className="tabular mt-0.5 text-fg">{dateTime(run.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Mô hình</dt>
              <dd className="mt-0.5 text-fg">
                {run.provider} · {run.model}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Thời gian xử lý</dt>
              <dd className="tabular mt-0.5 text-fg">{num(run.ms)} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Trạng thái</dt>
              <dd className="mt-0.5">
                <Badge tone={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Badge>
              </dd>
            </div>
            {run.error && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-danger">Chi tiết lỗi</dt>
                <dd className="mt-1 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-xs text-danger">
                  {run.error}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <SectionTitle>Chi phí</SectionTitle>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-fg-muted">Token đầu vào</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{num(inTokens)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Token đầu ra</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{num(outTokens)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Chi phí ước tính</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{usd(run.cost?.usd ?? "0")}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Yêu cầu</SectionTitle>
          <pre className="whitespace-pre-wrap break-words p-4 font-sans text-sm text-fg">
            {run.input || "—"}
          </pre>
        </Card>

        <Card>
          <SectionTitle>Kết quả</SectionTitle>
          <pre className="overflow-x-auto p-4 font-mono text-xs text-fg">
            {JSON.stringify(run.output ?? null, null, 2)}
          </pre>
        </Card>
      </div>

      <Card className="mb-6">
        <SectionTitle>Bằng chứng</SectionTitle>
        <div className="p-4">
          <EvidenceList items={run.evidence} />
        </div>
      </Card>

      <Card className="mb-6">
        <SectionTitle>Công cụ đã gọi</SectionTitle>
        {run.toolCalls.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">Không gọi công cụ nào trong lần chạy này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách công cụ đã gọi trong lần chạy</caption>
              <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Công cụ</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Trạng thái</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Tham số</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {run.toolCalls.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap text-fg">
                      {TOOL_LABEL[t.tool] ?? t.tool}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge tone={TOOL_STATUS_TONE[t.status]}>{TOOL_STATUS_LABEL[t.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-fg">{shortJson(t.args)}</td>
                    <td className="px-4 py-2.5 text-xs text-danger">{t.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Đề xuất</SectionTitle>
        {run.suggestions.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">Không có đề xuất nào trong lần chạy này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách đề xuất từ lần chạy</caption>
              <thead className="bg-bg-subtle text-left text-xs font-medium text-fg-muted">
                <tr>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Loại đề xuất</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Trạng thái</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Lý do</th>
                  <th scope="col" className="h-10 border-b border-border px-4">Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {run.suggestions.map((s) => {
                  const statusTone =
                    APPROVAL_STATUS_TONE[s.status as keyof typeof APPROVAL_STATUS_TONE] ??
                    (s.status === "ACCEPTED" ? "success" : "neutral");
                  const statusLabel =
                    APPROVAL_STATUS_LABEL[s.status as keyof typeof APPROVAL_STATUS_LABEL] ??
                    (s.status === "ACCEPTED" ? "Đã chấp nhận" : s.status);
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap text-fg">{s.kind}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-fg">{s.reason}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-fg">{shortJson(s.payload, 200)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

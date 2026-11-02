// Trang chi tiết chiến dịch tiếp thị — thống kê MKT-01/MKT-02, hành trình/phân khúc liên kết và bảng điểm chạm gần nhất.
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { base, date, dateTime, money, num } from "@/lib/format";
import {
  campaignOptions,
  getCampaign,
  type CampaignDetail,
} from "@/modules/marketing/campaigns";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_TONE,
  JOURNEY_STATUS_LABEL,
  JOURNEY_STATUS_TONE,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
} from "@/modules/marketing/labels";
import { CampaignForm } from "../campaign-form";
import { StatusButtons } from "./status-buttons";
import { TouchpointForm } from "./touchpoint-form";

const channelLabel = (ch: string) =>
  CAMPAIGN_CHANNELS.find((x) => x.value === ch)?.label ?? ch;

const RUN_KEYS = Object.keys(RUN_STATUS_LABEL) as (keyof typeof RUN_STATUS_LABEL)[];

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser("campaign.manage");
  bindTenant(user);
  const { id } = await params;

  let campaign: CampaignDetail;
  try {
    campaign = await getCampaign(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const options = await campaignOptions(user);

  return (
    <>
      <PageHeader
        title={campaign.name}
        crumbs={[
          { label: "Marketing" },
          { href: "/chien-dich", label: "Chiến dịch" },
          { label: campaign.name },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Kênh: {channelLabel(campaign.channel)}</span>
            {campaign.brand && <span>· Brand: {campaign.brand}</span>}
            {campaign.utmCampaign && <span>· UTM: {campaign.utmCampaign}</span>}
            {(campaign.startAt || campaign.endAt) && (
              <span className="tabular">
                · {date(campaign.startAt)} – {date(campaign.endAt)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>
              {CAMPAIGN_STATUS_LABEL[campaign.status]}
            </Badge>
            <StatusButtons id={campaign.id} status={campaign.status} />
            <CampaignForm options={options} initial={campaign} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Điểm chạm"
          value={num(campaign.touchpoints)}
          metric="MKT-01"
          hint="Tổng lượt tiếp cận ghi nhận"
        />
        <StatCard
          label="Lead"
          value={num(campaign.leads)}
          metric="MKT-01"
          hint="Nhu cầu mua từ chiến dịch"
        />
        <StatCard
          label="Chi phí"
          value={base(campaign.costBase)}
          hint={
            campaign.cost && campaign.costCurrency
              ? money(campaign.cost, campaign.costCurrency)
              : "—"
          }
        />
        <StatCard
          label="Chi phí/lead"
          value={base(campaign.costPerLead)}
          metric="MKT-02"
          hint="Quy đổi VND theo tỷ giá hiệu lực"
        />
      </div>

      {campaign.segment && (
        <p className="mb-4 text-sm text-fg-muted">
          Phân khúc:{" "}
          <Link href="/phan-khuc" className="font-medium text-brand-active hover:underline">
            {campaign.segment.name}
          </Link>
        </p>
      )}

      {campaign.journey && (
        <Card className="mb-4">
          <SectionTitle
            actions={
              <Badge tone={JOURNEY_STATUS_TONE[campaign.journey.status]}>
                {JOURNEY_STATUS_LABEL[campaign.journey.status]}
              </Badge>
            }
          >
            Hành trình
          </SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm">
            <Link
              href={`/hanh-trinh/${campaign.journey.id}`}
              className="font-medium text-brand-active hover:underline"
            >
              {campaign.journey.name}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {RUN_KEYS.map((st) => (
                <span key={st} className="inline-flex items-center gap-1.5 text-xs">
                  <Badge tone={RUN_STATUS_TONE[st]}>{RUN_STATUS_LABEL[st]}</Badge>
                  <span className="tabular font-semibold text-fg">
                    {num(campaign.journeyStats[st] ?? 0)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle actions={<TouchpointForm campaignId={campaign.id} />}>
          Điểm chạm ({num(campaign.touchpointRows.length)})
        </SectionTitle>
        {campaign.touchpointRows.length === 0 ? (
          <EmptyState
            title="Chưa có điểm chạm"
            description="Ghi điểm chạm khi khách đến từ chiến dịch này"
            action={<TouchpointForm campaignId={campaign.id} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách điểm chạm của chiến dịch</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Thời điểm</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Nguồn / Kênh</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Nội dung UTM</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Khách / Nhu cầu mua</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {campaign.touchpointRows.map((t) => (
                  <tr key={t.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                      {dateTime(t.occurredAt)}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                      {t.medium ? `${t.source} / ${t.medium}` : t.source}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                      {t.utmContent ?? <span className="text-fg-subtle">—</span>}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        {t.customer && (
                          <Link
                            href={`/khach-hang/${t.customer.id}`}
                            className="font-medium text-fg hover:text-brand-active"
                          >
                            {t.customer.displayName}
                          </Link>
                        )}
                        {t.lead && (
                          <Link
                            href={`/nhu-cau/${t.lead.id}`}
                            className="font-medium text-fg hover:text-brand-active"
                          >
                            {t.lead.contactName}
                          </Link>
                        )}
                        {!t.customer && !t.lead && (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </div>
                    </td>

                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                      {t.cost && t.costCurrency ? money(t.cost, t.costCurrency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

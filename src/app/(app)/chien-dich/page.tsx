// Trang danh sách chiến dịch tiếp thị — kiểm quyền campaign.manage ở server, thống kê MKT-01 và MKT-02.
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { base, date, money, num } from "@/lib/format";
import { campaignOptions, listCampaigns } from "@/modules/marketing/campaigns";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_TONE,
  JOURNEY_STATUS_LABEL,
  JOURNEY_STATUS_TONE,
} from "@/modules/marketing/labels";
import { CampaignForm } from "./campaign-form";

const channelLabel = (ch: string) =>
  CAMPAIGN_CHANNELS.find((x) => x.value === ch)?.label ?? ch;

export default async function CampaignsPage() {
  const user = await pageUser("campaign.manage");
  bindTenant(user);

  const [rows, options] = await Promise.all([
    listCampaigns(user),
    campaignOptions(user),
  ]);

  return (
    <>
      <PageHeader
        title="Chiến dịch"
        crumbs={[{ label: "Marketing" }, { label: "Chiến dịch" }]}
        description="Gom phân khúc, hành trình và nguồn tiếp cận (UTM). Chi phí nhập tay, quy đổi về VND theo tỷ giá hiệu lực."
        actions={<CampaignForm options={options} />}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Chưa có chiến dịch"
            description="Tạo chiến dịch để gom phân khúc, hành trình và mã UTM"
            action={<CampaignForm options={options} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách chiến dịch</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Tên</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Trạng thái</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Kênh · Thương hiệu</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Phân khúc</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Hành trình</th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">Thời gian</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Chi phí</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Điểm chạm · MKT-01</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Nhu cầu mua · MKT-01</th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">Chi phí / nhu cầu mua · MKT-02</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/chien-dich/${c.id}`}
                        className="font-medium text-fg hover:text-brand-active"
                      >
                        {c.name}
                      </Link>
                      {c.utmCampaign && (
                        <p className="text-xs text-fg-subtle">{c.utmCampaign}</p>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge tone={CAMPAIGN_STATUS_TONE[c.status]}>
                        {CAMPAIGN_STATUS_LABEL[c.status]}
                      </Badge>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                      {channelLabel(c.channel)}
                      {c.brand && <p className="text-xs text-fg-subtle">{c.brand}</p>}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {c.segment ? (
                        <Link
                          href="/phan-khuc"
                          className="text-fg hover:text-brand-active"
                        >
                          {c.segment.name}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {c.journey ? (
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/hanh-trinh/${c.journey.id}`}
                            className="text-fg hover:text-brand-active"
                          >
                            {c.journey.name}
                          </Link>
                          <Badge tone={JOURNEY_STATUS_TONE[c.journey.status]}>
                            {JOURNEY_STATUS_LABEL[c.journey.status]}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>

                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                      {c.startAt || c.endAt ? `${date(c.startAt)} – ${date(c.endAt)}` : "—"}
                    </td>

                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                      {c.cost && c.costCurrency ? (
                        <div>
                          <div className="text-fg">{money(c.cost, c.costCurrency)}</div>
                          <div className="text-xs text-fg-muted">{base(c.costBase)}</div>
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>

                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                      {num(c.touchpoints)}
                    </td>

                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                      {num(c.leads)}
                    </td>

                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                      {base(c.costPerLead)}
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

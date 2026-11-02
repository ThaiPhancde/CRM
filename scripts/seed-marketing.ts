// Dữ liệu demo Phase 7: giới hạn liên hệ mặc định, phân khúc "Gần chu kỳ mua lại", hành trình mua lại (HLD §8.5, Quản lý bật),
// chiến dịch có chi phí quy VND + điểm chạm từ nhu cầu mua có sẵn; chạy một lượt job để có số liệu (tin chỉ ghi Outbox giả lập).
// Chạy riêng: npx tsx --env-file=.env scripts/seed-marketing.ts   (seed-demo gọi sẵn). Chạy lại được: trùng tên/khóa thì bỏ qua.
import { Prisma } from "@prisma/client";
import { rootDb, workspaceDb } from "../src/lib/db";
import { DEFAULT_CAP, journeyJobs, type Step } from "../src/modules/marketing/journeys";
import { CHANNELS } from "../src/modules/marketing/labels";
import { runSegmentFor } from "../src/modules/marketing/segments";

const SEGMENT = { name: "Gần chu kỳ mua lại", description: "Hạng RFM tốt, còn ≤ 7 ngày tới chu kỳ mua trung bình", rules: { op: "and", rules: [{ field: "rfm", cmp: "in", value: ["CHAMPIONS", "TRUNG_THANH", "CAN_CHAM_SOC"] }, { field: "daysToNextPurchase", cmp: "lte", value: 7 }] } };
const STEPS: Step[] = [
  { type: "SEND", channel: "EMAIL", template: "repurchase_reminder" },
  { type: "WAIT", days: 3 },
  { type: "STOCK_CHECK" },
  { type: "SEND", channel: "EMAIL", template: "repurchase_offer" },
  { type: "TASK", title: "Gọi chăm sóc khách sắp tới chu kỳ mua lại", dueDays: 1 },
];

export async function seedMarketing(now = new Date()) {
  const out = { caps: 0, segments: 0, journeys: 0, campaigns: 0, touchpoints: 0, enrolled: 0, processed: 0 };
  for (const w of await rootDb.workspace.findMany({ where: { active: true } })) {
    const c = workspaceDb(w.id);
    for (const channel of CHANNELS) {
      if (await c.contactCap.findFirst({ where: { channel, brandId: null } })) continue;
      await c.contactCap.create({ data: { channel, maxCount: DEFAULT_CAP.maxCount, windowDays: DEFAULT_CAP.windowDays } as never });
      out.caps++;
    }
    const mgr = (await c.membership.findFirst({ where: { roles: { has: "MANAGER" } }, select: { userId: true } }))?.userId ?? null;
    const mkt = (await c.membership.findFirst({ where: { roles: { has: "MARKETING" } }, select: { userId: true } }))?.userId ?? mgr;
    const brand = await c.brand.findFirst({ where: { active: true }, orderBy: { code: "asc" } });

    let seg = await c.segment.findFirst({ where: { name: SEGMENT.name } });
    if (!seg) { seg = await c.segment.create({ data: { ...SEGMENT, createdById: mkt } as never }); out.segments++; }
    await runSegmentFor(c, seg.id, mkt, now);

    let journey = await c.journey.findFirst({ where: { name: "Nhắc mua lại theo chu kỳ" } });
    if (!journey) {
      journey = await c.journey.create({
        data: { name: "Nhắc mua lại theo chu kỳ", description: "Nhắc → chờ 3 ngày → kiểm tồn → ưu đãi → giao sales gọi (HLD §8.5)", segmentId: seg.id, brandId: brand?.id ?? null, steps: STEPS as Prisma.InputJsonValue,
          exitRules: { purchased: true, optOut: true, openTicket: true, expireDays: 30 }, reentryDays: 30, status: "ACTIVE", createdById: mkt, activatedById: mgr, activatedAt: now } as never,
      });
      out.journeys++;
    }

    const name = `Mua lại tháng ${now.getMonth() + 1}`;
    let camp = await c.campaign.findFirst({ where: { name } });
    if (!camp) {
      const market = await c.market.findFirst({ orderBy: { code: "asc" } });
      const cur = market?.currency ?? "VND";
      const fx = await c.fxRate.findFirst({ where: { currency: cur, validFrom: { lte: now } }, orderBy: { validFrom: "desc" } });
      const cost = cur === "VND" ? "5000000" : "200";
      camp = await c.campaign.create({
        data: { name, channel: "EMAIL", status: "RUNNING", brandId: brand?.id ?? null, segmentId: seg.id, journeyId: journey.id, utmCampaign: `rebuy-${now.getMonth() + 1}`,
          startAt: new Date(now.getTime() - 7 * 86400000), cost, costCurrency: cur, costBase: fx ? new Prisma.Decimal(cost).mul(fx.rateToBase).toDecimalPlaces(4) : null, createdById: mkt } as never,
      });
      out.campaigns++;
    }
    const leads = await c.lead.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, customerId: true, source: true, createdAt: true } });
    const r = await c.touchpoint.createMany({
      data: leads.map((l) => ({ campaignId: camp.id, leadId: l.id, customerId: l.customerId, source: l.source, medium: "email", utmSource: l.source, utmMedium: "email", utmCampaign: camp.utmCampaign, occurredAt: l.createdAt, idempotencyKey: `demo-tp:${l.id}` })) as never,
      skipDuplicates: true,
    });
    out.touchpoints += r.count;
    const jr = await journeyJobs(c, now);
    out.enrolled += jr.enrolled;
    out.processed += jr.processed;
  }
  return out;
}

if (process.argv[1]?.endsWith("seed-marketing.ts")) seedMarketing().then((r) => { console.log("marketing:", r); return rootDb.$disconnect(); });

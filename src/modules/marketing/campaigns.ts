// Chiến dịch + điểm chạm (Phase 7): nguồn tiếp cận (UTM), chi phí nhập tay quy VND (D-44), thống kê MKT-01/MKT-02 (docs/metrics.md).
import { Prisma, type CampaignStatus } from "@prisma/client";
import { z } from "zod";
import { bindTenant, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { requirePerm, type SessionUser } from "@/lib/session";

const optId = z.string().trim().optional().transform((v) => v || undefined);
const optDate = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "Ngày không hợp lệ" }); return z.NEVER; }
  return d;
});
const money = z.string().trim().optional().transform((v) => v || undefined).refine((v) => !v || /^\d+(\.\d{1,4})?$/.test(v), "Số tiền không hợp lệ");
const currency = z.string().trim().toUpperCase().optional().transform((v) => v || undefined).refine((v) => !v || /^[A-Z]{3}$/.test(v), "Mã tiền tệ 3 chữ");

/** Quy VND theo tỷ giá hiệu lực tại `at` (D-44). Thiếu tỷ giá → lỗi rõ, không đoán. */
async function toBase(amount: string, cur: string, at: Date) {
  const fx = await db.fxRate.findFirst({ where: { currency: cur, validFrom: { lte: at } }, orderBy: { validFrom: "desc" } });
  if (!fx) throw new ValidationError({ costCurrency: `Thiếu tỷ giá ${cur} — thêm ở Danh mục → Tỷ giá` });
  return new Prisma.Decimal(amount).mul(fx.rateToBase).toDecimalPlaces(4);
}

export const campaignSchema = z.object({
  id: optId,
  name: z.string().trim().min(2, "Nhập tên chiến dịch").max(120),
  brandId: optId,
  segmentId: optId,
  journeyId: optId,
  channel: z.string().trim().min(1, "Chọn kênh").max(30),
  utmCampaign: z.string().trim().max(80).optional().transform((v) => v || undefined).refine((v) => !v || /^[a-z0-9_-]+$/.test(v), "Chỉ chữ thường, số, - và _"),
  startAt: optDate,
  endAt: optDate,
  cost: money,
  costCurrency: currency,
});

export async function saveCampaign(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "campaign.manage");
  const d = parse(campaignSchema, input);
  if (d.startAt && d.endAt && d.endAt < d.startAt) throw new ValidationError({ endAt: "Ngày kết thúc trước ngày bắt đầu" });
  if (d.cost && !d.costCurrency) throw new ValidationError({ costCurrency: "Nhập tiền tệ của chi phí" });
  const [brand, segment, journey] = await Promise.all([
    d.brandId ? db.brand.findFirst({ where: { id: d.brandId } }) : null,
    d.segmentId ? db.segment.findFirst({ where: { id: d.segmentId } }) : null,
    d.journeyId ? db.journey.findFirst({ where: { id: d.journeyId } }) : null,
  ]);
  if (d.brandId && !brand) throw new ValidationError({ brandId: "Brand không thuộc team này" });
  if (d.segmentId && !segment) throw new ValidationError({ segmentId: "Phân khúc không thuộc team này" });
  if (d.journeyId && !journey) throw new ValidationError({ journeyId: "Hành trình không thuộc team này" });
  const costBase = d.cost && d.costCurrency ? await toBase(d.cost, d.costCurrency, d.startAt ?? now) : null;
  const data = { name: d.name, brandId: d.brandId ?? null, segmentId: d.segmentId ?? null, journeyId: d.journeyId ?? null, channel: d.channel, utmCampaign: d.utmCampaign ?? null, startAt: d.startAt ?? null, endAt: d.endAt ?? null, cost: d.cost ?? null, costCurrency: d.costCurrency ?? null, costBase };
  try {
    return await db.$transaction(async (tx) => {
      const before = d.id ? await tx.campaign.findFirst({ where: { id: d.id } }) : null;
      if (d.id && !before) throw new HttpError(404, "Không tìm thấy chiến dịch");
      const c = before ? await tx.campaign.update({ where: { id: before.id }, data }) : await tx.campaign.create({ data: { ...data, createdById: user.id } as never });
      await audit(tx, { actorId: user.id, entity: "Campaign", entityId: c.id, action: before ? "update" : "create", before: before ?? undefined, after: c });
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError({ utmCampaign: "Mã UTM đã dùng cho chiến dịch khác" });
    throw e;
  }
}

export async function setCampaignStatus(user: SessionUser, id: string, status: CampaignStatus) {
  requirePerm(user, "campaign.manage");
  const c = await db.campaign.findFirst({ where: { id } });
  if (!c) throw new HttpError(404, "Không tìm thấy chiến dịch");
  return db.$transaction(async (tx) => {
    const after = await tx.campaign.update({ where: { id }, data: { status } });
    await audit(tx, { actorId: user.id, entity: "Campaign", entityId: id, action: "status", before: { status: c.status }, after: { status } });
    return after;
  });
}

/** Danh sách + MKT-01 (điểm chạm/lead theo chiến dịch) và MKT-02 (chi phí/lead, VND). */
export async function listCampaigns(user: SessionUser) {
  requirePerm(user, "campaign.manage");
  const [rows, tp, leads] = await Promise.all([
    db.campaign.findMany({ orderBy: { updatedAt: "desc" }, include: { brand: { select: { code: true } }, segment: { select: { id: true, name: true } }, journey: { select: { id: true, name: true, status: true } } } }),
    db.touchpoint.groupBy({ by: ["campaignId"], _count: { _all: true } }),
    db.touchpoint.groupBy({ by: ["campaignId"], where: { leadId: { not: null } }, _count: { _all: true } }),
  ]);
  const n = (arr: typeof tp, id: string) => arr.find((x) => x.campaignId === id)?._count._all ?? 0;
  return rows.map((c) => {
    const l = n(leads, c.id);
    return {
      id: c.id, name: c.name, status: c.status, channel: c.channel, utmCampaign: c.utmCampaign, brand: c.brand?.code ?? null, segment: c.segment, journey: c.journey,
      startAt: c.startAt?.toISOString() ?? null, endAt: c.endAt?.toISOString() ?? null,
      cost: c.cost?.toString() ?? null, costCurrency: c.costCurrency, costBase: c.costBase?.toString() ?? null,
      touchpoints: n(tp, c.id), leads: l, costPerLead: c.costBase && l ? c.costBase.div(l).toDecimalPlaces(0).toString() : null,
    };
  });
}
export type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

export async function getCampaign(user: SessionUser, id: string) {
  requirePerm(user, "campaign.manage");
  bindTenant(user);
  const c = (await listCampaigns(user)).find((x) => x.id === id);
  if (!c) throw new HttpError(404, "Không tìm thấy chiến dịch");
  const [raw, recent, journeyStats] = await Promise.all([
    db.campaign.findFirstOrThrow({ where: { id }, select: { brandId: true, segmentId: true, journeyId: true } }),
    db.touchpoint.findMany({ where: { campaignId: id }, orderBy: { occurredAt: "desc" }, take: 50, include: { customer: { select: { id: true, displayName: true } }, lead: { select: { id: true, contactName: true } } } }),
    c.journey ? db.journeyRun.groupBy({ by: ["status"], where: { journeyId: c.journey.id }, _count: { _all: true } }) : [],
  ]);
  return {
    ...c, ...raw,
    journeyStats: Object.fromEntries(journeyStats.map((s) => [s.status, s._count._all])) as Record<string, number>,
    touchpointRows: recent.map((t) => ({ id: t.id, source: t.source, medium: t.medium, utmContent: t.utmContent, customer: t.customer, lead: t.lead, cost: t.cost?.toString() ?? null, costCurrency: t.costCurrency, occurredAt: t.occurredAt.toISOString() })),
  };
}
export type CampaignDetail = Awaited<ReturnType<typeof getCampaign>>;

/** Lựa chọn cho form chiến dịch (cùng quyền campaign.manage — không cần catalog.view). */
export async function campaignOptions(user: SessionUser) {
  requirePerm(user, "campaign.manage");
  const [brands, segments, journeys] = await Promise.all([
    db.brand.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    db.segment.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, lastCount: true } }),
    db.journey.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
  ]);
  return { brands, segments, journeys };
}

export const touchpointSchema = z.object({
  campaignId: optId,
  customerId: optId,
  customerPhone: z.string().trim().max(30).optional().transform((v) => v || undefined),
  leadId: optId,
  source: z.string().trim().min(1, "Nhập nguồn").max(60),
  medium: z.string().trim().max(60).optional().transform((v) => v || undefined),
  utmContent: z.string().trim().max(120).optional().transform((v) => v || undefined),
  cost: money,
  costCurrency: currency,
  occurredAt: optDate,
  idempotencyKey: z.string().trim().max(120).optional().transform((v) => v || undefined),
});

/** Ghi điểm chạm (nhập tay hoặc từ nguồn). Gửi lại cùng khóa → không nhân đôi. UTM chiến dịch lấy từ chiến dịch. */
export async function addTouchpoint(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "campaign.manage");
  const d = parse(touchpointSchema, input);
  if (!d.customerId && d.customerPhone) {
    const e164 = normalizePhone(d.customerPhone, "VN")?.e164;
    const byPhone = e164 ? await db.customer.findFirst({ where: { primaryPhoneE164: e164, mergedIntoId: null }, select: { id: true } }) : null;
    if (!byPhone) throw new ValidationError({ customerPhone: "Không tìm thấy khách với SĐT này" });
    d.customerId = byPhone.id;
  }
  if (!d.customerId && !d.leadId) throw new ValidationError({ customerId: "Gắn với một khách hoặc một nhu cầu mua" });
  if (d.cost && !d.costCurrency) throw new ValidationError({ costCurrency: "Nhập tiền tệ của chi phí" });
  const [camp, cust, lead] = await Promise.all([
    d.campaignId ? db.campaign.findFirst({ where: { id: d.campaignId } }) : null,
    d.customerId ? db.customer.findFirst({ where: { id: d.customerId, mergedIntoId: null } }) : null,
    d.leadId ? db.lead.findFirst({ where: { id: d.leadId } }) : null,
  ]);
  if (d.campaignId && !camp) throw new ValidationError({ campaignId: "Chiến dịch không thuộc team này" });
  if (d.customerId && !cust) throw new ValidationError({ customerId: "Không tìm thấy khách" });
  if (d.leadId && !lead) throw new ValidationError({ leadId: "Không tìm thấy nhu cầu mua" });
  try {
    return await db.touchpoint.create({
      data: {
        campaignId: camp?.id, customerId: cust?.id ?? lead?.customerId ?? undefined, leadId: lead?.id, source: d.source, medium: d.medium,
        utmSource: d.source, utmMedium: d.medium, utmCampaign: camp?.utmCampaign ?? undefined, utmContent: d.utmContent,
        cost: d.cost, costCurrency: d.costCurrency, occurredAt: d.occurredAt ?? now, idempotencyKey: d.idempotencyKey,
      } as Prisma.TouchpointUncheckedCreateInput,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && d.idempotencyKey) return db.touchpoint.findFirstOrThrow({ where: { idempotencyKey: d.idempotencyKey } });
    throw e;
  }
}

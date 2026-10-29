// Phân công lead tự động (Q-22 mặc định, D-46): chọn nhóm theo brand + market (Setting "leadRouting"),
// trong nhóm chọn Sales đang ít lead mở nhất, hòa thì người lâu chưa được giao nhất (vòng tròn), bỏ qua người đã đủ tải.
// Không ai nhận được → lead nằm ở hàng chờ của nhóm, báo Trưởng nhóm/Quản lý.
import { z } from "zod";
import type { Db } from "@/lib/db";
import { notify } from "@/lib/notify";

export const OPEN_STAGES = ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH"] as const;

const routingSchema = z.object({
  /** Quy tắc khớp theo thứ tự cụ thể nhất (brand + market > một trong hai > không điều kiện). Mã viết hoa. */
  rules: z.array(z.object({ brand: z.string().optional(), market: z.string().optional(), team: z.string() })).default([]),
  maxOpenPerUser: z.number().int().positive().default(30),
  firstResponseHours: z.number().positive().default(4),
});
export type Routing = z.infer<typeof routingSchema>;

export async function loadRouting(client: Db): Promise<Routing> {
  const row = await client.setting.findFirst({ where: { key: "leadRouting" } });
  return routingSchema.parse(row?.value ?? {});
}

type LeadLite = { id: string; contactName: string; brandId: string | null; marketId: string | null; teamId: string | null; ownerId: string | null; createdAt: Date; firstResponseDueAt: Date | null };

/** Nhóm cho lead: giữ nhóm đã có; không thì theo quy tắc. */
async function routeTeam(client: Db, r: Routing, lead: LeadLite): Promise<string | null> {
  if (lead.teamId) return lead.teamId;
  const [brand, market] = await Promise.all([
    lead.brandId ? client.brand.findFirst({ where: { id: lead.brandId }, select: { code: true } }) : null,
    lead.marketId ? client.market.findFirst({ where: { id: lead.marketId }, select: { code: true } }) : null,
  ]);
  const fits = r.rules.filter((x) => (!x.brand || x.brand === brand?.code) && (!x.market || x.market === market?.code));
  const best = fits.sort((a, b) => Number(!!b.brand) + Number(!!b.market) - (Number(!!a.brand) + Number(!!a.market)))[0];
  if (!best) return null;
  return (await client.team.findFirst({ where: { code: best.team, active: true }, select: { id: true } }))?.id ?? null;
}

/**
 * Giao lead chưa có người. Trả id người nhận hoặc null. Gọi trong transaction của người tạo lead hoặc từ worker.
 * ponytail: hai lead giao cùng lúc có thể cùng chọn một người (đếm tải không khóa); tải lệch tối đa vài lead, chấp nhận ở quy mô demo.
 */
export async function autoAssign(client: Db, leadId: string, now = new Date()): Promise<string | null> {
  const lead = await client.lead.findFirst({ where: { id: leadId, ownerId: null, stage: { in: [...OPEN_STAGES] } } });
  if (!lead) return null;
  const r = await loadRouting(client);
  const teamId = await routeTeam(client, r, lead);
  const due = lead.firstResponseDueAt ?? new Date(lead.createdAt.getTime() + r.firstResponseHours * 3600000);
  if (!teamId) {
    await client.lead.update({ where: { id: lead.id }, data: { firstResponseDueAt: due } });
    await alertLeads(client, lead, null, "chưa có quy tắc phân nhóm khớp brand/market");
    return null;
  }
  const members = await client.membership.findMany({ where: { teamId, active: true, roles: { has: "SALES" }, user: { active: true } }, select: { userId: true } });
  const ids = members.map((m) => m.userId);
  const [open, last] = await Promise.all([
    client.lead.groupBy({ by: ["ownerId"], where: { ownerId: { in: ids }, stage: { in: [...OPEN_STAGES] } }, _count: { _all: true } }),
    client.assignment.groupBy({ by: ["toUserId"], where: { toUserId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  const load = new Map(open.map((o) => [o.ownerId, o._count._all]));
  const lastAt = new Map(last.map((l) => [l.toUserId, l._max.createdAt?.getTime() ?? 0]));
  const pick = ids
    .filter((id) => (load.get(id) ?? 0) < r.maxOpenPerUser)
    .sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || (lastAt.get(a) ?? 0) - (lastAt.get(b) ?? 0) || a.localeCompare(b))[0];

  await client.lead.update({ where: { id: lead.id }, data: { teamId, ownerId: pick ?? null, firstResponseDueAt: due } });
  if (!pick) {
    await alertLeads(client, lead, teamId, ids.length ? `mọi Sales trong nhóm đã đủ ${r.maxOpenPerUser} lead mở` : "nhóm chưa có Sales");
    return null;
  }
  await client.assignment.create({ data: { leadId: lead.id, toUserId: pick, teamId, reason: "Tự động: ít lead mở nhất trong nhóm" } as never });
  await client.activity.create({ data: { type: "SYSTEM", leadId: lead.id, customerId: lead.customerId, body: "Tự động giao phụ trách", occurredAt: now } as never });
  await notify(client, { userId: pick, title: `Lead mới: ${lead.contactName}`, body: `Phản hồi trước ${due.toISOString()}`, link: `/nhu-cau/${lead.id}`, key: `lead-assigned:${lead.id}:${pick}` });
  return pick;
}

/** Báo Trưởng nhóm (của nhóm) hoặc Quản lý (khi chưa có nhóm) rằng lead chưa giao được. */
async function alertLeads(client: Db, lead: LeadLite, teamId: string | null, why: string) {
  const to = await client.membership.findMany({
    where: teamId ? { teamId, active: true, roles: { has: "SALES_LEAD" } } : { active: true, roles: { has: "MANAGER" } },
    select: { userId: true },
  });
  for (const m of to)
    await notify(client, { userId: m.userId, title: `Lead chưa giao được: ${lead.contactName}`, body: why, link: `/nhu-cau/${lead.id}`, key: `lead-unassigned:${lead.id}:${m.userId}` });
}

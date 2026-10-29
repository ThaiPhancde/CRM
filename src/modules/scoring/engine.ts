// Chạy chấm điểm theo lô (D-48): dựng CustomerMetric qua Warehouse rồi chấm RFM / rủi ro giao dịch / nhu cầu hỗ trợ cho mọi khách
// theo khúc 5.000; lead mở chấm lại khi có tương tác mới hơn điểm. Lưu theo phiên bản đang dùng — điểm phiên bản cũ giữ nguyên.
import type { Prisma, ScoreType } from "@prisma/client";
import { getWarehouse } from "@/adapters/warehouse";
import type { Db } from "@/lib/db";
import { OPEN_STAGES } from "@/modules/sales/routing";
import { DEFAULT_WEIGHTS, scoreLead, scoreRfm, scoreSupport, scoreTxnRisk, type ScoreResult, type Weights } from "./formulas";

export const SCORE_TYPES: ScoreType[] = ["SALES_PRIORITY", "RFM", "TXN_RISK", "SUPPORT_NEED"];

/** Phiên bản đang dùng của từng loại; chưa có thì tạo v1 với trọng số mặc định. */
export async function activeVersions(client: Db) {
  const out = {} as Record<ScoreType, { id: string; version: number; weights: Weights }>;
  for (const type of SCORE_TYPES) {
    let v = await client.scoreVersion.findFirst({ where: { type, active: true }, orderBy: { version: "desc" } });
    if (!v) {
      try {
        v = await client.scoreVersion.create({ data: { type, version: 1, weights: DEFAULT_WEIGHTS[type], note: "Giả thuyết v1 (D-33, HLD §7.2)" } as never });
      } catch {
        v = await client.scoreVersion.findFirstOrThrow({ where: { type, active: true }, orderBy: { version: "desc" } }); // tạo đồng thời
      }
    }
    out[type] = { id: v.id, version: v.version, weights: v.weights as Weights };
  }
  return out;
}

const row = (type: ScoreType, versionId: string, subject: { customerId?: string; leadId?: string }, r: ScoreResult, now: Date) => ({
  type, versionId, ...subject, value: r.value, band: r.band, reasons: r.reasons as unknown as Prisma.InputJsonValue, missingData: r.missingData, suggestedAction: r.suggestedAction, computedAt: now,
});

/** Dựng chỉ số R12M rồi chấm điểm mọi khách của team. Dùng cho job hằng ngày và nút "Tính lại ngay". */
export async function refreshAndScoreCustomers(client: Db, workspaceId: string, now = new Date(), chunk = 5000) {
  const t = Date.now();
  const metrics = await getWarehouse().refreshCustomerMetrics(workspaceId, now);
  const v = await activeVersions(client);
  let cursor: string | undefined;
  let scored = 0;
  // Đọc tuần tự theo con trỏ, ghi song song tối đa 4 khúc (ghi 600k dòng điểm tuần tự mất ~100 s với 200k khách — docs/performance.md).
  const pending: Promise<void>[] = [];
  for (;;) {
    const ms = await client.customerMetric.findMany({ where: { period: "R12M" }, orderBy: { id: "asc" }, take: chunk, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
    if (!ms.length) break;
    cursor = ms.at(-1)!.id;
    pending.push(scoreChunk(ms));
    if (pending.length >= 4) await Promise.all(pending.splice(0));
    scored += ms.length;
  }
  await Promise.all(pending);
  return { customers: metrics.customers, scored, ms: Date.now() - t };

  async function scoreChunk(ms: Awaited<ReturnType<typeof client.customerMetric.findMany>>) {
    const ids = ms.map((m) => m.customerId);
    const custs = new Map((await client.customer.findMany({ where: { id: { in: ids } }, select: { id: true, primaryPhoneE164: true, primaryEmail: true, _count: { select: { addresses: true } } } })).map((c) => [c.id, c]));
    const rows = ms.flatMap((m) => {
      const c = custs.get(m.customerId);
      return [
        row("RFM", v.RFM.id, { customerId: m.customerId }, scoreRfm({ r: m.rScore, f: m.fScore, m: m.mScore, recencyDays: m.recencyDays, deliveredOrders: m.deliveredOrders, rev03: m.rev03.toFixed(0) }), now),
        row("TXN_RISK", v.TXN_RISK.id, { customerId: m.customerId }, scoreTxnRisk({ confirmedOrders: m.confirmedOrders, failedByCustomer: m.failedByCustomer, hasPhone: !!c?.primaryPhoneE164, hasEmail: !!c?.primaryEmail, hasAddress: (c?._count.addresses ?? 0) > 0 }, v.TXN_RISK.weights), now),
        row("SUPPORT_NEED", v.SUPPORT_NEED.id, { customerId: m.customerId }, scoreSupport({ openTickets: m.openTickets, maxOpenPriority: m.maxOpenPriority, oldestOpenAt: m.oldestOpenTicketAt }, v.SUPPORT_NEED.weights, now), now),
      ];
    });
    await client.score.deleteMany({ where: { versionId: { in: [v.RFM.id, v.TXN_RISK.id, v.SUPPORT_NEED.id] }, customerId: { in: ids } } });
    await client.score.createMany({ data: rows as never });
  }
}

/** Chấm lại lead mở chưa có điểm của phiên bản hiện tại hoặc có tương tác mới hơn điểm. */
export async function scoreOpenLeads(client: Db, now = new Date(), limit = 2000) {
  const v = (await activeVersions(client)).SALES_PRIORITY;
  const open = await client.lead.findMany({ where: { stage: { in: [...OPEN_STAGES] } }, select: { id: true, lastActivityAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 20_000 });
  const have = new Map((await client.score.findMany({ where: { versionId: v.id, leadId: { in: open.map((l) => l.id) } }, select: { leadId: true, computedAt: true } })).map((s) => [s.leadId!, s.computedAt]));
  const due = open.filter((l) => { const at = have.get(l.id); return !at || at < (l.lastActivityAt ?? l.updatedAt) || at < l.updatedAt; }).slice(0, limit).map((l) => l.id);
  for (let i = 0; i < due.length; i += 500) {
    const ids = due.slice(i, i + 500);
    const [leads, msgs] = await Promise.all([
      client.lead.findMany({ where: { id: { in: ids } }, select: { id: true, interest: true, budgetAmount: true, brandId: true, marketId: true, stage: true, nextActionAt: true } }),
      client.activity.findMany({ where: { leadId: { in: ids }, direction: "IN" }, select: { leadId: true, body: true, occurredAt: true }, orderBy: { occurredAt: "desc" }, take: ids.length * 20 }),
    ]);
    const byLead = new Map<string, { text: string; at: Date }[]>();
    for (const m of msgs) byLead.set(m.leadId!, [...(byLead.get(m.leadId!) ?? []), { text: m.body, at: m.occurredAt }]);
    const rows = leads.map((l) => row("SALES_PRIORITY", v.id, { leadId: l.id }, scoreLead({ interest: l.interest, hasBudget: l.budgetAmount != null, hasBrandMarket: !!(l.brandId && l.marketId), stage: l.stage as "MOI", inbound: byLead.get(l.id) ?? [], hasNextAction: !!l.nextActionAt && l.nextActionAt > now }, v.weights, now), now));
    await client.score.deleteMany({ where: { versionId: v.id, leadId: { in: ids } } });
    await client.score.createMany({ data: rows as never });
  }
  return { leads: due.length };
}

/** Job worker: chỉ số + điểm khách mỗi ngày một lần (hoặc khi có phiên bản mới chưa chấm); lead mỗi lượt. */
export async function scoringJobs(client: Db, workspaceId: string, now = new Date()) {
  const fresh = await getWarehouse().freshness(workspaceId);
  const v = await activeVersions(client);
  const newVersionUnscored = !(await client.score.findFirst({ where: { versionId: v.RFM.id }, select: { id: true } })) || !(await client.score.findFirst({ where: { versionId: v.TXN_RISK.id }, select: { id: true } })) || !(await client.score.findFirst({ where: { versionId: v.SUPPORT_NEED.id }, select: { id: true } }));
  const customers = !fresh || now.getTime() - fresh.getTime() > 20 * 3600000 || newVersionUnscored ? await refreshAndScoreCustomers(client, workspaceId, now) : null;
  const leads = await scoreOpenLeads(client, now);
  return { customers, leads };
}

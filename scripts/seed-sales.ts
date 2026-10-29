// Dữ liệu demo Phase 4: kịch bản tư vấn + 60 nhu cầu mua kèm hội thoại 4 ngôn ngữ (fixtures/leads.json, scripts.json — Gemini soạn, hư cấu).
// Lead đi qua ĐÚNG phân công tự động (autoAssign); hội thoại ghi thành Activity; giai đoạn đặt sau cùng như người dùng thao tác.
// Chạy riêng: npx tsx --env-file=.env scripts/seed-sales.ts   (seed-demo gọi sẵn). Chạy lại được: khóa `demo-lead:<key>` không tạo trùng.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LeadStage } from "@prisma/client";
import { rootDb, workspaceDb } from "../src/lib/db";
import { normalizePhone } from "../src/lib/phone";
import { autoAssign } from "../src/modules/sales/routing";

type Msg = { dir: "IN" | "OUT"; channel: string; minutesAfter: number; text: string };
type DemoLead = {
  key: string; workspace: string; brand: string; market: string; contactName: string; phone: string; email: string | null;
  language: string; source: string; interest: string; budget: { amount: string; currency: string } | null;
  stage: LeadStage; lostReason: string | null; daysAgo: number; messages: Msg[];
};
type DemoScript = { brand: string | null; market: string | null; stage: LeadStage | null; language: string; title: string; body: string };

const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", f), "utf8")) as T;

export async function seedSales(now = new Date()) {
  const leads = read<DemoLead[]>("leads.json");
  const scripts = read<DemoScript[]>("scripts.json");
  let created = 0;
  for (const w of await rootDb.workspace.findMany({ where: { active: true } })) {
    const c = workspaceDb(w.id);
    const brands = new Map((await c.brand.findMany()).map((b) => [b.code, b.id]));
    const markets = new Map((await c.market.findMany()).map((m) => [m.code, m.id]));

    if (!(await c.script.count())) {
      for (const s of scripts) {
        if ((s.brand && !brands.has(s.brand)) || (s.market && !markets.has(s.market))) continue;
        await c.script.create({ data: { brandId: s.brand ? brands.get(s.brand) : null, marketId: s.market ? markets.get(s.market) : null, stage: s.stage, language: s.language, title: s.title, body: s.body } as never });
      }
    }

    const mine = leads.filter((l) => l.workspace === w.code).sort((a, b) => b.daysAgo - a.daysAgo);
    let i = 0;
    for (const d of mine) {
      i++;
      const key = `demo-lead:${d.key}`;
      if (await c.lead.findFirst({ where: { idempotencyKey: key }, select: { id: true } })) continue;
      const at = new Date(now.getTime() - d.daysAgo * 86400000 - (i % 7) * 3600000);
      const phone = normalizePhone(d.phone, d.market)?.e164 ?? null;
      // Dữ liệu demo: lead đã tiến xa gắn một khách có sẵn cùng thị trường (tất định theo thứ tự) để vai Sales thấy khách/đơn của mình.
      const marketId = markets.get(d.market) ?? null;
      const linkTo = ["DA_MUA", "CHO_QUYET_DINH"].includes(d.stage) && marketId
        ? await c.customer.findFirst({ where: { marketId, mergedIntoId: null, orderCount: { gt: 0 } }, orderBy: { id: "asc" }, skip: i, select: { id: true } })
        : null;
      const lead = await c.lead.create({
        data: {
          contactName: d.contactName, contactPhoneE164: phone, contactEmail: d.email, language: d.language, source: d.source,
          brandId: brands.get(d.brand), marketId, interest: d.interest, budgetAmount: d.budget?.amount, budgetCurrency: d.budget?.currency,
          customerId: linkTo?.id ?? null, idempotencyKey: key, createdAt: at,
        } as never,
      });
      created++;
      const owner = await autoAssign(c, lead.id, at);
      let firstOut: Date | null = null;
      for (const [n, m] of d.messages.entries()) {
        const when = new Date(at.getTime() + m.minutesAfter * 60000);
        if (m.dir === "OUT" && !firstOut) firstOut = when;
        await c.activity.create({
          data: { type: m.channel === "PHONE" ? "CALL" : "MESSAGE", direction: m.dir, channel: m.channel, leadId: lead.id, customerId: lead.customerId, actorId: m.dir === "OUT" ? owner : null, body: m.text, language: d.language, occurredAt: when, idempotencyKey: `${key}:m${n}` } as never,
        });
      }
      const closed = ["DA_MUA", "TU_CHOI", "MAT_LIEN_LAC"].includes(d.stage);
      const lastAt = new Date(at.getTime() + (d.messages.at(-1)?.minutesAfter ?? 0) * 60000);
      await c.lead.update({
        where: { id: lead.id },
        data: {
          stage: d.stage, lostReason: d.lostReason, firstRespondedAt: firstOut, closedAt: closed ? lastAt : null, lastActivityAt: lastAt,
          nextActionAt: d.stage === "CHO_QUYET_DINH" || d.stage === "DANG_TU_VAN" ? new Date(now.getTime() + ((i % 5) - 1) * 86400000) : null,
        },
      });
      if (d.stage !== "MOI") await c.activity.create({ data: { type: "SYSTEM", leadId: lead.id, customerId: lead.customerId, body: `Giai đoạn hiện tại: ${d.stage}`, occurredAt: lastAt } as never });
      // Lead chờ quyết định có việc theo dõi cho người phụ trách (một số đã quá hạn để hàng đợi có việc gấp).
      if (owner && d.stage === "CHO_QUYET_DINH") {
        await c.task.create({ data: { type: "FOLLOW_UP", title: `Theo dõi quyết định: ${d.contactName}`, dueAt: new Date(now.getTime() + ((i % 4) - 1) * 6 * 3600000), assigneeId: owner, leadId: lead.id, customerId: lead.customerId, idempotencyKey: `${key}:task` } as never });
      }
    }
  }
  const [total, open, unassigned, tasks] = await Promise.all([
    rootDb.lead.count(), rootDb.lead.count({ where: { stage: { in: ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH"] } } }),
    rootDb.lead.count({ where: { ownerId: null, stage: { in: ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH"] } } }), rootDb.task.count(),
  ]);
  return { created, total, open, unassigned, tasks, scripts: await rootDb.script.count() };
}

if (process.argv[1]?.endsWith("seed-sales.ts")) {
  seedSales().then((r) => console.log("seed-sales:", r)).finally(() => rootDb.$disconnect());
}

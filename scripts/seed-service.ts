// Dữ liệu demo Phase 5: bài tri thức (có bản sửa chờ xuất bản) + 30 ticket kèm hội thoại (fixtures/knowledge.json, tickets.json — Gemini soạn, hư cấu).
// Hạn SLA tính bằng đúng slaFor/dueDates của service; ticket gắn khách cùng thị trường (giao hàng/đổi trả gắn thêm đơn của khách).
// Chạy riêng: npx tsx --env-file=.env scripts/seed-service.ts   (seed-demo gọi sẵn). Chạy lại được: khóa `demo-ticket:<key>`, bài trùng tiêu đề bỏ qua.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { rootDb, workspaceDb } from "../src/lib/db";
import { dueDates, slaFor, VIP_MIN_DELIVERED } from "../src/modules/service/tickets";

type Kb = { workspace: string; brand: string | null; market: string | null; language: string; title: string; tags: string[]; body: string; publish: boolean; revision: { title: string; body: string } | null };
type Tk = { key: string; workspace: string; brand: string; market: string; type: TicketType; priority: TicketPriority; status: TicketStatus; subject: string; language: string; hoursAgo: number; messages: { kind: "CUSTOMER" | "REPLY" | "NOTE"; minutesAfter: number; text: string }[] };
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", f), "utf8")) as T;

export async function seedService(now = new Date()) {
  const kb = read<Kb[]>("knowledge.json");
  const tickets = read<Tk[]>("tickets.json");
  let articles = 0;
  let created = 0;
  for (const w of await rootDb.workspace.findMany({ where: { active: true } })) {
    const c = workspaceDb(w.id);
    const brands = new Map((await c.brand.findMany()).map((b) => [b.code, b.id]));
    const markets = new Map((await c.market.findMany()).map((m) => [m.code, m.id]));
    const author = (await c.membership.findFirst({ where: { roles: { hasSome: ["MANAGER", "MARKETING"] } }, select: { userId: true } }))?.userId ?? null;

    for (const a of kb.filter((x) => x.workspace === w.code)) {
      if (await c.knowledgeArticle.findFirst({ where: { title: a.title } })) continue;
      const art = await c.knowledgeArticle.create({ data: { title: a.title, language: a.language, brandId: a.brand ? brands.get(a.brand) : null, marketId: a.market ? markets.get(a.market) : null, tags: a.tags, createdById: author, status: a.publish ? "PUBLISHED" : "DRAFT", publishedVersion: a.publish ? 1 : null, latestVersion: a.revision ? 2 : 1 } as never });
      await c.knowledgeVersion.create({ data: { articleId: art.id, version: 1, title: a.title, body: a.body, createdById: author } as never });
      if (a.revision) await c.knowledgeVersion.create({ data: { articleId: art.id, version: 2, title: a.revision.title, body: a.revision.body, createdById: author } as never });
      articles++;
    }

    const owners = (await c.membership.findMany({ where: { active: true, roles: { hasSome: ["SALES", "FULFILLMENT"] } }, select: { userId: true, teamId: true, roles: true } }));
    let n = (await c.ticket.count()) + 1;
    for (const [i, t] of tickets.filter((x) => x.workspace === w.code).entries()) {
      const key = `demo-ticket:${t.key}`;
      if (await c.ticket.findFirst({ where: { idempotencyKey: key }, select: { id: true } })) continue;
      const createdAt = new Date(now.getTime() - t.hoursAgo * 3600000);
      const marketId = markets.get(t.market) ?? null;
      const brandId = brands.get(t.brand) ?? null;
      const customer = marketId ? await c.customer.findFirst({ where: { marketId, mergedIntoId: null, orderCount: { gt: 0 } }, orderBy: { lastOrderAt: "desc" }, skip: i * 3, select: { id: true, deliveredOrders: true } }) : null;
      const order = customer && (t.type === "GIAO_CHAM" || t.type === "DOI_TRA" || t.type === "LOI_HANG") ? await c.order.findFirst({ where: { customerId: customer.id }, orderBy: { bookedAt: "desc" }, select: { id: true } }) : null;
      // Ticket giao hàng/đổi trả cho Vận đơn, còn lại cho Sales; xoay vòng; 1/6 để chưa giao (hàng chờ của nhóm).
      const pool = owners.filter((o) => (t.type === "GIAO_CHAM" || t.type === "DOI_TRA" ? o.roles.includes("FULFILLMENT") : o.roles.includes("SALES")));
      const owner = i % 6 === 5 || !pool.length ? null : pool[i % pool.length];
      const due = dueDates(createdAt, await slaFor(c, brandId, t.priority));
      const replies = t.messages.filter((m) => m.kind === "REPLY");
      const at = (m: { minutesAfter: number }) => new Date(createdAt.getTime() + m.minutesAfter * 60000);
      const resolved = t.status === "DA_GIAI_QUYET" || t.status === "DONG";
      const last = t.messages.at(-1) ? at(t.messages.at(-1)!) : createdAt;
      const ticket = await c.ticket.create({
        data: {
          code: `TK-${String(n++).padStart(6, "0")}`, type: t.type, priority: t.priority, status: t.status, subject: t.subject,
          customerId: customer?.id, orderId: order?.id, brandId, ownerId: owner?.userId ?? null, teamId: owner?.teamId ?? (pool[0]?.teamId ?? null),
          vip: (customer?.deliveredOrders ?? 0) >= VIP_MIN_DELIVERED, ...due, firstRespondedAt: replies[0] ? at(replies[0]) : null,
          resolvedAt: resolved ? last : null, closedAt: t.status === "DONG" ? last : null, idempotencyKey: key, createdAt,
          // Ticket mẫu đã quá hạn từ trước: coi như đã báo, worker không dồn thông báo cũ khi khởi động.
          breachNotifiedAt: due.resolveDueAt < now ? now : null, dueSoonNotifiedAt: due.resolveDueAt < new Date(now.getTime() + 3600000) ? now : null,
        } as never,
      });
      for (const [j, m] of t.messages.entries()) {
        await c.ticketEvent.create({ data: { ticketId: ticket.id, type: j === 0 ? "CREATED" : m.kind === "CUSTOMER" ? "CUSTOMER" : m.kind, body: m.text, actorId: m.kind === "CUSTOMER" ? null : owner?.userId ?? author, createdAt: at(m), idempotencyKey: `${key}:e${j}` } as never });
      }
      if (t.status !== "MOI") await c.ticketEvent.create({ data: { ticketId: ticket.id, type: "STATUS", actorId: owner?.userId ?? author, meta: { from: "MOI", to: t.status }, createdAt: last } as never });
      if (owner) await c.task.create({ data: { type: "FOLLOW_UP", title: `Xử lý ticket ${ticket.code}: ${t.subject}`.slice(0, 200), dueAt: due.firstResponseDueAt, status: resolved ? "DONE" : "OPEN", completedAt: resolved ? last : null, assigneeId: owner.userId, ticketId: ticket.id, customerId: customer?.id, orderId: order?.id, remindedAt: due.firstResponseDueAt < now ? now : null, idempotencyKey: `ticket-task:${ticket.id}` } as never });
      created++;
    }
  }
  const [total, open, published] = await Promise.all([rootDb.ticket.count(), rootDb.ticket.count({ where: { status: { in: ["MOI", "DANG_XU_LY", "CHO_KHACH"] } } }), rootDb.knowledgeArticle.count({ where: { status: "PUBLISHED" } })]);
  return { articles, ticketsCreated: created, tickets: total, open, published };
}

if (process.argv[1]?.endsWith("seed-service.ts")) {
  seedService().then((r) => console.log("seed-service:", r)).finally(() => rootDb.$disconnect());
}

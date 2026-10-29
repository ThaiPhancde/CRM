import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb, runInWorkspace, workspaceDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { loadUser } from "@/lib/session";
import { myQueue } from "@/modules/sales/queue";
import { getArticle, listArticles, parseKbFilter, saveArticle, setArticleStatus } from "@/modules/service/knowledge";
import { assignTicket, createTicket, DEFAULT_SLA, getTicket, listTickets, parseTicketFilter, remindTicketSla, replyTicket, setTicketPriority, setTicketStatus } from "@/modules/service/tickets";

const T0 = new Date("2026-10-20T03:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3600000);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const team = await c.team.create({ data: { code: "A", name: "Nhóm A" } as never });
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  const brand2 = await c.brand.create({ data: { code: "NOVA", name: "Nova" } as never });
  const market = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES_LEAD" | "SALES" | "FULFILLMENT" | "MARKETING")[], teamId?: string) =>
    (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles, teamId })).id, ws.id))!;
  const mgr = await u("mgr", ["MANAGER"]);
  const lead = await u("lead", ["SALES_LEAD"], team.id);
  const s1 = await u("s1", ["SALES"], team.id);
  const s2 = await u("s2", ["SALES"], team.id);
  const ful = await u("ful", ["FULFILLMENT"]);
  const mkt = await u("mkt", ["MARKETING"]);
  const vipCustomer = await c.customer.create({ data: { displayName: "Khách VIP", primaryEmail: "vip@example.invalid", deliveredOrders: 4 } as never });
  const plain = await c.customer.create({ data: { displayName: "Khách thường", primaryPhoneE164: "+971501112233", deliveredOrders: 1 } as never });
  const order = await c.order.create({ data: { storeId: store.id, orderNumber: "#1", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "IN_TRANSIT", currency: "AED", grossAmount: "1", discount: "0", shippingFee: "0", netAmount: "1", fxRate: "1", fxDate: T0, netBase: "1", bookedAt: T0, customerId: plain.id } as never });
  const as = <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn);
  // Khiếu nại do Quản lý tạo rồi giao người phụ trách (Sales chỉ tạo được cho khách trong phạm vi của mình — D-45).
  const ticket = (owner: typeof mgr, extra: Record<string, string> = {}, at = T0) =>
    as(() => createTicket(mgr, { type: "LOI_HANG", priority: "TRUNG", subject: "Hàng bị vỡ", body: "Khách báo bình vỡ khi nhận", customerId: plain.id, ownerId: owner.id, ...extra }, at));
  return { ws, c, team, brand, brand2, market, store, mgr, lead, s1, s2, ful, mkt, vipCustomer, plain, order, as, ticket };
}

describe("Phase 5 — ticket và SLA", () => {
  it("hạn SLA theo mức (mặc định) và theo chính sách brand; đổi mức tính lại hạn từ lúc tạo", async () => {
    const s = await setup("sla");
    const a = await s.ticket(s.s1, { priority: "KHAN" });
    const ta = await s.c.ticket.findUniqueOrThrow({ where: { id: a.id } });
    expect([ta.firstResponseDueAt.getTime() - T0.getTime(), ta.resolveDueAt.getTime() - T0.getTime()]).toEqual([0.5 * 3600000, 2 * 3600000]);
    expect(ta.code).toMatch(/^TK-\d{6}$/);
    await s.c.slaPolicy.create({ data: { brandId: s.brand.id, priority: "TRUNG", firstResponseHours: 1, resolveHours: 6 } as never });
    const b = await s.ticket(s.s1, { orderId: s.order.id, customerId: "" });
    const tb = await s.c.ticket.findUniqueOrThrow({ where: { id: b.id } });
    expect([tb.brandId, tb.customerId, tb.resolveDueAt.getTime() - T0.getTime()]).toEqual([s.brand.id, s.plain.id, 6 * 3600000]);
    await s.as(() => setTicketPriority(s.s1, { id: a.id, priority: "THAP" }, h(1)));
    expect((await s.c.ticket.findUniqueOrThrow({ where: { id: a.id } })).resolveDueAt.getTime() - T0.getTime()).toBe(DEFAULT_SLA.THAP.resolveHours * 3600000);
  });

  it("tạo ticket: bấm hai lần chỉ một bản; khách giá trị cao gắn cờ; tạo việc cho người phụ trách", async () => {
    const s = await setup("create");
    const key = `tk-${RUN}`;
    const [x, y] = await Promise.all([s.ticket(s.s1, { idempotencyKey: key }), s.ticket(s.s1, { idempotencyKey: key })]);
    expect(x.id).toBe(y.id);
    expect(await s.c.ticket.count()).toBe(1);
    // Sales tạo ticket cho khách ngoài phạm vi bị từ chối; khách có ticket giao cho Sales thì vào phạm vi (tạo được tiếp).
    await expect(s.as(() => createTicket(s.s2, { type: "KHAC", priority: "THAP", subject: "Hỏi", body: "x", customerId: s.plain.id }))).rejects.toBeInstanceOf(ValidationError);
    await s.as(() => createTicket(s.s1, { type: "KHAC", priority: "THAP", subject: "Hỏi thêm", body: "x", customerId: s.plain.id }));
    const v = await s.ticket(s.s1, { customerId: s.vipCustomer.id });
    expect((await s.c.ticket.findUniqueOrThrow({ where: { id: v.id } })).vip).toBe(true);
    const task = await s.c.task.findFirstOrThrow({ where: { ticketId: x.id } });
    expect([task.assigneeId, task.status]).toEqual([s.s1.id, "OPEN"]);
  });

  it("phạm vi: Sales thấy của mình, Vận đơn thấy ticket giao hàng, Marketing không có quyền, team khác không thấy", async () => {
    const s = await setup("scope");
    const mine = await s.ticket(s.s1);
    const other = await s.ticket(s.s2);
    const ship = await s.ticket(s.mgr, { type: "GIAO_CHAM" });
    const ids = async (u: typeof s.s1) => (await s.as(() => listTickets(u, parseTicketFilter({})))).rows.map((r) => r.id).sort();
    expect(await ids(s.s1)).toEqual([mine.id]);
    expect(await ids(s.ful)).toEqual([ship.id]);
    expect((await ids(s.lead)).length).toBe(3);
    await expect(s.as(() => getTicket(s.s1, other.id))).rejects.toMatchObject({ status: 404 });
    await expect(s.as(() => listTickets(s.mkt, parseTicketFilter({})))).rejects.toMatchObject({ status: 403 });
    const out = (await loadUser((await makeUser(`scope-o-${RUN}`, { workspaceId: (await makeWorkspace("scope-o")).id, roles: ["MANAGER"] })).id))!;
    expect((await runInWorkspace(out.workspaceId, () => listTickets(out, parseTicketFilter({})))).total).toBe(0);
  });

  it("trả lời khách: ghi phản hồi đầu, Mới → Đang xử lý, Outbox SIMULATED, gửi lặp không nhân đôi; ghi chú không tính phản hồi", async () => {
    const s = await setup("reply");
    const t = await s.ticket(s.s1);
    await s.as(() => replyTicket(s.s1, { id: t.id, kind: "NOTE", body: "Đã liên hệ kho" }, h(1)));
    expect((await s.c.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstRespondedAt).toBeNull();
    const msg = { id: t.id, kind: "REPLY", body: "Chúng tôi sẽ đổi hàng mới", idempotencyKey: `r-${RUN}` };
    await s.as(() => replyTicket(s.s1, msg, h(2)));
    await s.as(() => replyTicket(s.s1, msg, h(2)));
    const after = await s.c.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect([after.status, after.firstRespondedAt?.toISOString()]).toEqual(["DANG_XU_LY", h(2).toISOString()]);
    const out = await s.c.outbox.findMany();
    expect(out.map((o) => [o.channel, o.status, o.recipient])).toEqual([["SMS", "SIMULATED", "+971501112233"]]);
    expect(await s.c.ticketEvent.count({ where: { ticketId: t.id, type: "REPLY" } })).toBe(1);
    const noContact = await s.ticket(s.s1, { customerId: "" });
    await expect(s.as(() => replyTicket(s.s1, { id: noContact.id, kind: "REPLY", body: "x" }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("đã giải quyết: ghi mốc + hoàn thành việc; mở lại xóa mốc; chuyển phụ trách cần quyền và chuyển cả việc", async () => {
    const s = await setup("status");
    const t = await s.ticket(s.s1);
    await expect(s.as(() => assignTicket(s.s1, { id: t.id, toUserId: s.s2.id, reason: "Nghỉ phép" }))).rejects.toMatchObject({ status: 403 });
    await s.as(() => assignTicket(s.lead, { id: t.id, toUserId: s.s2.id, reason: "Nghỉ phép" }));
    expect((await s.c.task.findFirstOrThrow({ where: { ticketId: t.id } })).assigneeId).toBe(s.s2.id);
    await s.as(() => setTicketStatus(s.s2, { id: t.id, status: "DA_GIAI_QUYET" }, h(3)));
    const done = await s.c.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(done.resolvedAt?.toISOString()).toBe(h(3).toISOString());
    expect((await s.c.task.findFirstOrThrow({ where: { ticketId: t.id } })).status).toBe("DONE");
    await s.as(() => setTicketStatus(s.s2, { id: t.id, status: "DANG_XU_LY" }, h(4)));
    expect((await s.c.ticket.findUniqueOrThrow({ where: { id: t.id } })).resolvedAt).toBeNull();
    expect(await rootDb.auditLog.count({ where: { workspaceId: s.ws.id, entityId: t.id } })).toBeGreaterThanOrEqual(4);
  });

  it("SLA: nhắc sắp quá hạn và quá hạn mỗi thứ một lần (người phụ trách + Trưởng nhóm); hàng đợi xếp quá hạn và khách VIP trước", async () => {
    const s = await setup("remind");
    const late = await s.ticket(s.s1, { priority: "KHAN" }, T0); // hạn xử lý T0+2h
    const vip = await s.ticket(s.s1, { priority: "THAP", customerId: s.vipCustomer.id }, T0);
    const plain = await s.ticket(s.s1, { priority: "THAP" }, T0);
    expect(await remindTicketSla(s.c, h(1.5))).toEqual({ dueSoon: 1, breached: 0 });
    expect(await remindTicketSla(s.c, h(3))).toEqual({ dueSoon: 0, breached: 1 });
    expect(await remindTicketSla(s.c, h(4))).toEqual({ dueSoon: 0, breached: 0 });
    expect(await s.c.notification.count({ where: { title: { startsWith: "Quá hạn xử lý" } } })).toBe(2);
    const q = await s.as(() => myQueue(s.s1, h(3)));
    const tickets = q.items.filter((i) => i.kind === "ticket").map((i) => i.id);
    expect(tickets).toEqual([late.id, vip.id, plain.id]);
  });
});

describe("Phase 5 — tri thức có phiên bản", () => {
  it("nháp không hiện cho người đọc; xuất bản hiện; bản sửa mới không thay bản đang xuất bản tới khi xuất bản lại; lưu trữ ẩn", async () => {
    const s = await setup("kb");
    const a = await s.as(() => saveArticle(s.mkt, { title: "Chính sách đổi trả UAE", body: "Đổi trong 7 ngày, giữ hóa đơn.", language: "vi", brandId: s.brand.id, marketId: s.market.id, tags: "đổi trả, COD" }));
    await expect(s.as(() => saveArticle(s.s1, { title: "x", body: "xxxxxxxxxx", language: "vi" }))).rejects.toMatchObject({ status: 403 });
    expect((await s.as(() => listArticles(s.s1, parseKbFilter({})))).total).toBe(0);
    await s.as(() => setArticleStatus(s.mkt, { id: a.id, status: "PUBLISHED" }));
    await s.as(() => saveArticle(s.mkt, { id: a.id, title: "Chính sách đổi trả UAE (mới)", body: "Đổi trong 14 ngày.", language: "vi", brandId: s.brand.id, marketId: s.market.id }));
    const reader = await s.as(() => getArticle(s.s1, a.id));
    expect([reader.title, reader.version.version, reader.version.body]).toEqual(["Chính sách đổi trả UAE", 1, "Đổi trong 7 ngày, giữ hóa đơn."]);
    expect(reader.versions).toEqual([]);
    const ed = await s.as(() => getArticle(s.mkt, a.id));
    expect([ed.version.version, ed.versions.length]).toEqual([2, 2]);
    expect((await s.as(() => listArticles(s.mkt, parseKbFilter({})))).rows[0].hasDraft).toBe(true);
    await s.as(() => setArticleStatus(s.mkt, { id: a.id, status: "PUBLISHED" }));
    expect((await s.as(() => getArticle(s.s1, a.id))).version.body).toBe("Đổi trong 14 ngày.");
    await s.as(() => setArticleStatus(s.mkt, { id: a.id, status: "ARCHIVED" }));
    await expect(s.as(() => getArticle(s.s1, a.id))).rejects.toMatchObject({ status: 404 });
  });

  it("lọc theo brand/market (bài chung áp mọi nơi) và ngôn ngữ; ticket gợi ý bài cùng brand/market", async () => {
    const s = await setup("kbf");
    const pub = async (title: string, extra: Record<string, string>) => {
      const a = await s.as(() => saveArticle(s.mgr, { title, body: "Nội dung đủ dài cho bài.", language: "en", ...extra }));
      await s.as(() => setArticleStatus(s.mgr, { id: a.id, status: "PUBLISHED" }));
      return a.id;
    };
    const general = await pub("General COD policy", {});
    const lumi = await pub("Lumi warranty", { brandId: s.brand.id });
    await pub("Nova warranty", { brandId: s.brand2.id });
    await pub("Arabic greeting", { language: "ar" });
    const lumiList = (await s.as(() => listArticles(s.s1, parseKbFilter({ brand: s.brand.id, language: "en" })))).rows.map((r) => r.id).sort();
    expect(lumiList).toEqual([general, lumi].sort());
    const t = await s.ticket(s.s1, { orderId: s.order.id, customerId: "" });
    const d = await s.as(() => getTicket(s.s1, t.id));
    expect(d.articles.map((x) => x.id)).toContain(lumi);
    expect(d.articles.map((x) => x.title)).not.toContain("Nova warranty");
  });
});

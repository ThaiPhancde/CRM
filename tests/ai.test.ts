import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb, runInWorkspace, workspaceDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { decideApproval, setBudget } from "@/modules/ai/core";
import { assistant, draftReply, naturalSearch, summarize360, summarizeConversation } from "@/modules/ai/features";
import { createTicket } from "@/modules/service/tickets";

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86400000);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const team = await c.team.create({ data: { code: "A", name: "Nhóm A" } as never });
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi Home" } as never });
  const ae = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES_LEAD" | "SALES" | "PURCHASING_VIEW")[], teamId?: string) =>
    (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles, teamId })).id, ws.id))!;
  const mgr = await u("mgr", ["MANAGER"]);
  const lead = await u("lead", ["SALES_LEAD"], team.id);
  const s1 = await u("s1", ["SALES"], team.id);
  const s2 = await u("s2", ["SALES"], team.id);
  const buyer = await u("buy", ["PURCHASING_VIEW"]);
  const cust = (name: string, extra: Record<string, unknown> = {}) => c.customer.create({ data: { displayName: name, marketId: ae.id, locale: "en", ...extra } as never });
  const order = (customerId: string, no: string, fs: string, days: number) =>
    c.order.create({ data: { storeId: store.id, marketId: ae.id, orderNumber: no, status: "CONFIRMED", paymentStatus: "COD_PENDING", fulfillmentStatus: fs, currency: "AED", grossAmount: "100", discount: "0", shippingFee: "0", netAmount: "100", fxRate: "7000", fxDate: daysAgo(days), netBase: "700000", bookedAt: daysAgo(days), customerId } as never });
  const as = <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn);
  return { ws, c, team, brand, ae, store, mgr, lead, s1, s2, buyer, cust, order, as };
}

describe("Phase 8 — Trung tâm AI", () => {
  it("tóm tắt 360 có bằng chứng từng câu; mọi lần chạy ghi chi phí; khách workspace khác → không có", async () => {
    const a = await setup("ai1");
    const b = await setup("ai1b");
    const sara = await a.cust(`Sara ${RUN}`);
    const o = await a.order(sara.id, `L-${RUN}-1`, "FAILED", 5);
    await a.order(sara.id, `L-${RUN}-2`, "DELIVERED", 40);
    const r = await a.as(() => summarize360(a.mgr, sara.id));
    const sentences = (r.output as { sentences: { text: string; evidence: { id: string; href?: string }[] }[] }).sentences;
    expect(sentences.length).toBeGreaterThan(1);
    expect(sentences.flatMap((s) => s.evidence.map((e) => e.id))).toContain(`order:${o.id}`);
    expect(sentences.every((s) => s.evidence.length > 0)).toBe(true);
    const run = await rootDb.agentRun.findUniqueOrThrow({ where: { id: r.runId }, include: { cost: true, toolCalls: true } });
    expect([run.status, run.cost?.model, run.cost!.inputTokens > 0, run.toolCalls.map((t) => t.tool)]).toEqual(["OK", "replay", true, ["tom_tat_360"]]);

    // Người team B hỏi khách của team A: không thấy (404 qua service), lần chạy vẫn được ghi.
    const cross = await b.as(() => summarize360(b.mgr, sara.id));
    expect(cross).toMatchObject({ status: "ERROR", output: { message: "Không tìm thấy khách" } });
    const other = await b.as(() => assistant(b.mgr, { text: `Tìm khách "Sara ${RUN}"` }));
    expect(other.output).toMatchObject({ kind: "customers", candidates: [] });
    expect(await rootDb.agentRun.count({ where: { workspaceId: b.ws.id, cost: { isNot: null } } })).toBe(2);
  });

  it("tên mơ hồ → hỏi lại, không tạo việc; chọn đúng khách → tạo lịch hẹn; tool thiếu quyền bị từ chối ở server", async () => {
    const s = await setup("ai2");
    const o1 = await s.cust(`Omar ${RUN} Haddad`);
    await s.cust(`Omar ${RUN} Karim`);
    const ask = await s.as(() => assistant(s.mgr, { text: `Tạo lịch hẹn với khách Omar ${RUN} lúc 10h ngày mai` }));
    expect(ask.status).toBe("NEEDS_CLARIFICATION");
    expect((ask.output as { candidates: unknown[] }).candidates).toHaveLength(2);
    expect(await s.c.task.count()).toBe(0);
    const done = await s.as(() => assistant(s.mgr, { text: `Tạo lịch hẹn với khách Omar ${RUN} lúc 10h ngày mai`, customerId: o1.id }));
    const task = await s.c.task.findFirstOrThrow();
    expect([done.status, task.type, task.customerId, task.dueAt.getUTCHours()]).toEqual(["OK", "MEETING", o1.id, 3]); // 10:00 giờ VN = 03:00 UTC

    // Sales không có report.sales → tool hoi_bao_cao DENIED; người không có ai.run → 403.
    const no = await s.as(() => assistant(s.s1, { text: "Doanh thu giao thành công theo thị trường" }));
    expect(no).toMatchObject({ status: "DENIED", output: { message: expect.stringContaining("không có quyền") } });
    const denied = await rootDb.toolCall.findFirstOrThrow({ where: { workspaceId: s.ws.id, tool: "hoi_bao_cao" }, include: { run: true } });
    expect([denied.status, denied.run.status]).toEqual(["DENIED", "DENIED"]);
    await expect(s.as(() => assistant(s.buyer, { text: "doanh thu" }))).rejects.toMatchObject({ status: 403 });
    const rep = await s.as(() => assistant(s.mgr, { text: "Doanh thu giao thành công theo thị trường" }));
    expect(rep.output).toMatchObject({ kind: "report", source: expect.stringContaining("R12M") });
  });

  it("giao việc cho người khác khi không có quyền phân công → chờ duyệt; người khác duyệt một lần; không tự duyệt", async () => {
    const s = await setup("ai3");
    const before = await s.c.task.count();
    const r = await s.as(async () => {
      const { aiRun } = await import("@/modules/ai/core");
      return aiRun(s.s1, "assistant", "giao việc cho s2", async (run) => ({ output: await run.tool("tao_nhiem_vu", { title: "Gọi lại khách", dueAt: daysAgo(-1).toISOString(), assigneeId: s.s2.id }) }));
    });
    const pending = r.output as { ok: false; status: string; approvalId: string };
    expect([pending.status, await s.c.task.count()]).toEqual(["PENDING_APPROVAL", before]);
    await expect(s.as(() => decideApproval(s.s1, { id: pending.approvalId, approve: true }))).rejects.toMatchObject({ status: 403 }); // Sales không có ai.approve
    await s.as(() => decideApproval(s.lead, { id: pending.approvalId, approve: true }));
    await expect(s.as(() => decideApproval(s.mgr, { id: pending.approvalId, approve: true }))).rejects.toMatchObject({ status: 409 });
    const t = await s.c.task.findFirstOrThrow({ where: { idempotencyKey: `approval:${pending.approvalId}` } });
    expect([t.assigneeId, (await s.c.toolCall.findFirstOrThrow({ where: { approval: { id: pending.approvalId } } })).status]).toEqual([s.s2.id, "OK"]);
  });

  it("soạn phản hồi: nhiều đơn gần đây → hỏi chọn đơn (không đoán); chọn đơn → bản nháp đúng ngôn ngữ và trạng thái", async () => {
    const s = await setup("ai4");
    const k = await s.cust(`Lina ${RUN}`, { primaryPhoneE164: "+971500000001" });
    const o1 = await s.order(k.id, `L-${RUN}-A`, "IN_TRANSIT", 3);
    await s.order(k.id, `L-${RUN}-B`, "DELIVERED", 20);
    const tk = await s.as(() => createTicket(s.mgr, { type: "GIAO_CHAM", priority: "TRUNG", subject: "Where is my order?", body: "Hi, where is my order? My key is sk-abcdefghijklmnopqrstuv", customerId: k.id, ownerId: s.mgr.id }));
    const ask = await s.as(() => draftReply(s.mgr, { ticketId: tk.id }));
    expect([ask.status, (ask.output as { candidates: unknown[] }).candidates.length]).toEqual(["NEEDS_CLARIFICATION", 2]);
    const d = await s.as(() => draftReply(s.mgr, { ticketId: tk.id, orderId: o1.id, language: "en" }));
    const text = (d.output as { text: string }).text;
    expect(text).toContain(`L-${RUN}-A`);
    expect(text).toMatch(/on its way/);
    expect(d.evidence?.map((e) => e.id)).toContain(o1.id);
    // Hội thoại: bí mật trong tin khách không vào nhật ký; khách đang chờ trả lời.
    const conv = await s.as(() => summarizeConversation(s.mgr, { ticketId: tk.id }));
    expect((conv.output as { waitingForReply: boolean }).waitingForReply).toBe(true);
    const raw = JSON.stringify(await rootDb.agentRun.findUniqueOrThrow({ where: { id: conv.runId } }));
    expect(raw).not.toContain("sk-abcdefghijklmnopqrstuv");
  });

  it("tìm tự nhiên → bộ lọc minh bạch, hợp lệ với trang đích; ngân sách tháng hết → từ chối", async () => {
    const s = await setup("ai5");
    const r = await s.as(() => naturalSearch(s.mgr, "đơn giao thất bại ở UAE tháng này"));
    const out = r.output as { target: string; filters: Record<string, string>; href: string; explain: { field: string }[] };
    expect(out.target).toBe("orders");
    expect(out.filters).toMatchObject({ fulfillment: "FAILED", market: s.ae.id });
    expect(out.filters.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(out.href).toContain("/don-hang?");
    expect(out.explain.map((e) => e.field)).toEqual(expect.arrayContaining(["fulfillment", "market", "from"]));

    const run = await s.c.agentRun.create({ data: { userId: s.mgr.id, feature: "search", provider: "anthropic", model: "claude-sonnet-5-5", status: "OK", input: "x", ms: 1 } as never });
    await s.c.aiCost.create({ data: { runId: run.id, feature: "search", provider: "anthropic", model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 100, usd: "0.5" } as never });
    await expect(s.as(() => setBudget(s.s1, { monthlyUsd: 1 }))).rejects.toMatchObject({ status: 403 });
    await s.as(() => setBudget(s.mgr, { monthlyUsd: 0.4 }));
    await expect(s.as(() => naturalSearch(s.mgr, "khách mua lại"))).rejects.toMatchObject({ status: 429 });
  });
});

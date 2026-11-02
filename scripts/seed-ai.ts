// Dữ liệu demo Phase 11.3: vài lần chạy AI mẫu cho mỗi team (tóm tắt 360, tìm tự nhiên, hỏi báo cáo, tóm tắt + soạn trả lời ticket)
// qua ĐÚNG service AI với LLM replay (không gọi mạng) — để Trung tâm AI và báo cáo AI có lịch sử khi demo. Team đã có lần chạy → bỏ qua.
import { rootDb, runInWorkspace, workspaceDb } from "../src/lib/db";
import { loadUser } from "../src/lib/session";

export async function seedAi() {
  const ai = await import("../src/modules/ai/features");
  const out: Record<string, number> = {};
  for (const w of await rootDb.workspace.findMany({ where: { active: true } })) {
    const c = workspaceDb(w.id);
    if (await c.agentRun.count()) { out[w.code] = 0; continue; }
    const m = await c.membership.findFirst({ where: { workspaceId: w.id, roles: { has: "MANAGER" } }, select: { userId: true } });
    if (!m) continue;
    const u = (await loadUser(m.userId, w.id))!;
    const [cust, ticket] = await Promise.all([
      c.customer.findFirst({ where: { mergedIntoId: null, deliveredOrders: { gte: 2 } }, orderBy: { valueBase12m: "desc" }, select: { id: true } }),
      c.ticket.findFirst({ where: { status: { in: ["MOI", "DANG_XU_LY"] } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    ]);
    const calls: (() => Promise<unknown>)[] = [
      () => ai.naturalSearch(u, "đơn giao thất bại tháng này"),
      () => ai.askReport(u, "Doanh thu giao thành công theo thị trường"),
      ...(cust ? [() => ai.summarize360(u, cust.id)] : []),
      ...(ticket ? [() => ai.summarizeConversation(u, { ticketId: ticket.id }), () => ai.draftReply(u, { ticketId: ticket.id })] : []),
    ];
    let n = 0;
    for (const call of calls) {
      try { await runInWorkspace(w.id, call); n++; } catch (e) { console.warn(`AI mẫu ${w.code}:`, (e as Error).message); }
    }
    out[w.code] = n;
  }
  return out;
}

if (process.argv[1]?.endsWith("seed-ai.ts")) seedAi().then((r) => console.log("AI mẫu:", r)).finally(() => rootDb.$disconnect());

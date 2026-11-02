// Sáu chức năng AI (HLD §14.1, thiết kế Phase 8 lát 8.3). Mỗi chức năng: gom ngữ cảnh qua service/tool có kiểm quyền → LLM → kiểm lại đầu ra
// (bằng chứng phải có trong ngữ cảnh, bộ lọc phải hợp lệ) → ghi AgentRun. Mơ hồ thì hỏi lại, không đoán khách/đơn/SKU.
import type { Evidence } from "@/adapters/llm";
import type { ConversationCtx, DraftCtx, Fact, ReportCtx, SearchOut, SentenceOut, Summary360Ctx } from "@/adapters/llm/replay";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { base, date } from "@/lib/format";
import { can } from "@/lib/permissions";
import { FULFILLMENT_STATUS } from "@/lib/status-badge";
import { requirePerm, type SessionUser } from "@/lib/session";
import { customerFilter } from "@/modules/customers/service";
import { RFM_OPTIONS, BAND_OPTIONS } from "@/modules/marketing/segments";
import { orderFilter } from "@/modules/orders/service";
import { getLead } from "@/modules/sales/leads";
import { getArticle } from "@/modules/service/knowledge";
import { getTicket } from "@/modules/service/tickets";
import { OPEN_TICKET } from "@/modules/service/labels";
import { aiRun, suggest, type Runner } from "./core";

const SYSTEM = "Bạn là trợ lý CRM của LevelUp. Chỉ dùng dữ liệu được cung cấp; mỗi câu phải dẫn id bằng chứng; thiếu dữ liệu thì nói thiếu; không đoán khách, đơn, SKU, giá.";
const todayVN = (now = new Date()) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const label = (v: string, opts: { value: string; label: string }[]) => opts.find((o) => o.value === v)?.label ?? v;
const SCORE_NAME: Record<string, string> = { RFM: "Hạng RFM", TXN_RISK: "Rủi ro giao dịch", SUPPORT_NEED: "Nhu cầu hỗ trợ" };

/** Giữ câu có bằng chứng hợp lệ (id thuộc ngữ cảnh); câu dẫn id lạ bị bỏ — chặn "bịa nguồn". */
function grounded(sentences: SentenceOut[], catalog: Map<string, Evidence>) {
  return sentences
    .filter((s) => s.evidence.every((id) => catalog.has(id)))
    .map((s) => ({ text: s.text, evidence: s.evidence.map((id) => catalog.get(id)!) }));
}
const toolFail = (t: { ok: false; status: string; message: string }) => ({ status: (t.status === "DENIED" ? "DENIED" : "ERROR") as "DENIED" | "ERROR", output: { message: t.message } });

// ---- (1) Tóm tắt 360 ----

export async function summarize360(user: SessionUser, customerId: string) {
  return aiRun(user, "summary360", `Tóm tắt khách ${customerId}`, async (r) => {
    const t = await r.tool("tom_tat_360", { customerId });
    if (!t.ok) return toolFail(t);
    const res = t.result as { redirectTo?: string; c?: Awaited<ReturnType<typeof import("@/modules/customers/service").getCustomer360>>; scores?: Awaited<ReturnType<typeof import("@/modules/scoring/service").getCustomerScores>> };
    if (res.redirectTo || !res.c || "redirectTo" in res.c) return { status: "NEEDS_CLARIFICATION" as const, output: { message: "Hồ sơ đã gộp vào hồ sơ khác — mở hồ sơ còn hiệu lực rồi tóm tắt lại." } };
    const c = res.c, sc = res.scores!;
    const facts: Fact[] = [];
    const catalog = new Map<string, Evidence>();
    const add = (f: Fact, ev: Omit<Evidence, "id">) => { facts.push(f); catalog.set(f.id, { id: f.id, ...ev }); };
    for (const o of c.orders.slice(0, 10)) {
      const fs = FULFILLMENT_STATUS[o.fulfillmentStatus]?.label ?? o.fulfillmentStatus;
      add({ id: `order:${o.id}`, kind: "order", text: `${o.orderNumber} ngày ${date(o.bookedAt)} (${o.status === "CANCELLED" ? "đã hủy" : fs.toLowerCase()})`, at: o.bookedAt, flag: ["FAILED", "RETURNED"].includes(o.fulfillmentStatus) ? "failed" : undefined },
        { kind: "order", label: `Đơn ${o.orderNumber}`, href: `/don-hang/${o.id}` });
    }
    if (sc.metric) {
      const m = sc.metric;
      add({ id: "metric:R12M", kind: "metric", text: `Chỉ số 12 tháng (tính ${date(m.asOf)}): ${m.deliveredOrders}/${m.orders} đơn giao thành công${m.avgCycleDays != null ? `, chu kỳ mua trung bình ${Math.round(m.avgCycleDays)} ngày` : ""}${m.rev03 != null ? `, REV-03 ${base(m.rev03)}` : ""}.` },
        { kind: "metric", label: "Chỉ số R12M", href: `/khach-hang/${customerId}` });
    }
    for (const s of sc.scores) {
      const band = s.type === "RFM" ? label(s.band, RFM_OPTIONS) : label(s.band, BAND_OPTIONS);
      add({ id: `score:${s.type}`, kind: "score", text: s.value == null ? `${SCORE_NAME[s.type]}: chưa đủ dữ liệu (${s.missingData.join(", ") || "thiếu dữ liệu"}).` : `${SCORE_NAME[s.type]}: ${band} (phiên bản v${s.version}).` },
        { kind: "score", label: `${SCORE_NAME[s.type]} v${s.version}`, href: `/khach-hang/${customerId}` });
    }
    for (const it of c.timeline.filter((x) => x.kind === "ticket").slice(0, 10)) {
      const id = it.href?.split("/").at(-1) ?? it.title;
      add({ id: `ticket:${id}`, kind: "ticket", text: it.title.replace(/^Ticket /, ""), at: it.at, flag: OPEN_TICKET.includes(it.detail as never) ? "open" : undefined }, { kind: "ticket", label: it.title, href: it.href });
    }
    for (const l of c.leads.slice(0, 5)) add({ id: `lead:${l.id}`, kind: "lead", text: `${l.interest ?? "chưa ghi nhu cầu"} (${l.owner ?? "chưa giao"})`, flag: ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH"].includes(l.stage) ? "open" : undefined }, { kind: "lead", label: "Nhu cầu mua", href: `/nhu-cau/${l.id}` });
    const a = c.activities[0];
    if (a) add({ id: `activity:${a.id}`, kind: "activity", text: `${a.direction === "IN" ? "khách nhắn" : "mình liên hệ"} ngày ${date(a.occurredAt)}${a.body ? `: "${a.body.slice(0, 80)}"` : ""}`, at: a.occurredAt }, { kind: "activity", label: "Tương tác", href: a.leadId ? `/nhu-cau/${a.leadId}` : undefined });
    for (const p of c.preferences.filter((x) => !x.optIn)) add({ id: `pref:${p.id}`, kind: "preference", text: `Khách đã từ chối nhận tin ${p.purpose === "MARKETING" ? "tiếp thị" : "chăm sóc"} qua ${p.channel} — không gửi tin loại này.`, flag: "optout" }, { kind: "preference", label: "Quyền liên hệ", href: `/khach-hang/${customerId}` });
    const ctx: Summary360Ctx = { customer: { name: c.customer.name, market: c.customer.market?.code ?? null }, facts };
    const out = await r.complete("summary360", { system: SYSTEM, prompt: "Tóm tắt hồ sơ khách cho nhân viên CSKH, mỗi câu kèm bằng chứng.", context: ctx });
    const sentences = grounded((out.data as { sentences: SentenceOut[] } | null)?.sentences ?? [], catalog);
    return { output: { sentences }, evidence: [...catalog.values()] };
  });
}

// ---- (2) Tìm tự nhiên ----

export async function naturalSearch(user: SessionUser, q: string) {
  const query = q.trim().slice(0, 300);
  if (query.length < 2) throw new HttpError(400, "Nhập câu tìm kiếm");
  return aiRun(user, "search", query, async (r) => {
    const markets = await db.market.findMany({ where: { active: true }, select: { id: true, code: true, name: true } });
    const out = (await r.complete("search", { system: SYSTEM, prompt: query, context: { today: todayVN(), markets } })).data as SearchOut | null;
    if (!out) return { status: "ERROR" as const, output: { message: "Không hiểu câu tìm kiếm" } };
    const perm = out.target === "orders" ? "order.view" : "customer.view";
    if (!can(user.roles, perm)) return { status: "DENIED" as const, output: { message: `Bạn không có quyền xem ${out.target === "orders" ? "đơn hàng" : "khách hàng"}.` } };
    // Chỉ giữ bộ lọc hợp lệ với schema của trang đích — model không thể chèn tham số lạ.
    const schema = out.target === "orders" ? orderFilter : customerFilter;
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.filters)) if (k in schema.shape && schema.safeParse({ [k]: v }).success) filters[k] = v;
    const explain = out.explain.filter((e) => e.field in filters).map((e) => ({ ...e, label: e.field === "market" ? markets.find((m) => m.id === e.value)?.code ?? e.value : e.field === "fulfillment" ? FULFILLMENT_STATUS[e.value]?.label ?? e.value : e.value }));
    const href = `/${out.target === "orders" ? "don-hang" : "khach-hang"}?${new URLSearchParams(filters).toString()}`;
    return { status: (Object.keys(filters).length ? "OK" : "NEEDS_CLARIFICATION") as "OK" | "NEEDS_CLARIFICATION", output: { target: out.target, filters, explain, href } };
  });
}

// ---- (3) Tóm tắt hội thoại ----

async function productNames(user: SessionUser, brand: { id?: string | null; code?: string | null }) {
  requirePerm(user, "product.view");
  const where = brand.id ? { product: { brandId: brand.id } } : brand.code ? { product: { brand: { code: brand.code } } } : {};
  const rows = await db.variant.findMany({ where, select: { sku: true, product: { select: { name: true, nameEn: true } } }, take: 300 });
  return rows.flatMap((v) => [{ sku: v.sku, name: v.product.name }, ...(v.product.nameEn ? [{ sku: v.sku, name: v.product.nameEn }] : [])]);
}

export async function summarizeConversation(user: SessionUser, input: { ticketId?: string; leadId?: string }) {
  return aiRun(user, "conversation", input.ticketId ? `Tóm tắt ticket ${input.ticketId}` : `Tóm tắt nhu cầu ${input.leadId}`, async (r) => {
    let ctx: ConversationCtx, evPrefix: string, href: string, lead: Awaited<ReturnType<typeof getLead>> | null = null;
    if (input.ticketId) {
      const t = await getTicket(user, input.ticketId);
      ctx = { subject: t.subject, messages: t.events.filter((e) => e.body && ["CREATED", "CUSTOMER", "REPLY"].includes(e.type)).map((e) => ({ id: e.id, direction: e.type === "REPLY" ? "OUT" : "IN", body: e.body!, at: e.at })), products: await productNames(user, { id: t.brandId }) };
      evPrefix = "ticket"; href = `/cham-soc/${t.id}`;
    } else if (input.leadId) {
      lead = await getLead(user, input.leadId);
      ctx = { messages: lead.activities.filter((a) => a.body && (a.direction === "IN" || a.direction === "OUT")).map((a) => ({ id: a.id, direction: a.direction as "IN" | "OUT", body: a.body!, at: a.occurredAt })), products: await productNames(user, { code: lead.brand?.code }), currentInterest: lead.interest };
      evPrefix = "activity"; href = `/nhu-cau/${lead.id}`;
    } else throw new HttpError(400, "Chọn ticket hoặc nhu cầu mua");
    const catalog = new Map(ctx.messages.map((m) => [m.id, { id: m.id, kind: evPrefix, label: `${m.direction === "IN" ? "Khách" : "Mình"} · ${date(m.at)}`, href } satisfies Evidence]));
    const out = (await r.complete("conversation", { system: SYSTEM, prompt: "Tóm tắt hội thoại, khách đang cần gì, có đang chờ trả lời không.", context: ctx })).data as { bullets: SentenceOut[]; waitingForReply: boolean; interest: string | null; interestEvidence: string[] };
    let suggestion: { id: string; interest: string } | null = null;
    // Đề xuất cập nhật nhu cầu: chỉ khi khách nhắc đúng sản phẩm trong danh mục và khác nhu cầu đang ghi — cần người duyệt (Q-32).
    if (lead && out.interest && out.interest !== lead.interest && out.interestEvidence.every((id) => catalog.has(id))) {
      const s = await suggest(r, { kind: "lead.interest", entity: "Lead", entityId: lead.id, payload: { interest: out.interest, from: lead.interest }, reason: `AI đề xuất ghi nhu cầu "${out.interest}" (khách nhắc trong tin nhắn)` });
      suggestion = { id: s.id, interest: out.interest };
    }
    return { output: { bullets: grounded(out.bullets, catalog), waitingForReply: out.waitingForReply, suggestion }, evidence: [...catalog.values()] };
  });
}

// ---- (4) Soạn phản hồi đa ngôn ngữ ----

export async function draftReply(user: SessionUser, input: { ticketId?: string; leadId?: string; language?: string; orderId?: string }) {
  return aiRun(user, "draft", `Soạn phản hồi ${input.ticketId ?? input.leadId} (${input.language ?? "tự chọn"})`, async (r) => {
    let customerId: string | null, customerName: string, brandId: string | null, subject: string | null = null, lastInbound: string | null = null, language: string, ticketOrder: DraftCtx["order"] = null;
    if (input.ticketId) {
      requirePerm(user, "ticket.edit");
      const t = await getTicket(user, input.ticketId);
      customerId = t.customer?.id ?? null; customerName = t.customer?.displayName ?? "anh/chị"; brandId = t.brandId; subject = t.subject;
      lastInbound = [...t.events].reverse().find((e) => e.type === "CUSTOMER" || e.type === "CREATED")?.body ?? null;
      language = input.language ?? (t.customerLocale ?? "vi").slice(0, 2);
      if (t.orderInfo) ticketOrder = { id: t.orderInfo.id, number: t.orderInfo.orderNumber, fulfillment: t.orderInfo.fulfillmentStatus, bookedAt: t.orderInfo.bookedAt };
    } else if (input.leadId) {
      requirePerm(user, "lead.edit");
      const l = await getLead(user, input.leadId);
      customerId = l.customer?.id ?? null; customerName = l.contactName; brandId = l.brand ? (await db.brand.findFirst({ where: { code: l.brand.code }, select: { id: true } }))?.id ?? null : null;
      lastInbound = l.activities.find((a) => a.direction === "IN")?.body ?? null;
      language = input.language ?? l.language ?? "vi";
    } else throw new HttpError(400, "Chọn ticket hoặc nhu cầu mua");
    // Đơn: ticket đã gắn đơn → dùng; không thì chỉ chọn khi khách có đúng 1 đơn gần đây; nhiều đơn → hỏi lại, không đoán.
    let order = ticketOrder;
    if (!order && customerId) {
      const c = await r.tool("tom_tat_360", { customerId });
      const recent = c.ok ? ((c.result as { c: { orders: { id: string; orderNumber: string; fulfillmentStatus: string; bookedAt: string; status: string }[] } }).c?.orders ?? []).filter((o) => o.status !== "CANCELLED" && Date.now() - new Date(o.bookedAt).getTime() < 90 * 86400000) : [];
      const chosen = input.orderId ? recent.find((o) => o.id === input.orderId) : recent.length === 1 ? recent[0] : null;
      if (input.orderId && !chosen) return { status: "NEEDS_CLARIFICATION" as const, output: { message: "Đơn đã chọn không thuộc khách này.", candidates: recent.map((o) => ({ id: o.id, orderNumber: o.orderNumber, fulfillment: o.fulfillmentStatus, bookedAt: o.bookedAt })) } };
      if (!chosen && recent.length > 1) return { status: "NEEDS_CLARIFICATION" as const, output: { message: `Khách có ${recent.length} đơn trong 90 ngày — chọn đơn khách đang hỏi để soạn đúng trạng thái.`, candidates: recent.slice(0, 6).map((o) => ({ id: o.id, orderNumber: o.orderNumber, fulfillment: o.fulfillmentStatus, bookedAt: o.bookedAt })) } };
      if (chosen) order = { id: chosen.id, number: chosen.orderNumber, fulfillment: chosen.fulfillmentStatus, bookedAt: chosen.bookedAt };
    }
    const brand = brandId ? (await db.brand.findFirst({ where: { id: brandId }, select: { name: true } }))?.name ?? "LevelUp" : "LevelUp";
    // Tri thức: bài đã xuất bản đúng ngôn ngữ (brand/thị trường khớp nhất) — đọc qua service có knowledge.view.
    const articles: DraftCtx["articles"] = [];
    if (can(user.roles, "knowledge.view")) {
      const cand = await db.knowledgeArticle.findFirst({ where: { status: "PUBLISHED", language, OR: [{ brandId: null }, ...(brandId ? [{ brandId }] : [])] }, orderBy: { updatedAt: "desc" }, select: { id: true } });
      if (cand) { const a = await getArticle(user, cand.id); articles.push({ id: a.id, title: a.version.title, excerpt: a.version.body.replace(/\s+/g, " ").slice(0, 220) }); }
    }
    const ctx: DraftCtx = { language, customerName, brand, subject, lastInbound, order, articles };
    const out = (await r.complete("draft", { system: SYSTEM, prompt: `Soạn phản hồi bằng ngôn ngữ "${language}" từ trạng thái đơn mới nhất và bài tri thức.`, context: ctx })).data as { text: string; evidence: string[] };
    const catalog = new Map<string, Evidence>([
      ...(order ? [[order.id, { id: order.id, kind: "order", label: `Đơn ${order.number} · ${FULFILLMENT_STATUS[order.fulfillment]?.label ?? order.fulfillment}`, href: `/don-hang/${order.id}` }] as const] : []),
      ...articles.map((a) => [a.id, { id: a.id, kind: "knowledge", label: `Tri thức: ${a.title}`, href: `/tri-thuc/${a.id}` }] as const),
    ]);
    return { output: { text: out.text, language }, evidence: out.evidence.filter((id) => catalog.has(id)).map((id) => catalog.get(id)!) };
  });
}

// ---- (5) Trợ lý: tạo việc / lịch hẹn qua tool; (6) hỏi báo cáo ----

type Candidate = { id: string; name: string; phone: string | null; market: string | null };

async function reportAnswer(r: Runner, input: Record<string, unknown>) {
  const t = await r.tool("hoi_bao_cao", input);
  if (!t.ok) return toolFail(t);
  const res = t.result as { metric: string; groupBy: "market" | "none"; asOf: string | null; moneyHidden: boolean; rows: ReportCtx["rows"] };
  const team = (await db.workspace.findFirst({ where: { id: r.user.workspaceId }, select: { name: true } }))?.name ?? "team";
  const ctx: ReportCtx = { ...res, scope: `${team}, mọi thị trường` };
  const out = (await r.complete("report", { system: SYSTEM, prompt: `Trả lời về ${res.metric}, nêu kỳ, phạm vi, nguồn, độ mới; tách dữ kiện và giả thuyết.`, context: ctx })).data as { text: string; facts: string[]; hypothesis: string | null };
  return {
    output: { kind: "report", text: out.text, facts: out.facts, hypothesis: out.hypothesis, period: res.asOf ? `12 tháng tới ${date(res.asOf)}` : "chưa dựng chỉ số", scope: ctx.scope, source: "CustomerMetric kỳ R12M (Warehouse) — định nghĩa ở Từ điển chỉ số", freshness: res.asOf, moneyHidden: res.moneyHidden },
    evidence: [{ id: `metric:${res.metric}`, kind: "metric", label: `${res.metric} — Từ điển chỉ số`, href: "/quan-tri/chi-so" }],
  };
}

export async function assistant(user: SessionUser, input: { text: string; customerId?: string }) {
  const text = input.text.trim().slice(0, 500);
  if (text.length < 2) throw new HttpError(400, "Nhập yêu cầu");
  return aiRun(user, "assistant", text, async (r) => {
    const res = await r.completeWithTools("assistant", { system: SYSTEM, prompt: text, context: { today: todayVN() } }, ["tim_khach", "tim_don", "tao_nhiem_vu", "tao_lich_hen", "hoi_bao_cao"]);
    const call = res.toolCalls?.[0];
    if (!call) return { status: "NEEDS_CLARIFICATION" as const, output: { message: "Chưa hiểu yêu cầu. Ví dụ: “Tạo lịch hẹn với khách \"Sara Al Harbi\" lúc 10h ngày mai”, “Nhắc tôi gọi khách Omar ngày mai”, “Doanh thu giao thành công theo thị trường”." } };
    if (call.name === "hoi_bao_cao") return reportAnswer(r, call.input);
    if (call.name === "tim_don") {
      const s = await naturalSearchInner(r, String(call.input.query ?? text));
      return s;
    }
    // Xác định khách: chọn sẵn (người dùng bấm từ danh sách hỏi lại) hoặc tìm theo tên — 0 hay nhiều kết quả thì hỏi lại, không ghi gì.
    let customer: Candidate | null = null;
    const name = typeof call.input.customer === "string" ? call.input.customer : call.name === "tim_khach" ? String(call.input.q ?? "") : null;
    if (input.customerId) {
      const t = await r.tool("tim_khach", { q: name ?? text });
      const pre = t.ok ? (t.result as Candidate[]).find((c) => c.id === input.customerId) : null;
      if (!pre) return { status: "NEEDS_CLARIFICATION" as const, output: { message: "Khách đã chọn không còn trong kết quả tìm — tìm lại." } };
      customer = pre;
    } else if (name) {
      const t = await r.tool("tim_khach", { q: name });
      if (!t.ok) return toolFail(t);
      const found = t.result as Candidate[];
      if (call.name === "tim_khach") return { output: { kind: "customers", message: found.length ? `Tìm thấy ${found.length} khách khớp "${name}".` : `Không thấy khách "${name}" trong phạm vi của bạn.`, candidates: found } };
      if (found.length === 0) return { status: "NEEDS_CLARIFICATION" as const, output: { message: `Không thấy khách "${name}" trong phạm vi của bạn. Kiểm tra tên hoặc nhập SĐT.` } };
      if (found.length > 1) return { status: "NEEDS_CLARIFICATION" as const, output: { message: `Có ${found.length} khách khớp "${name}" — chọn đúng khách, AI không tự đoán.`, candidates: found, pending: { text } } };
      customer = found[0];
    }
    const args: Record<string, unknown> = { ...call.input, customerId: customer?.id, idempotencyKey: `ai:${r.runId}` };
    delete args.customer;
    if (customer && typeof args.title === "string" && call.name === "tao_lich_hen") args.title = `Hẹn với ${customer.name}`;
    const t = await r.tool(call.name as "tao_nhiem_vu" | "tao_lich_hen", args);
    if (!t.ok) return t.status === "PENDING_APPROVAL" ? { output: { kind: "pending", message: `Đã gửi yêu cầu duyệt: ${t.message}.`, approvalId: t.approvalId } } : toolFail(t);
    const task = t.result as { taskId: string; title: string; dueAt: string };
    return {
      output: { kind: "task", message: `${call.name === "tao_lich_hen" ? "Đã tạo lịch hẹn" : "Đã tạo nhiệm vụ"} "${task.title}" hạn ${date(task.dueAt)} ${new Date(task.dueAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}${customer ? ` cho khách ${customer.name}` : ""}.`, taskId: task.taskId },
      evidence: [{ id: `task:${task.taskId}`, kind: "task", label: "Nhiệm vụ vừa tạo", href: "/nhiem-vu" }, ...(customer ? [{ id: `customer:${customer.id}`, kind: "customer", label: customer.name, href: `/khach-hang/${customer.id}` }] : [])],
    };
  });
}

async function naturalSearchInner(r: Runner, query: string) {
  const markets = await db.market.findMany({ where: { active: true }, select: { id: true, code: true, name: true } });
  const out = (await r.complete("search", { system: SYSTEM, prompt: query, context: { today: todayVN(), markets } })).data as SearchOut;
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(out.filters)) if (k in orderFilter.shape && orderFilter.safeParse({ [k]: v }).success) filters[k] = v;
  const t = await r.tool("tim_don", filters);
  if (!t.ok) return toolFail(t);
  const res = t.result as { total: number; rows: { id: string; orderNumber: string; customer: string; fulfillment: string }[] };
  return { output: { kind: "orders", message: `${res.total.toLocaleString("vi-VN")} đơn khớp.`, rows: res.rows, href: `/don-hang?${new URLSearchParams(filters).toString()}` } };
}

export async function askReport(user: SessionUser, question: string) {
  return aiRun(user, "report", question.slice(0, 300), async (r) => {
    const res = await r.completeWithTools("report", { system: SYSTEM, prompt: question, context: { today: todayVN() } }, ["hoi_bao_cao"]);
    const call = res.toolCalls?.[0];
    if (!call) return { status: "NEEDS_CLARIFICATION" as const, output: { message: "Hãy hỏi về REV-01…04, ví dụ “Doanh thu giao thành công theo thị trường”." } };
    return reportAnswer(r, call.input);
  });
}

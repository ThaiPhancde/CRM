// LLM replay (demo, D-13): tất định, không gọi mạng. Khớp ý định bằng từ khóa trên prompt (fixtures/ai/lexicon.json, vi/en/ar/de)
// và soạn câu từ NGỮ CẢNH đã lọc quyền — mỗi câu kèm id bằng chứng có trong ngữ cảnh. Không bịa đơn/SKU: thiếu dữ kiện thì nói thiếu.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { estimateTokens, type AiFeature, type Llm, type LlmRequest, type LlmResult, type ToolSpec, type ToolUse } from "./interface";

// ---- Hợp đồng ngữ cảnh giữa nghiệp vụ (src/modules/ai) và mô hình ----
export type Fact = { id: string; kind: "order" | "ticket" | "lead" | "score" | "metric" | "preference" | "activity" | "merge"; text: string; at?: string; flag?: string };
export type Summary360Ctx = { customer: { name: string; market: string | null }; facts: Fact[] };
export type SearchCtx = { today: string; markets: { id: string; code: string; name: string }[] };
export type Msg = { id: string; direction: "IN" | "OUT"; body: string; at: string };
export type ConversationCtx = { subject?: string | null; messages: Msg[]; products: { sku: string; name: string }[]; currentInterest?: string | null };
export type DraftCtx = { language: string; customerName: string; brand: string; subject?: string | null; lastInbound?: string | null;
  order: { id: string; number: string; fulfillment: string; bookedAt: string } | null; articles: { id: string; title: string; excerpt: string }[] };
export type AssistantCtx = { today: string };
export type ReportCtx = { metric: string; groupBy: "market" | "none"; asOf: string | null; rows: { key: string; value: number | null; customers: number }[]; moneyHidden: boolean; scope: string };

export type SearchOut = { target: "orders" | "customers"; filters: Record<string, string>; explain: { field: string; value: string; phrase: string }[] };
export type SentenceOut = { text: string; evidence: string[] };

type Lexicon = {
  target: Record<"orders" | "customers", string[]>;
  fulfillment: Record<string, string[]>;
  cancelled: string[];
  repeat: string[];
  period: Record<"today" | "yesterday" | "last_7_days" | "this_month" | "last_month" | "last_30_days", string[]>;
  markets: Record<string, string[]>;
  intents: Record<"task" | "appointment" | "report" | "find_customer" | "find_order", string[]>;
  metrics: Record<string, string[]>;
  groupByMarket: string[];
  tomorrow: string[];
  todayWords: string[];
  customerMarkers: string[];
};
type Templates = Record<string, { greeting: string; status: Record<string, string>; noOrder: string; kb: string; closing: string }>;

const read = <T,>(f: string, empty: T): T => {
  const p = path.join(process.cwd(), "fixtures", "ai", f);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : empty;
};
let lex: Lexicon | null = null;
let tpl: Templates | null = null;
const L = () => (lex ??= read<Lexicon>("lexicon.json", {} as Lexicon));
const T = () => (tpl ??= read<Templates>("reply-templates.json", {}));

/** Chữ thường, bỏ dấu tiếng Việt/Đức (giữ chữ Ả Rập) để khớp từ khóa. */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/ß/g, "ss");
/** Khớp NGUYÊN cụm từ theo ranh giới chữ Unicode — "mai" không khớp trong "email". */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hit = (text: string, words: string[] = []) =>
  words.find((w) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(norm(w))}(?=$|[^\\p{L}\\p{N}])`, "u").test(text));
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Câu tìm tự nhiên → bộ lọc minh bạch (mỗi bộ lọc kèm cụm từ đã khớp). Hàm thuần — có bảng test. */
export function parseSearch(q: string, ctx: SearchCtx): SearchOut {
  const lx = L(), t = norm(q);
  const explain: SearchOut["explain"] = [];
  const filters: Record<string, string> = {};
  const set = (field: string, value: string, phrase: string) => { filters[field] = value; explain.push({ field, value, phrase }); };
  const isOrder = hit(t, lx.target?.orders);
  const target: SearchOut["target"] = isOrder || Object.keys(lx.fulfillment ?? {}).some((k) => hit(t, lx.fulfillment[k])) ? "orders" : "customers";
  if (target === "orders") {
    for (const [code, words] of Object.entries(lx.fulfillment ?? {})) { const w = hit(t, words); if (w) { set("fulfillment", code, w); break; } }
    const c = hit(t, lx.cancelled); if (c) set("status", "CANCELLED", c);
  } else {
    const r = hit(t, lx.repeat); if (r) set("repeat", "1", r);
  }
  for (const [code, words] of Object.entries(lx.markets ?? {})) {
    const m = ctx.markets.find((x) => x.code === code);
    const w = m && (hit(t, words) ?? (t.split(/[^\p{L}\p{N}]+/u).includes(code.toLowerCase()) ? code : undefined));
    if (m && w) { set("market", m.id, w); break; }
  }
  const p = lx.period ?? ({} as Lexicon["period"]);
  const [from, to] = target === "orders" ? ["from", "to"] : ["lastFrom", "lastTo"];
  const month = ctx.today.slice(0, 7);
  const ranges: [keyof Lexicon["period"], string, string][] = [
    ["yesterday", addDays(ctx.today, -1), addDays(ctx.today, -1)], ["today", ctx.today, ctx.today],
    ["last_7_days", addDays(ctx.today, -6), ctx.today], ["last_30_days", addDays(ctx.today, -29), ctx.today],
    ["last_month", addDays(`${month}-01`, -1).slice(0, 7) + "-01", addDays(`${month}-01`, -1)], ["this_month", `${month}-01`, ctx.today],
  ];
  for (const [k, a, b] of ranges) { const w = hit(t, p[k]); if (w) { set(from, a, w); set(to, b, w); break; } }
  // Mã đơn / SĐT / tên trong ngoặc kép → tìm chữ
  const code = q.match(/["“](.+?)["”]/)?.[1] ?? q.match(/\b[A-Z]{1,3}-?\d{4,}\b/)?.[0] ?? q.match(/\+?\d[\d\s]{7,}\d/)?.[0]?.replace(/\s/g, "");
  if (code) set("q", code, code);
  return { target, filters, explain };
}

/** Tóm tắt 360: mỗi câu dẫn bằng chứng (id dữ kiện). Không có dữ kiện thì nói không có, không suy đoán. */
function summary360(ctx: Summary360Ctx): SentenceOut[] {
  const by = (k: Fact["kind"]) => ctx.facts.filter((f) => f.kind === k);
  const out: SentenceOut[] = [];
  const orders = by("order");
  out.push(orders.length
    ? { text: `${ctx.customer.name}${ctx.customer.market ? ` (${ctx.customer.market})` : ""} có ${orders.length} đơn; gần nhất: ${orders[0].text}.`, evidence: orders.slice(0, 3).map((f) => f.id) }
    : { text: `${ctx.customer.name} chưa có đơn nào trong dữ liệu.`, evidence: [] });
  const bad = orders.filter((f) => f.flag === "failed");
  if (bad.length) out.push({ text: `${bad.length} đơn giao không thành công hoặc bị hoàn: ${bad.slice(0, 2).map((f) => f.text).join("; ")}.`, evidence: bad.slice(0, 3).map((f) => f.id) });
  const metric = by("metric")[0];
  if (metric) out.push({ text: metric.text, evidence: [metric.id] });
  for (const s of by("score")) out.push({ text: s.text, evidence: [s.id] });
  const open = by("ticket").filter((f) => f.flag === "open");
  if (open.length) out.push({ text: `Đang có ${open.length} ticket mở: ${open.map((f) => f.text).join("; ")}.`, evidence: open.map((f) => f.id) });
  const leads = by("lead").filter((f) => f.flag === "open");
  if (leads.length) out.push({ text: `Nhu cầu mua đang mở: ${leads.map((f) => f.text).join("; ")}.`, evidence: leads.map((f) => f.id) });
  const lastAct = by("activity")[0];
  if (lastAct) out.push({ text: `Tương tác gần nhất: ${lastAct.text}.`, evidence: [lastAct.id] });
  for (const p of by("preference").filter((f) => f.flag === "optout")) out.push({ text: p.text, evidence: [p.id] });
  return out.filter((s) => s.text);
}

function conversation(ctx: ConversationCtx) {
  const msgs = [...ctx.messages].sort((a, b) => a.at.localeCompare(b.at));
  const inbound = msgs.filter((m) => m.direction === "IN");
  const bullets: SentenceOut[] = [];
  if (!msgs.length) return { bullets: [{ text: "Chưa có tin nhắn nào để tóm tắt.", evidence: [] }], waitingForReply: false, interest: null as string | null, interestEvidence: [] as string[] };
  const first = inbound[0], last = msgs.at(-1)!;
  if (first) bullets.push({ text: `Khách mở đầu: "${clip(first.body)}"`, evidence: [first.id] });
  if (inbound.length > 1) bullets.push({ text: `Tin gần nhất của khách: "${clip(inbound.at(-1)!.body)}"`, evidence: [inbound.at(-1)!.id] });
  bullets.push({ text: `${msgs.length} tin (${inbound.length} từ khách, ${msgs.length - inbound.length} từ mình).`, evidence: msgs.map((m) => m.id).slice(-5) });
  const waitingForReply = last.direction === "IN";
  if (waitingForReply) bullets.push({ text: "Khách đang chờ phản hồi.", evidence: [last.id] });
  // Nhu cầu: chỉ khi khách nhắc ĐÚNG tên/SKU sản phẩm trong danh mục — không đoán.
  let interest: string | null = null, interestEvidence: string[] = [];
  for (const m of [...inbound].reverse()) {
    const t = norm(m.body);
    const p = ctx.products.find((x) => t.includes(norm(x.sku)) || (x.name.length > 4 && t.includes(norm(x.name))));
    if (p) { interest = p.name; interestEvidence = [m.id]; break; }
  }
  return { bullets, waitingForReply, interest, interestEvidence };
}

function draft(ctx: DraftCtx) {
  const t = T()[ctx.language] ?? T().en ?? T().vi;
  if (!t) return { text: "", evidence: [] as string[] };
  const fill = (s: string, v: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? "");
  const v = { name: ctx.customerName, brand: ctx.brand, order: ctx.order?.number ?? "" };
  const parts = [fill(t.greeting, v)];
  const evidence: string[] = [];
  if (ctx.order) { parts.push(fill(t.status[ctx.order.fulfillment] ?? t.status.UNFULFILLED ?? "", v)); evidence.push(ctx.order.id); }
  else parts.push(fill(t.noOrder, v));
  const art = ctx.articles[0];
  if (art) { parts.push(fill(t.kb, { ...v, excerpt: art.excerpt })); evidence.push(art.id); }
  parts.push(fill(t.closing, v));
  return { text: parts.filter(Boolean).join("\n\n"), evidence };
}

/** Câu lệnh trợ lý → lời gọi tool (một lượt). Tên khách để nguyên chữ — nghiệp vụ tự tìm và hỏi lại nếu mơ hồ. Hàm thuần — có bảng test. */
export function parseAssistant(prompt: string, ctx: AssistantCtx): ToolUse[] {
  const lx = L();
  const customer = extractCustomer(prompt);
  // Bỏ tên khách khỏi câu trước khi tìm ý định / ngày giờ (khách tên "Mai" không thành "ngày mai").
  const t = norm(customer ? prompt.replace(customer, " ") : prompt);
  const time = t.match(/\b(\d{1,2})(?:[:h](\d{2})|\s?(?:gio|h|uhr)\b|\s?(am|pm)\b)/);
  const dayOffset = hit(t, lx.tomorrow) ? 1 : hit(t, lx.todayWords) ? 0 : (Number(t.match(/(?:sau|in|nach)\s+(\d{1,2})\s+(?:ngay|days?|tagen?)/)?.[1]) || 1);
  const at = () => {
    let h = time ? Number(time[1]) : 9;
    if (time?.[3] === "pm" && h < 12) h += 12;
    const day = addDays(ctx.today, dayOffset);
    return new Date(`${day}T${String(h).padStart(2, "0")}:${time?.[2] ?? "00"}:00+07:00`).toISOString();
  };
  if (hit(t, lx.intents?.appointment)) return [{ name: "tao_lich_hen", input: { customer, at: at(), title: customer ? `Hẹn với ${customer}` : "Lịch hẹn" } }];
  if (hit(t, lx.intents?.task)) return [{ name: "tao_nhiem_vu", input: { customer, dueAt: at(), title: clip(prompt, 120) } }];
  if (hit(t, lx.intents?.report)) {
    const metric = Object.entries(lx.metrics ?? {}).find(([, w]) => hit(t, w))?.[0] ?? "REV-03";
    return [{ name: "hoi_bao_cao", input: { metric, groupBy: hit(t, lx.groupByMarket) ? "market" : "none" } }];
  }
  if (hit(t, lx.intents?.find_order)) return [{ name: "tim_don", input: { query: prompt } }];
  if (hit(t, lx.intents?.find_customer) || customer) return [{ name: "tim_khach", input: { q: customer ?? prompt } }];
  return [];
}

/** Tên khách: trong ngoặc kép, hoặc sau "khách / customer / Kunde / العميل" tới từ chỉ thời gian. */
function extractCustomer(prompt: string): string | null {
  const quoted = prompt.match(/["“](.+?)["”]/)?.[1];
  if (quoted) return quoted.trim();
  const markers = L().customerMarkers ?? [];
  for (const mk of markers) {
    const i = norm(prompt).indexOf(norm(mk) + " ");
    if (i < 0) continue;
    const rest = prompt.slice(i + mk.length + 1);
    // Ranh giới bằng (?=\s|$) + cờ u: \b không hiểu chữ có dấu / chữ Ả Rập. "mai" đứng riêng không là từ dừng (tên "Nguyễn Mai").
    const name = rest.split(/\s+(?:lúc|luc|vào|vao|ngày mai|ngày|ngay|hôm nay|at|on|tomorrow|today|um|morgen|heute|غدا|اليوم|về|ve|about|để|de)(?=\s|$)|[,.;!?]/iu)[0].trim();
    if (name && name.split(/\s+/).length <= 4) return name;
  }
  return null;
}

function report(ctx: ReportCtx) {
  if (!ctx.rows.length) return { text: `Chưa có số liệu ${ctx.metric} (chỉ số chưa dựng hoặc không có khách trong phạm vi).`, facts: [] as string[] };
  const fmt = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("vi-VN")} ₫`);
  const total = ctx.rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const facts = ctx.moneyHidden
    ? ctx.rows.map((r) => `${r.key}: ${r.customers.toLocaleString("vi-VN")} khách (số tiền ẩn — cần quyền xem tiền)`)
    : ctx.rows.map((r) => `${r.key}: ${fmt(r.value)} · ${r.customers.toLocaleString("vi-VN")} khách`);
  const top = !ctx.moneyHidden && ctx.rows.length > 1 ? [...ctx.rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] : null;
  return {
    text: ctx.moneyHidden ? `${ctx.metric}: ${facts.join("; ")}.` : `${ctx.metric} tổng ${fmt(total)}${top ? `; lớn nhất ở ${top.key} (${Math.round(((top.value ?? 0) / (total || 1)) * 100)}%)` : ""}.`,
    facts,
    // Giả thuyết tách riêng, không trình bày như kết luận.
    hypothesis: top ? `Giả thuyết (chưa kiểm chứng): chênh lệch giữa thị trường có thể do số khách khác nhau (${top.customers.toLocaleString("vi-VN")} khách ở ${top.key}), không nhất thiết do giá trị mỗi khách.` : null,
  };
}

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export class ReplayLlm implements Llm {
  readonly provider = "replay";
  readonly model = "replay";
  async complete(feature: AiFeature, req: LlmRequest): Promise<LlmResult> {
    const data: unknown =
      feature === "search" ? parseSearch(req.prompt, req.context as SearchCtx)
      : feature === "summary360" ? { sentences: summary360(req.context as Summary360Ctx) }
      : feature === "conversation" ? conversation(req.context as ConversationCtx)
      : feature === "draft" ? draft(req.context as DraftCtx)
      : feature === "report" ? report(req.context as ReportCtx)
      : null;
    return this.wrap(req, data);
  }
  async completeWithTools(_feature: AiFeature, req: LlmRequest, tools: ToolSpec[]): Promise<LlmResult> {
    const allowed = new Set(tools.map((x) => x.name));
    const calls = parseAssistant(req.prompt, req.context as AssistantCtx).filter((c) => allowed.has(c.name));
    return { ...this.wrap(req, null), toolCalls: calls };
  }
  private wrap(req: LlmRequest, data: unknown): LlmResult {
    const text = typeof data === "object" && data && "text" in data ? String((data as { text: unknown }).text) : JSON.stringify(data ?? "");
    return { text, data, provider: this.provider, model: this.model, usage: { inputTokens: estimateTokens(req.system + req.prompt + JSON.stringify(req.context ?? "")), outputTokens: estimateTokens(text) } };
  }
}

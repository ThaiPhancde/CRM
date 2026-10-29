// Công thức điểm v1 (D-11, D-33, D-52) — hàm THUẦN, không DB, để test bằng bảng. Trọng số là giả thuyết, đổi được theo phiên bản.
// Mọi điểm trả: value (null = chưa đủ dữ liệu), band, reasons (thành phần → điểm → bằng chứng), missingData, suggestedAction.
// Không dùng tên/quốc gia làm tín hiệu chất lượng (HLD §7.3); lỗi hãng vận chuyển không tính vào rủi ro khách.

export type Reason = { part: string; points: number; max: number; evidence: string };
export type ScoreResult = { value: number | null; band: string; reasons: Reason[]; missingData: string[]; suggestedAction: string | null };

export const DEFAULT_WEIGHTS = {
  SALES_PRIORITY: { fit: 25, intent: 35, engagement: 25, readiness: 15 },
  RFM: {},
  TXN_RISK: { failRate: 60, missingInfo: 20, address: 20 },
  SUPPORT_NEED: { openTickets: 40, severity: 40, wait: 20 },
} as const;
export type Weights = Record<string, number>;

/** Thang 0–100 → Thấp < 40, Vừa 40–69, Cao ≥ 70 (docs/metrics.md mục 5). */
export const band3 = (v: number) => (v >= 70 ? "CAO" : v >= 40 ? "VUA" : "THAP");
const pts = (ratio: number, max: number) => Math.round(Math.max(0, Math.min(1, ratio)) * max);
const INSUFFICIENT = "CHUA_DU_DU_LIEU";

// ---- Ưu tiên sales cho lead (HLD §7.2) ----

/** Tín hiệu mua trong tin nhắn khách, 4 nhóm × 4 ngôn ngữ. ponytail: so khớp từ khóa; Phase 8 thay bằng LLM trích ý định có bằng chứng. */
export const INTENT_KEYWORDS: Record<"price" | "delivery" | "variant" | "order", RegExp> = {
  price: /giá|bao nhiêu|\bprice\b|\bcost\b|how much|سعر|بكم|\bpreis\b|kostet/i,
  delivery: /giao hàng|\bgiao\b|\bship|deliver|توصيل|شحن|liefer|versand/i,
  variant: /size|màu|số lượng|kích thước|quantity|colou?r|\bpcs\b|مقاس|لون|كمية|größe|farbe|menge|stück/i,
  order: /đặt|chốt|lấy luôn|\border\b|\bbuy\b|\bcod\b|أطلب|اطلب|اشتري|الدفع عند الاستلام|bestell|kaufen|nachnahme/i,
};
const INTENT_LABEL = { price: "hỏi giá", delivery: "hỏi giao hàng", variant: "chọn mẫu/số lượng", order: "muốn đặt/COD" };

export type LeadInput = {
  interest: string | null;
  hasBudget: boolean;
  hasBrandMarket: boolean;
  stage: "MOI" | "DANG_TU_VAN" | "CHO_QUYET_DINH";
  /** Tin khách gửi (chiều IN), mới nhất trước hoặc bất kỳ thứ tự. */
  inbound: { text: string; at: Date }[];
  hasNextAction: boolean;
};

export function scoreLead(x: LeadInput, w: Weights, now: Date): ScoreResult {
  const missing: string[] = [];
  if (!x.inbound.length) missing.push("chưa có tin nhắn của khách");
  if (!x.interest) missing.push("chưa ghi sản phẩm quan tâm");
  if (!x.hasBudget) missing.push("chưa có ngân sách");
  if (!x.inbound.length && !x.interest && !x.hasBudget) return { value: null, band: INSUFFICIENT, reasons: [], missingData: missing, suggestedAction: "Liên hệ để hỏi nhu cầu trước khi chấm điểm" };

  const fitRatio = (x.interest ? 0.4 : 0) + (x.hasBudget ? 0.3 : 0) + (x.hasBrandMarket ? 0.3 : 0);
  const text = x.inbound.map((m) => m.text).join("\n");
  const hits = (Object.keys(INTENT_KEYWORDS) as (keyof typeof INTENT_KEYWORDS)[]).filter((k) => INTENT_KEYWORDS[k].test(text));
  const intentRatio = Math.max(hits.length * 0.25, x.stage === "CHO_QUYET_DINH" ? 0.75 : 0);
  const last = x.inbound.reduce<Date | null>((m, i) => (!m || i.at > m ? i.at : m), null);
  const hours = last ? (now.getTime() - last.getTime()) / 3600000 : Infinity;
  const recency = hours <= 24 ? 0.6 : hours <= 72 ? 0.4 : hours <= 168 ? 0.2 : 0;
  const progress = x.stage === "CHO_QUYET_DINH" ? 0.4 : x.stage === "DANG_TU_VAN" ? 0.2 : 0;
  const readyRatio = (x.stage === "CHO_QUYET_DINH" ? 0.5 : 0) + (x.hasBudget ? 0.25 : 0) + (x.hasNextAction ? 0.25 : 0);

  const reasons: Reason[] = [
    { part: "Nhu cầu phù hợp", points: pts(fitRatio, w.fit), max: w.fit, evidence: [x.interest ? `quan tâm: ${x.interest}` : "chưa rõ sản phẩm", x.hasBudget ? "có ngân sách" : "chưa có ngân sách", x.hasBrandMarket ? "đúng brand/thị trường" : "chưa rõ brand/thị trường"].join("; ") },
    { part: "Tín hiệu mua rõ", points: pts(intentRatio, w.intent), max: w.intent, evidence: hits.length ? hits.map((h) => INTENT_LABEL[h]).join(", ") : x.stage === "CHO_QUYET_DINH" ? "đang chờ quyết định" : "chưa thấy tín hiệu mua" },
    { part: "Tương tác gần, có tiến triển", points: pts(recency + progress, w.engagement), max: w.engagement, evidence: `${last ? `khách nhắn ${hours < 1 ? "dưới 1 giờ" : `${Math.floor(hours)} giờ`} trước` : "khách chưa nhắn"}; giai đoạn ${x.stage}` },
    { part: "Sẵn sàng đặt", points: pts(readyRatio, w.readiness), max: w.readiness, evidence: [x.stage === "CHO_QUYET_DINH" ? "chờ quyết định" : null, x.hasBudget ? "có ngân sách" : null, x.hasNextAction ? "đã hẹn liên hệ lại" : null].filter(Boolean).join(", ") || "chưa sẵn sàng" },
  ];
  const value = reasons.reduce((s, r) => s + r.points, 0);
  const band = band3(value);
  return { value, band, reasons, missingData: missing, suggestedAction: band === "CAO" ? "Liên hệ trong hôm nay, chốt mẫu, số lượng và địa chỉ" : band === "VUA" ? "Gửi báo giá/mẫu và hẹn liên hệ lại" : "Nuôi dưỡng: gửi thông tin sản phẩm, hỏi thêm nhu cầu" };
}

// ---- RFM (CUS-01) ----

export type RfmInput = { r: number | null; f: number | null; m: number | null; recencyDays: number | null; deliveredOrders: number; rev03: string | null };

export function rfmSegment(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return "CHAMPIONS";
  if (r >= 4 && f <= 2) return "MOI";
  if (r <= 2 && f >= 3) return "CO_NGUY_CO";
  if (r <= 2 && f <= 2) return "NGU_DONG";
  if (f >= 3) return "TRUNG_THANH";
  return "CAN_CHAM_SOC";
}
const RFM_ACTION: Record<string, string> = {
  CHAMPIONS: "Giữ chân: ưu đãi riêng, mời dùng sản phẩm mới",
  TRUNG_THANH: "Gợi ý mua kèm/bổ sung theo chu kỳ",
  MOI: "Chăm sóc sau mua lần đầu, hướng dẫn sử dụng",
  CO_NGUY_CO: "Liên hệ lại sớm trước khi mất khách",
  NGU_DONG: "Kích hoạt lại bằng chiến dịch, không ưu tiên gọi",
  CAN_CHAM_SOC: "Theo dõi, gửi nội dung phù hợp",
};

/** `rev03` null = người xem không có quyền tiền (bằng chứng M bị che, điểm vẫn tính ở server). */
export function scoreRfm(x: RfmInput): ScoreResult {
  if (x.r == null || x.f == null || x.m == null || !x.deliveredOrders) {
    return { value: null, band: INSUFFICIENT, reasons: [], missingData: ["chưa có đơn giao thành công trong 12 tháng"], suggestedAction: null };
  }
  const band = rfmSegment(x.r, x.f, x.m);
  return {
    value: x.r * 100 + x.f * 10 + x.m,
    band,
    reasons: [
      { part: "R — độ gần", points: x.r, max: 5, evidence: `mua hợp lệ gần nhất ${x.recencyDays} ngày trước` },
      { part: "F — tần suất", points: x.f, max: 5, evidence: `${x.deliveredOrders} đơn giao thành công 12 tháng` },
      { part: "M — giá trị", points: x.m, max: 5, evidence: x.rev03 == null ? "REV-03 12 tháng (cần quyền xem tiền)" : `REV-03 12 tháng ${x.rev03} VND` },
    ],
    missingData: [],
    suggestedAction: RFM_ACTION[band],
  };
}

// ---- Rủi ro giao dịch (CUS-05) ----

export type TxnInput = { confirmedOrders: number; failedByCustomer: number; hasPhone: boolean; hasEmail: boolean; hasAddress: boolean };

/** Cần ≥ 2 đơn xác nhận; ít hơn = chưa đủ dữ liệu, KHÔNG mặc định rủi ro cao (HLD §7.2). 50% đơn khách từ chối = tối đa. */
export function scoreTxnRisk(x: TxnInput, w: Weights): ScoreResult {
  const missing = [!x.hasPhone && "thiếu SĐT", !x.hasEmail && "thiếu email", !x.hasAddress && "chưa có địa chỉ giao"].filter(Boolean) as string[];
  if (x.confirmedOrders < 2) return { value: null, band: INSUFFICIENT, reasons: [], missingData: ["dưới 2 đơn xác nhận", ...missing], suggestedAction: null };
  const rate = x.failedByCustomer / x.confirmedOrders;
  const reasons: Reason[] = [
    { part: "Từ chối/không nhận do khách", points: pts(rate / 0.5, w.failRate), max: w.failRate, evidence: `${x.failedByCustomer}/${x.confirmedOrders} đơn xác nhận (${Math.round(rate * 100)}%)` },
    { part: "Thiếu thông tin liên hệ", points: pts((x.hasPhone ? 0 : 0.6) + (x.hasEmail ? 0 : 0.4), w.missingInfo), max: w.missingInfo, evidence: [x.hasPhone ? null : "thiếu SĐT", x.hasEmail ? null : "thiếu email"].filter(Boolean).join(", ") || "đủ SĐT và email" },
    { part: "Địa chỉ", points: x.hasAddress ? 0 : w.address, max: w.address, evidence: x.hasAddress ? "đã có địa chỉ" : "chưa có địa chỉ giao" },
  ];
  const value = reasons.reduce((s, r) => s + r.points, 0);
  const band = band3(value);
  return { value, band, reasons, missingData: missing, suggestedAction: band === "CAO" ? "Gọi xác nhận trước khi giao COD" : band === "VUA" ? "Nhắn xác nhận địa chỉ và thời gian nhận" : null };
}

// ---- Nhu cầu hỗ trợ ----

export type SupportInput = { openTickets: number; maxOpenPriority: number; oldestOpenAt: Date | null };

export function scoreSupport(x: SupportInput, w: Weights, now: Date): ScoreResult {
  const waitH = x.oldestOpenAt ? (now.getTime() - x.oldestOpenAt.getTime()) / 3600000 : 0;
  const reasons: Reason[] = [
    { part: "Ticket đang mở", points: pts(x.openTickets >= 2 ? 1 : x.openTickets === 1 ? 0.5 : 0, w.openTickets), max: w.openTickets, evidence: `${x.openTickets} ticket mở` },
    { part: "Mức nghiêm trọng", points: pts(x.maxOpenPriority / 4, w.severity), max: w.severity, evidence: ["không có", "Thấp", "Trung bình", "Cao", "Khẩn"][x.maxOpenPriority] ?? "—" },
    { part: "Thời gian chờ", points: pts(waitH >= 48 ? 1 : waitH >= 24 ? 0.6 : waitH >= 8 ? 0.3 : 0, w.wait), max: w.wait, evidence: x.oldestOpenAt ? `ticket mở lâu nhất ${Math.floor(waitH)} giờ` : "không chờ" },
  ];
  const value = reasons.reduce((s, r) => s + r.points, 0);
  const band = band3(value);
  return { value, band, reasons, missingData: [], suggestedAction: band === "CAO" ? "Ưu tiên CSKH liên hệ trong ngày" : band === "VUA" ? "Theo dõi ticket, cập nhật cho khách" : null };
}

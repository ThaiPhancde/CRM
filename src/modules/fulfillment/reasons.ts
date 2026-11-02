// Lý do giao thất bại chuẩn hóa (Phase 10, D-58). Mọi nguồn (Pancake, Shopify, file hãng) đổi chữ gốc về một mã ở đây;
// chữ gốc giữ ở DeliveryEvent.reasonRaw để truy vết. "fault" quyết định lý do có tính vào rủi ro khách hay không (Q-27):
// chỉ lý do thuộc khách mới vào CUS-05 / điểm rủi ro giao dịch; lỗi hãng/kho không làm xấu khách.
// File thuần (không import server) — client component dùng được nhãn.

export type Fault = "customer" | "carrier" | "other";
export const FAILURE_REASONS = {
  customer_refused: { label: "Khách từ chối nhận", fault: "customer" },
  unreachable: { label: "Không liên lạc được", fault: "customer" },
  wrong_address: { label: "Sai địa chỉ", fault: "customer" },
  carrier_delay: { label: "Hãng vận chuyển chậm", fault: "carrier" },
  damaged: { label: "Hàng hư hỏng", fault: "carrier" },
  lost: { label: "Thất lạc", fault: "carrier" },
  returned_item: { label: "Khách trả hàng", fault: "other" },
  other: { label: "Lý do khác", fault: "other" },
} as const satisfies Record<string, { label: string; fault: Fault }>;
export type FailureReason = keyof typeof FAILURE_REASONS;
export const FAILURE_REASON_CODES = Object.keys(FAILURE_REASONS) as FailureReason[];
export const CUSTOMER_FAILURE_REASONS = FAILURE_REASON_CODES.filter((c) => FAILURE_REASONS[c].fault === "customer");
export const reasonLabel = (code: string | null | undefined) => (code ? (FAILURE_REASONS[code as FailureReason]?.label ?? code) : "Không rõ lý do");
export const FAULT_LABEL: Record<Fault, string> = { customer: "Thuộc khách", carrier: "Thuộc hãng vận chuyển", other: "Khác" };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Cụm từ (đã bỏ dấu, chữ thường) → mã. Thứ tự quan trọng: cụm cụ thể đứng trước cụm chung.
// ponytail: từ điển cố định theo chữ hãng hay dùng (en/vi/ar/fr/de); hãng mới có chữ lạ → rơi về "other", bổ sung tại đây.
const PHRASES: [FailureReason, string[]][] = [
  ["wrong_address", ["wrong address", "incorrect address", "address not found", "bad address", "sai dia chi", "khong tim thay dia chi", "عنوان خاطئ", "عنوان غير صحيح", "adresse incorrecte", "adresse inconnue", "falsche adresse", "adresse unbekannt"]],
  ["unreachable", ["unreachable", "no answer", "not answering", "phone off", "cannot contact", "customer not available", "not home", "khong lien lac", "khong nghe may", "thue bao", "لا يرد", "الهاتف مغلق", "تعذر الاتصال", "injoignable", "absent", "nicht erreichbar", "nicht angetroffen"]],
  ["customer_refused", ["refused", "rejected", "declined", "customer cancel", "tu choi", "khach huy", "khong nhan hang", "رفض", "refuse", "verweigert", "abgelehnt"]],
  ["damaged", ["damaged", "broken", "hu hong", "vo", "تالف", "endommage", "beschadigt"]],
  ["lost", ["lost", "missing parcel", "that lac", "mat hang", "مفقود", "perdu", "verloren"]],
  ["carrier_delay", ["carrier delay", "delay", "delayed", "late", "weather", "capacity", "cham", "tre", "تأخير", "retard", "verspatet", "verzogerung"]],
  ["returned_item", ["returned item", "customer return", "tra hang", "مرتجع", "retour client", "rucksendung"]],
];

/** Chữ gốc của hãng → mã chuẩn. Đã là mã chuẩn thì giữ; rỗng → null; không nhận ra → "other". */
export function normalizeReason(raw: string | null | undefined): FailureReason | null {
  if (raw == null || !raw.trim()) return null;
  const t = raw.trim();
  if (t in FAILURE_REASONS) return t as FailureReason;
  const f = ` ${fold(t)} `;
  for (const [code, list] of PHRASES) if (list.some((p) => f.includes(` ${fold(p)} `))) return code;
  return "other";
}

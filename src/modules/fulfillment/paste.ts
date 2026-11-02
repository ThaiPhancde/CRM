// Đọc bảng dán (mẫu Purchasing 5.1): dòng đầu là tiêu đề, cột nhận theo tên đã bỏ dấu; tab (Excel) hoặc dấu phẩy (CSV).
// Hàm thuần — không đọc DB, test bảng được. Dùng cho đối soát COD (Phase 10, D-58).

export const MAX_ROWS = 500;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim().replace(/[\s-]+/g, "_");

/** Tên cột chấp nhận (sau khi bỏ dấu, chữ thường, khoảng trắng → _). */
const HEADERS: Record<string, keyof SettlementRaw> = {
  ma_van_don: "tracking", van_don: "tracking", tracking: "tracking", tracking_no: "tracking", awb: "tracking",
  ma_don: "order", so_don: "order", order: "order", order_number: "order",
  so_tien: "amount", tien_ve: "amount", amount: "amount", cod: "amount", cod_amount: "amount",
  ngay_ve: "date", ngay: "date", ngay_doi_soat: "date", date: "date", remitted_at: "date",
  tien_te: "currency", currency: "currency",
};
export type SettlementRaw = { tracking?: string; order?: string; amount?: string; date?: string; currency?: string };
export type PasteRow = { rowNo: number; raw: SettlementRaw };

export class PasteError extends Error {}

/** Bảng dán → các dòng có dữ liệu (rowNo = số dòng trong bảng gốc, tính cả tiêu đề). Lỗi cấu trúc → PasteError. */
export function parseSettlementPaste(text: string): PasteRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let skipped = 0;
  while (lines.length && !lines[0].trim()) (lines.shift(), skipped++);
  if (!lines.length) throw new PasteError("Chưa dán dữ liệu");
  const sep = lines[0].includes("\t") ? "\t" : ",";
  // ponytail: CSV tách phẩy đơn giản, không hiểu ô có ngoặc kép — số tiền có dấu phẩy nghìn thì dán dạng tab từ Excel.
  const [head, ...body] = lines.map((l) => l.split(sep));
  const cols = head.map((h) => HEADERS[fold(h)]);
  if (!cols.includes("amount") || !cols.includes("date") || !(cols.includes("tracking") || cols.includes("order")))
    throw new PasteError("Thiếu cột: cần ma_van_don hoặc ma_don, so_tien, ngay_ve (dòng đầu là tiêu đề)");
  const rows = body
    .map((cells, i) => ({ rowNo: i + 2 + skipped, raw: Object.fromEntries(cols.flatMap((k, j) => (k && cells[j]?.trim() ? [[k, cells[j].trim()]] : []))) as SettlementRaw }))
    .filter((r) => Object.keys(r.raw).length);
  if (!rows.length) throw new PasteError("Bảng chưa có dòng dữ liệu");
  if (rows.length > MAX_ROWS) throw new PasteError(`Tối đa ${MAX_ROWS} dòng mỗi lần`);
  return rows;
}

/**
 * Số tiền dạng chữ → chuỗi thập phân chuẩn ("1234.5"). Nhận "1,234.50", "1.234,50", "1 234,5", "163", "13.200" (KWD 3 số lẻ).
 * Có cả "." và "," → dấu đứng sau là dấu thập phân. Chỉ một loại dấu: "," → thập phân nếu không đúng 3 chữ số sau; "." luôn là thập phân
 * (tiền COD Trung Đông có KWD 3 số lẻ: "13.200" là 13,2 chứ không phải 13.200). Âm, rỗng, chữ → null.
 */
export function parseAmount(s: string | undefined): string | null {
  if (s == null) return null;
  let t = s.trim().replace(/[\s\u00a0]/g, "").replace(/^[A-Za-z]{3}|[A-Za-z]{3}$/g, "");
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  const lastDot = t.lastIndexOf("."), lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    t = t.split(thou).join("");
    if (dec === ",") t = t.replace(",", ".");
  } else if (lastComma >= 0) {
    const parts = t.split(",");
    if (parts.length > 2 && parts.slice(1).some((p) => p.length !== 3)) return null; // "12,34,56" — không phải nhóm nghìn
    t = parts.length > 2 || parts[1].length === 3 ? parts.join("") : parts.join(".");
  }
  if ((t.match(/\./g) ?? []).length > 1) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return t.replace(/^0+(?=\d)/, "");
}

/** "dd/mm/yyyy" hoặc "yyyy-mm-dd" (giờ "hh:mm[:ss]" tùy chọn, coi là UTC như mọi mốc của báo cáo; giây bỏ qua) → Date; ngày/giờ không có thật → null. */
export function parseDay(s: string | undefined): Date | null {
  const t = s?.trim() ?? "";
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::[0-5]\d)?)?$/);
  let y: number, mo: number, d: number, h = 0, mi = 0;
  if (m) [d, mo, y, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)];
  else {
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::[0-5]\d(?:\.\d+)?)?Z?)?$/);
    if (!m) return null;
    [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)];
  }
  if (h > 23 || mi > 59) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

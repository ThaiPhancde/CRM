// Định dạng hiển thị: tiền theo đơn vị tiền tệ, ngày giờ theo tiếng Việt (ui-design-system mục 1.5).
import { BASE_CURRENCY } from "./money";

// Số chữ số lẻ theo ISO 4217 cho các đồng tiền đang dùng.
const DIGITS: Record<string, number> = { KWD: 3, VND: 0 };

export function money(v: string | number | null | undefined, currency: string) {
  if (v == null) return "—";
  const digits = DIGITS[currency] ?? 2;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v));
}
/** Giá trị đã quy ra tiền quy đổi chung (VND, D-44). */
export const base = (v: string | number | null | undefined) => money(v, BASE_CURRENCY);
export const dateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const date = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");
export const num = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
/** "3 phút trước" — cho thời điểm đồng bộ gần nhất. */
export function ago(d: Date | string | null | undefined) {
  if (!d) return "Chưa chạy";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}

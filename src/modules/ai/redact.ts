// Lọc trước khi gửi prompt / ghi nhật ký AI (HLD §8.4): bí mật luôn xóa; SĐT/email che khi người dùng thiếu customer.pii.
// Hàm thuần — có bảng test. Đây là lớp phòng thủ thứ hai: service đã che PII theo quyền trước khi dữ liệu vào ngữ cảnh.
import { maskEmail, maskPhone } from "@/lib/phone";

const SECRETS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g, // khóa API kiểu sk-...
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\b(?:api[_-]?key|token|secret|password|passwd|mat khau|mật khẩu)\s*[:=]\s*\S+/gi,
  /\b[a-z]+:\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi, // URL có user:pass (chuỗi kết nối DB)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\b[A-Fa-f0-9]{40,}\b/g, // chuỗi hex dài (khóa/băm)
];
const PHONE = /\+?\d[\d\s.-]{7,}\d/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redactText(s: string, opts: { pii: boolean }): string {
  let out = s;
  for (const re of SECRETS) out = out.replace(re, "[đã ẩn]");
  if (!opts.pii) out = out.replace(EMAIL, (e) => maskEmail(e) ?? "[email]").replace(PHONE, (p) => maskPhone(p.replace(/[\s.-]/g, "")) ?? "[sđt]");
  return out;
}

/** Áp redactText cho mọi chuỗi trong một giá trị JSON (ngữ cảnh gửi model). */
export function redactDeep<T>(v: T, opts: { pii: boolean }): T {
  if (typeof v === "string") return redactText(v, opts) as T;
  if (Array.isArray(v)) return v.map((x) => redactDeep(x, opts)) as T;
  if (v && typeof v === "object" && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x, opts)])) as T;
  return v;
}

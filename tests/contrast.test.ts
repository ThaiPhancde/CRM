// Tương phản màu WCAG AA (checklist mục 12, Phase 11.2): đọc token thật trong globals.css, kiểm các cặp chữ/nền đang dùng trong giao diện.
// Chữ thường cần ≥ 4,5:1; viền ô nhập/thành phần không phải chữ ≥ 3:1 (WCAG 1.4.11).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(0, css.indexOf("}"));
const tok = (name: string) => {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`thiếu token --${name}`);
  return m[1];
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const WHITE = "#ffffff";

describe("Phase 11.2 — tương phản AA", () => {
  // [chữ, nền, nơi dùng]
  const TEXT: [string, string, string][] = [
    ["fg", "bg", "chữ chính"], ["fg", "bg-subtle", "đầu bảng"], ["fg", "bg-muted", "hàng được rê chuột"],
    ["fg-muted", "bg", "chữ phụ"], ["fg-muted", "bg-subtle", "chữ phụ trên đầu bảng"], ["fg-subtle", "bg", "gợi ý, mốc thời gian"], ["fg-subtle", "bg-subtle", "gợi ý trên nền xám nhạt"],
    ["brand-active", "bg", "liên kết"], ["brand", "brand-soft", "tab/chip đang chọn (chữ cam trên nền cam nhạt)"],
    ["success", "bg", "chữ thành công"], ["success", "success-soft", "nhãn thành công"], ["warning", "bg", "chữ cảnh báo"], ["warning", "warning-soft", "nhãn cảnh báo"],
    ["danger", "bg", "chữ lỗi"], ["danger", "danger-soft", "nhãn lỗi"], ["info", "bg", "chữ thông tin"], ["info", "info-soft", "nhãn thông tin"],
  ];
  it.each(TEXT)("%s trên %s (%s) ≥ 4,5:1", (fg, bg) => expect(ratio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5));
  it("chữ trắng trên nút chính (nền --brand) ≥ 4,5:1", () => expect(ratio(WHITE, tok("brand"))).toBeGreaterThanOrEqual(4.5));
  it("viền focus bàn phím (--brand, globals.css) trên nền ≥ 3:1", () => {
    expect(css).toMatch(/focus-visible \{[^}]*outline: 2px solid var\(--brand\)/);
    expect(ratio(tok("brand"), tok("bg"))).toBeGreaterThanOrEqual(3);
  });
  it("viền ô nhập (--border-input) ≥ 3:1 trên nền trắng và nền xám nhạt, áp cho mọi input/select/textarea", () => {
    expect(ratio(tok("border-input"), tok("bg"))).toBeGreaterThanOrEqual(3);
    expect(ratio(tok("border-input"), tok("bg-subtle"))).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/select, textarea \{ border-color: var\(--border-input\) !important; \}/);
  });
});

// PurchasingLink (D-25): đọc giá vốn và tồn khả dụng từ Purchasing System — CRM chỉ đọc, không ghi.
// Demo: fixtures/purchasing.json (scripts/gen-purchasing.ts, hạt cố định). Thật: PURCHASING_LINK=api trả 501 (docs/demo-strategy.md) — Purchasing System chưa có API (Q-16),
// endpoint chưa xác minh nên không bịa; khi có tài liệu thì cài nhánh live ở đây, phần còn lại của CRM không đổi.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { HttpError } from "@/lib/errors";

export type PurchasingItem = { cost: string; currency: string; stock: Record<string, number> };
export interface PurchasingLink {
  /** Giá vốn + tồn theo thị trường cho các SKU; SKU Mua hàng không biết → không có trong Map. */
  items(skus: string[]): Promise<Map<string, PurchasingItem>>;
  /** Thời điểm dữ liệu Mua hàng (độ mới hiện trên trang). */
  asOf(): Promise<string | null>;
}

let cache: { asOf: string | null; items: Record<string, PurchasingItem> } | null = null;
const fixture = () => {
  if (!cache) {
    const f = path.join(process.cwd(), "fixtures", "purchasing.json");
    cache = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { asOf: null, items: {} };
  }
  return cache!;
};

const replay: PurchasingLink = {
  async items(skus) { const t = fixture().items; return new Map(skus.filter((s) => s in t).map((s) => [s, t[s]])); },
  async asOf() { return fixture().asOf; },
};
const live: PurchasingLink = {
  async items() { throw new HttpError(501, "PurchasingLink thật chưa bật — Purchasing System chưa có API (Q-16). Dùng PURCHASING_LINK=fixture."); },
  async asOf() { return null; },
};

export const getPurchasing = (): PurchasingLink => (process.env.PURCHASING_LINK === "api" ? live : replay);

/** Tồn khả dụng cộng mọi thị trường (bước "Kiểm tồn" của hành trình). */
export async function available(skus: string[]) {
  const m = await getPurchasing().items(skus);
  return new Map([...m].map(([sku, it]) => [sku, Object.values(it.stock).reduce((a, b) => a + b, 0)]));
}

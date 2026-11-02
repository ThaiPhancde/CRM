// Tồn khả dụng theo SKU (HLD §8.5 "kiểm tra tồn"). Demo: đọc fixtures/inventory.json (sinh tất định từ danh mục).
// Thật: PurchasingLink đọc từ Purchasing System (Phase 10) — endpoint chưa xác minh, không bịa; INVENTORY=purchasing trả 501.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { HttpError } from "@/lib/errors";

export interface Inventory {
  /** Số lượng khả dụng theo SKU; SKU không biết → không có trong Map. */
  available(skus: string[]): Promise<Map<string, number>>;
}

let cache: Record<string, number> | null = null;
const fixture = () => {
  if (!cache) {
    const f = path.join(process.cwd(), "fixtures", "inventory.json");
    cache = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, number>) : {};
  }
  return cache;
};

const replay: Inventory = { async available(skus) { const t = fixture(); return new Map(skus.filter((s) => s in t).map((s) => [s, t[s]])); } };
const purchasing: Inventory = { async available() { throw new HttpError(501, "PurchasingLink chưa bật (Phase 10) — dùng INVENTORY=replay cho demo."); } };

export const getInventory = (): Inventory => (process.env.INVENTORY === "purchasing" ? purchasing : replay);

// Sinh fixtures/purchasing.json (D-18: hạt cố định) — dữ liệu giả lập của Purchasing System cho PurchasingLink bản replay.
// Mỗi SKU: giá vốn hiện hành (USD, lệch nhẹ so với danh mục để thấy "lấy giá vốn" có tác dụng) + tồn khả dụng theo thị trường brand bán.
// Chạy: npx tsx scripts/gen-purchasing.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Catalog = { products: { brand: string; variants: { sku: string; cost_usd: string }[] }[] };
const BRAND_MARKETS: Record<string, string[]> = { LUMI: ["AE", "SA", "KW"], NOVA: ["US"], ORBI: ["DE", "FR"] };

let seed = 20261102;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31);

const cat = JSON.parse(readFileSync(path.join("fixtures", "catalog.json"), "utf8")) as Catalog;
const items: Record<string, { cost: string; currency: string; stock: Record<string, number> }> = {};
for (const p of cat.products)
  for (const v of p.variants) {
    const drift = rnd() < 0.3 ? 1 + (rnd() * 0.16 - 0.06) : 1;
    const stock: Record<string, number> = {};
    for (const m of BRAND_MARKETS[p.brand] ?? []) {
      const r = rnd();
      stock[m] = r < 0.12 ? 0 : r < 0.3 ? 1 + Math.floor(rnd() * 9) : 10 + Math.floor(rnd() * 190);
    }
    items[v.sku] = { cost: (Number(v.cost_usd) * drift).toFixed(2), currency: "USD", stock };
  }
writeFileSync(path.join("fixtures", "purchasing.json"), JSON.stringify({ asOf: "2026-11-02T00:00:00Z", items }, null, 1) + "\n");
console.log(`purchasing.json: ${Object.keys(items).length} SKU`);

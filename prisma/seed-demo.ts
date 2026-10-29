// Dữ liệu demo Phase 2 (D-18): sản phẩm từ fixtures/catalog.json, kết nối cho 5 shop mẫu, cấu hình liên kết hai nguồn cho Team EU,
// sinh fixture phát lại 12 tháng rồi nạp qua ĐÚNG luồng đồng bộ thật (không insert thẳng vào Order).
// Chạy sau `npm run db:seed`. Chạy lại được: kết nối/sản phẩm đã có thì giữ; bản ghi đã nhận bị loại (DUPLICATE).
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { generate } from "../scripts/gen-fixtures";
import { runSync } from "../src/modules/connectors/service";
import { resolveAllCustomers } from "../src/modules/customers/resolve";
import { workspaceDb } from "../src/lib/db";
import { seedSales } from "../scripts/seed-sales";
import { seedService } from "../scripts/seed-service";

const db = new PrismaClient();
type Catalog = { products: { code: string; brand: string; category: string; name_vi: string; name_en: string; name_ar?: string; variants: { sku: string; attributes: Record<string, string>; cost_usd: string }[] }[] };

async function main() {
  const catalog = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "catalog.json"), "utf8")) as Catalog;
  const brands = await db.brand.findMany();
  for (const b of brands) {
    for (const p of catalog.products.filter((x) => x.brand === b.code)) {
      const prod = await db.product.upsert({
        where: { workspaceId_code: { workspaceId: b.workspaceId, code: p.code } },
        update: {},
        create: { workspaceId: b.workspaceId, brandId: b.id, code: p.code, name: p.name_vi, nameEn: p.name_en, nameAr: p.name_ar, category: p.category },
      });
      for (const v of p.variants) {
        await db.variant.upsert({
          where: { workspaceId_sku: { workspaceId: b.workspaceId, sku: v.sku } },
          update: {},
          create: { workspaceId: b.workspaceId, productId: prod.id, sku: v.sku, attributes: v.attributes, costPrice: v.cost_usd, costCurrency: "USD" },
        });
      }
    }
  }

  const eu = await db.workspace.findUnique({ where: { code: "TEAM-EU" } });
  if (eu) {
    // Hư cấu cho demo (D-28): đơn Shopify của Orbi được Pancake xử lý; Pancake ghi "Đơn từ Shopify #mã" trong ghi chú.
    const settings: [string, Prisma.InputJsonValue][] = [
      ["linkRules", [{ platformA: "shopify", fieldA: "orderNumber", platformB: "pancake", fieldB: "refs" }]],
      ["sourceOfTruth", { fulfillment: "pancake" }],
    ];
    for (const [key, value] of settings) {
      await db.setting.upsert({ where: { workspaceId_key: { workspaceId: eu.id, key } }, update: {}, create: { workspaceId: eu.id, key, value } });
    }
  }

  const summary = generate(path.join(process.cwd(), "fixtures", "replay"));
  console.log("fixture:", summary);

  const stores = await db.store.findMany({ include: { connections: true } });
  for (const s of stores) {
    const conn = s.connections[0] ?? (await db.connection.create({ data: { workspaceId: s.workspaceId, storeId: s.id, platform: s.platform, mode: "replay", pollIntervalMin: 15 } }));
    const t = Date.now();
    const r = await runSync(s.workspaceId, conn.id, "INCREMENTAL");
    console.log(`${s.code}: ${JSON.stringify(r.counts)} nghi_trung=${r.reviews} (${Math.round((Date.now() - t) / 1000)}s)`);
  }
  // Phase 3: đơn nhập trước khi có Customer 360 (DB cũ) được gắn khách; DB mới thì đã gắn lúc nhập, bước này không làm gì.
  for (const w of await db.workspace.findMany()) await resolveAllCustomers(workspaceDb(w.id));
  const [orders, links, reviews, customers, customerReviews] = await Promise.all([
    db.order.count(), db.sourceOrderLink.count(), db.orderLinkReview.count({ where: { status: "PENDING" } }),
    db.customer.count({ where: { mergedIntoId: null } }), db.customerReview.count({ where: { status: "PENDING" } }),
  ]);
  // Phase 4: kịch bản + nhu cầu mua kèm hội thoại (sau khi có khách để gắn).
  console.log("nhu cầu mua:", await seedSales());
  // Phase 5: bài tri thức + ticket kèm hội thoại.
  console.log("chăm sóc:", await seedService());
  console.log(`xong: đơn=${orders} liên kết nguồn=${links} đơn chờ xác minh=${reviews} khách=${customers} khách chờ xác minh=${customerReviews}`);
}

main().finally(() => db.$disconnect());

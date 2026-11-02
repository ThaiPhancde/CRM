// Sản phẩm (Phase 10, D-58): danh mục chung + ánh xạ mã nguồn, giá vốn và tồn khả dụng theo thị trường đọc qua PurchasingLink,
// cảnh báo tồn thấp theo thị trường. CRM chỉ đọc Mua hàng; "lấy giá vốn" ghi giá vào danh mục CRM (nguồn của CM-01), có audit.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getPurchasing } from "@/adapters/purchasing";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";

/** Ngưỡng tồn thấp mặc định (đơn vị/ thị trường) khi team chưa cấu hình Setting "inventory.lowStock" (D-58). */
export const DEFAULT_LOW_STOCK = 10;
export const PRODUCT_PAGE = 50;

export const productFilter = z.object({
  q: z.string().trim().max(60).optional().catch(undefined).transform((v) => v || undefined),
  brand: z.string().trim().max(40).optional().catch(undefined).transform((v) => v || undefined),
  market: z.string().trim().max(8).optional().catch(undefined).transform((v) => v || undefined),
  low: z.enum(["1"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type ProductFilter = z.infer<typeof productFilter>;

/** Ngưỡng tồn thấp theo thị trường: Setting { "*": 10, "KW": 5 } — thị trường không ghi dùng "*". */
export async function lowStockThresholds() {
  const s = await db.setting.findFirst({ where: { key: "inventory.lowStock" } });
  const v = (s?.value ?? {}) as Record<string, number>;
  return (market: string) => (typeof v[market] === "number" ? v[market] : typeof v["*"] === "number" ? v["*"] : DEFAULT_LOW_STOCK);
}

/** Thị trường của team (cột tồn hiện theo thứ tự này). */
const teamMarkets = async () => (await db.market.findMany({ select: { code: true }, orderBy: { code: "asc" } })).map((m) => m.code);

type VariantView = {
  id: string; sku: string; attributes: Record<string, string>; sold: number; mappings: number;
  cost: string | null; costCurrency: string | null; purchasingCost: string | null; purchasingCurrency: string | null; costDiffers: boolean;
  stock: Record<string, number | null>; low: string[]; known: boolean;
};

async function variantViews(u: SessionUser, variants: { id: string; sku: string; attributes: Prisma.JsonValue; costPrice: Prisma.Decimal | null; costCurrency: string | null; _count: { items: number; mappings: number } }[], markets: string[]) {
  const [pur, thr] = await Promise.all([getPurchasing().items(variants.map((v) => v.sku)), lowStockThresholds()]);
  const money = can(u.roles, "finance.view");
  return variants.map((v): VariantView => {
    const p = pur.get(v.sku);
    const stock = Object.fromEntries(markets.map((m) => [m, p ? (p.stock[m] ?? null) : null]));
    const low = markets.filter((m) => stock[m] != null && stock[m]! < thr(m));
    const differs = !!p && (v.costPrice == null || !v.costPrice.eq(p.cost) || v.costCurrency !== p.currency);
    return {
      id: v.id, sku: v.sku, attributes: (v.attributes ?? {}) as Record<string, string>, sold: v._count.items, mappings: v._count.mappings,
      cost: money ? (v.costPrice?.toString() ?? null) : null, costCurrency: money ? v.costCurrency : null,
      purchasingCost: money && p ? p.cost : null, purchasingCurrency: money && p ? p.currency : null, costDiffers: money && differs,
      stock, low, known: !!p,
    };
  });
}

const variantSelect = { id: true, sku: true, attributes: true, costPrice: true, costCurrency: true, _count: { select: { items: true, mappings: true } } } as const;

export async function listProducts(u: SessionUser, f: ProductFilter) {
  requirePerm(u, "product.view");
  const where: Prisma.ProductWhereInput = {
    ...(f.brand ? { brandId: f.brand } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } }] } : {}),
  };
  const [all, markets, brands, unmatched, asOf] = await Promise.all([
    // ponytail: danh mục cỡ trăm SKU — đọc hết rồi lọc "tồn thấp" sau khi có tồn từ Mua hàng; danh mục nghìn SKU thì lọc tồn phía Mua hàng.
    db.product.findMany({ where, orderBy: [{ brand: { code: "asc" } }, { code: "asc" }], select: { id: true, code: true, name: true, nameEn: true, category: true, brand: { select: { id: true, code: true, name: true } }, variants: { orderBy: { sku: "asc" }, select: variantSelect } } }),
    teamMarkets(),
    db.brand.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    db.orderItem.groupBy({ by: ["sourceSku"], where: { variantId: null }, _count: true }),
    getPurchasing().asOf(),
  ]);
  const shown = f.market ? markets.filter((m) => m === f.market) : markets;
  const views = await Promise.all(all.map(async (p) => ({ ...p, variants: await variantViews(u, p.variants, shown) })));
  const filtered = f.low ? views.filter((p) => p.variants.some((v) => v.low.length)) : views;
  const lowByMarket = Object.fromEntries(shown.map((m) => [m, views.reduce((s, p) => s + p.variants.filter((v) => v.low.includes(m)).length, 0)]));
  return {
    rows: filtered.slice((f.page - 1) * PRODUCT_PAGE, f.page * PRODUCT_PAGE).map((p) => ({ id: p.id, code: p.code, name: p.name, nameEn: p.nameEn, category: p.category, brand: p.brand, variants: p.variants })),
    total: filtered.length, page: f.page, pageSize: PRODUCT_PAGE, markets: shown, brands,
    summary: { products: views.length, variants: views.reduce((s, p) => s + p.variants.length, 0), lowByMarket, unmatchedSkus: unmatched.length, costDiffers: views.reduce((s, p) => s + p.variants.filter((v) => v.costDiffers).length, 0) },
    asOf, canMap: can(u.roles, "product.map"), canSync: can(u.roles, "product.sync"), showMoney: can(u.roles, "finance.view"),
    /** Biến thể để chọn khi ánh xạ mã nguồn (cả danh mục, không theo trang). */
    variantOptions: can(u.roles, "product.map") ? views.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${v.sku} — ${p.name}` }))) : [],
  };
}

export async function getProduct(u: SessionUser, id: string, now = new Date()) {
  requirePerm(u, "product.view");
  const p = await db.product.findFirst({
    where: { id },
    select: { id: true, code: true, name: true, nameEn: true, nameAr: true, category: true, active: true, brand: { select: { code: true, name: true } },
      variants: { orderBy: { sku: "asc" }, select: { ...variantSelect, mappings: { select: { sourceSku: true, connectionId: true } } } } },
  });
  if (!p) throw new HttpError(404, "Không tìm thấy sản phẩm");
  const markets = await teamMarkets();
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [views, conns, sold90] = await Promise.all([
    variantViews(u, p.variants, markets),
    db.connection.findMany({ where: { id: { in: [...new Set(p.variants.flatMap((v) => v.mappings.map((m) => m.connectionId)))] } }, select: { id: true, platform: true, store: { select: { name: true } } } }),
    db.orderItem.groupBy({ by: ["variantId"], where: { variantId: { in: p.variants.map((v) => v.id) }, order: { bookedAt: { gte: since }, status: { not: "CANCELLED" } } }, _sum: { qty: true, qtyDelivered: true } }),
  ]);
  const cn = new Map(conns.map((c) => [c.id, `${c.store.name} (${c.platform})`]));
  const s90 = new Map(sold90.map((s) => [s.variantId!, s._sum]));
  return {
    ...p, markets, asOf: await getPurchasing().asOf(), showMoney: can(u.roles, "finance.view"), canSync: can(u.roles, "product.sync"),
    variants: views.map((v, i) => ({
      ...v, qty90: s90.get(v.id)?.qty ?? 0, delivered90: s90.get(v.id)?.qtyDelivered ?? 0,
      sources: p.variants[i].mappings.map((m) => ({ sourceSku: m.sourceSku, connection: cn.get(m.connectionId) ?? m.connectionId })),
    })),
  };
}

/** Mã SKU nguồn có trong đơn mà chưa khớp biến thể nào (nhiều dòng đơn nhất lên đầu). */
export async function unmatchedSkus(u: SessionUser) {
  requirePerm(u, "product.view");
  const rows = await db.orderItem.groupBy({ by: ["sourceSku"], where: { variantId: null }, _count: true, _max: { name: true }, orderBy: { _count: { sourceSku: "desc" } }, take: 100 });
  return rows.map((r) => ({ sourceSku: r.sourceSku, lines: r._count, name: r._max.name }));
}

export const mapSkuSchema = z.object({
  sourceSku: z.string().trim().min(1, "Thiếu mã nguồn").max(120),
  variantId: z.string().trim().min(1, "Chọn biến thể"),
});

/** Gắn mã nguồn vào biến thể: dòng đơn đang chưa khớp nhận biến thể, mỗi kết nối có đơn chứa mã này thêm một ánh xạ. Làm lại → 0 dòng. */
export async function mapSourceSku(u: SessionUser, input: unknown) {
  requirePerm(u, "product.map");
  const d = parse(mapSkuSchema, input);
  const v = await db.variant.findFirst({ where: { id: d.variantId }, select: { id: true, sku: true } });
  if (!v) throw new ValidationError({ variantId: "Không tìm thấy biến thể" });
  const conns = await db.sourceOrderLink.findMany({ where: { order: { items: { some: { sourceSku: d.sourceSku, variantId: null } } } }, select: { connectionId: true }, distinct: ["connectionId"] });
  return db.$transaction(async (tx) => {
    const taken = await tx.sourceProductMapping.findMany({ where: { sourceSku: d.sourceSku, connectionId: { in: conns.map((c) => c.connectionId) }, variantId: { not: v.id } }, select: { connectionId: true } });
    if (taken.length) throw new HttpError(409, `Mã ${d.sourceSku} đã ánh xạ sang biến thể khác ở ${taken.length} kết nối`);
    await tx.sourceProductMapping.createMany({ data: conns.map((c) => ({ connectionId: c.connectionId, sourceSku: d.sourceSku, variantId: v.id })) as Prisma.SourceProductMappingCreateManyInput[], skipDuplicates: true });
    const r = await tx.orderItem.updateMany({ where: { sourceSku: d.sourceSku, variantId: null }, data: { variantId: v.id } });
    await audit(tx, { actorId: u.id, entity: "Variant", entityId: v.id, action: "product.map", after: { sourceSku: d.sourceSku, sku: v.sku, lines: r.count, connections: conns.length } });
    return { lines: r.count, connections: conns.length };
  });
}

/** Ghi giá vốn hiện hành của Mua hàng vào danh mục (chỉ biến thể có giá khác). Chạy lại khi không đổi → 0. */
export async function syncCosts(u: SessionUser) {
  requirePerm(u, "product.sync");
  const variants = await db.variant.findMany({ select: { id: true, sku: true, costPrice: true, costCurrency: true } });
  const pur = await getPurchasing().items(variants.map((v) => v.sku));
  const changes = variants.flatMap((v) => {
    const p = pur.get(v.sku);
    return p && (v.costPrice == null || !v.costPrice.eq(p.cost) || v.costCurrency !== p.currency) ? [{ v, p }] : [];
  });
  if (!changes.length) return { updated: 0 };
  await db.$transaction(async (tx) => {
    for (const { v, p } of changes) await tx.variant.update({ where: { id: v.id }, data: { costPrice: p.cost, costCurrency: p.currency } });
    await audit(tx, { actorId: u.id, entity: "Variant", entityId: "*", action: "product.syncCosts", before: changes.map((c) => ({ sku: c.v.sku, cost: c.v.costPrice?.toString() ?? null, currency: c.v.costCurrency })), after: changes.map((c) => ({ sku: c.v.sku, cost: c.p.cost, currency: c.p.currency })) });
  });
  return { updated: changes.length };
}

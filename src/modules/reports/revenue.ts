// REV-01..04 theo nhóm qua Warehouse — một hàm cho báo cáo tài chính, dashboard và tổng REV-03 trên /don-hang (khớp số theo cấu tạo).
import { getWarehouse } from "@/adapters/warehouse";
import { revenueSql, type RevenueGroup } from "@/adapters/warehouse/reports";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { rangeParams, toReportCurrency, type ReportFilter } from "./period";

export const n = (v: unknown) => (v == null ? 0 : Number(v));
export const nn = (v: unknown) => (v == null ? null : Number(v));
export function params(u: SessionUser, f: Pick<ReportFilter, "from" | "to" | "brand" | "store" | "market">, extra: Record<string, unknown> = {}) {
  return { ws: u.workspaceId, ...rangeParams(f), brand: f.brand, store: f.store, market: f.market, ...extra };
}
export async function labels(kind: "brand" | "market" | "store" | "user", ids: string[]) {
  const uniq = [...new Set(ids.filter((x) => x && x !== "—"))];
  if (!uniq.length) return new Map<string, string>();
  const rows =
    kind === "brand" ? await db.brand.findMany({ where: { id: { in: uniq } }, select: { id: true, code: true } }).then((r) => r.map((x) => [x.id, x.code]))
    : kind === "market" ? await db.market.findMany({ where: { id: { in: uniq } }, select: { id: true, code: true } }).then((r) => r.map((x) => [x.id, x.code]))
    : kind === "store" ? await db.store.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } }).then((r) => r.map((x) => [x.id, x.name]))
    : await db.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } }).then((r) => r.map((x) => [x.id, x.name]));
  return new Map(rows as [string, string][]);
}

type RevRaw = { key: string; cur: string; rev01: unknown; orig01: unknown; orders: unknown; rev02: unknown; confirmed: unknown; rev03: unknown; orig03: unknown; delivered: unknown; rev04: unknown; refunds: unknown };
const SUMS = ["rev01", "orig01", "orders", "rev02", "confirmed", "rev03", "orig03", "delivered", "rev04", "refunds"] as const;

/** Một truy vấn (nhóm × tiền tệ gốc) → gộp theo `by`: "key" (bảng theo nhóm) hoặc "cur" (bảng theo nguyên tệ). */
function fold(raw: RevRaw[], by: "key" | "cur") {
  type Acc = Record<(typeof SUMS)[number], number>;
  const m = new Map<string, Acc>();
  for (const r of raw) {
    const k = r[by];
    const acc = m.get(k) ?? (Object.fromEntries(SUMS.map((s) => [s, 0])) as Acc);
    for (const s of SUMS) acc[s] += n(r[s]);
    m.set(k, acc);
  }
  return [...m.entries()].map(([key, v]) => ({ key, ...v }));
}

/** REV-01..04 theo (nhóm × tiền tệ gốc) qua Warehouse — một truy vấn cho cả hai bảng của báo cáo tài chính. */
export async function revenueCube(u: SessionUser, f: ReportFilter, group: RevenueGroup) {
  const wh = getWarehouse();
  return wh.read<RevRaw>(revenueSql(wh.dialect, group), params(u, f));
}

/** REV-01..04 theo nhóm (hoặc theo nguyên tệ khi byCurrency), quy tiền tệ báo cáo. Cùng hàm cho báo cáo tài chính, dashboard, /don-hang. */
export async function revenueRows(u: SessionUser, f: ReportFilter, group: RevenueGroup, rateToBase: number | null, cube?: RevRaw[], byCurrency = false) {
  const raw = cube ?? (await revenueCube(u, f, group));
  const rows = fold(raw, byCurrency ? "cur" : "key");
  const g = byCurrency ? "currency" : group;
  const money = can(u.roles, "finance.view");
  const conv = (v: number) => (money ? toReportCurrency(v, f.currency, rateToBase) : null);
  const brandIds = g === "brand_market" ? rows.map((r) => r.key.split("|")[0]) : rows.map((r) => r.key);
  const mkIds = g === "brand_market" ? rows.map((r) => r.key.split("|")[1]) : rows.map((r) => r.key);
  const [bl, ml, sl] = await Promise.all([
    g === "brand" || g === "brand_market" ? labels("brand", brandIds) : null,
    g === "market" || g === "brand_market" ? labels("market", mkIds) : null,
    g === "store" ? labels("store", rows.map((r) => r.key)) : null,
  ]);
  const name = (k: string) =>
    g === "none" ? "Tổng" : g === "brand" ? bl!.get(k) ?? "—" : g === "market" ? ml!.get(k) ?? "—" : g === "store" ? sl!.get(k) ?? k
    : g === "brand_market" ? `${bl!.get(k.split("|")[0]) ?? "—"} · ${ml!.get(k.split("|")[1]) ?? "—"}` : k;
  return rows.sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({
    key: r.key, label: name(r.key), orders: r.orders, confirmed: r.confirmed, delivered: r.delivered,
    rev01: conv(r.rev01), rev02: conv(r.rev02), rev03: conv(r.rev03), rev04: conv(r.rev04), refunds: conv(r.refunds),
    // Nguyên tệ + tỷ giá bình quân đã dùng (chỉ ở bảng theo nguyên tệ — mỗi dòng một đồng tiền).
    orig01: g === "currency" && money ? r.orig01 : null, orig03: g === "currency" && money ? r.orig03 : null,
    fx01: g === "currency" && money && r.orig01 ? r.rev01 / r.orig01 : null,
  }));
}
export type RevenueRow = Awaited<ReturnType<typeof revenueRows>>[number];

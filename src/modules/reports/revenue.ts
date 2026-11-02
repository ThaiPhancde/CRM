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

type RevRaw = { key: string; rev01: unknown; orig01: unknown; orders: unknown; rev02: unknown; confirmed: unknown; rev03: unknown; orig03: unknown; delivered: unknown; rev04: unknown; refunds: unknown };

/** REV-01..04 theo nhóm, quy tiền tệ báo cáo. Cùng hàm cho báo cáo tài chính, dashboard và tổng REV-03 trên /don-hang. */
export async function revenueRows(u: SessionUser, f: ReportFilter, group: RevenueGroup, rateToBase: number | null) {
  const wh = getWarehouse();
  const raw = await wh.read<RevRaw>(revenueSql(wh.dialect, group), params(u, f));
  const money = can(u.roles, "finance.view");
  const conv = (v: unknown) => (money ? toReportCurrency(nn(v), f.currency, rateToBase) : null);
  const brandIds = group === "brand_market" ? raw.map((r) => r.key.split("|")[0]) : raw.map((r) => r.key);
  const mkIds = group === "brand_market" ? raw.map((r) => r.key.split("|")[1]) : raw.map((r) => r.key);
  const [bl, ml, sl] = await Promise.all([
    group === "brand" || group === "brand_market" ? labels("brand", brandIds) : null,
    group === "market" || group === "brand_market" ? labels("market", mkIds) : null,
    group === "store" ? labels("store", raw.map((r) => r.key)) : null,
  ]);
  const name = (k: string) =>
    group === "none" ? "Tổng" : group === "brand" ? bl!.get(k) ?? "—" : group === "market" ? ml!.get(k) ?? "—" : group === "store" ? sl!.get(k) ?? k
    : group === "brand_market" ? `${bl!.get(k.split("|")[0]) ?? "—"} · ${ml!.get(k.split("|")[1]) ?? "—"}` : k;
  return raw.map((r) => ({
    key: r.key, label: name(r.key), orders: n(r.orders), confirmed: n(r.confirmed), delivered: n(r.delivered),
    rev01: conv(r.rev01), rev02: conv(r.rev02), rev03: conv(r.rev03), rev04: conv(r.rev04), refunds: conv(r.refunds),
    // Nguyên tệ + tỷ giá bình quân đã dùng (chỉ khi nhóm theo tiền tệ — mỗi dòng một đồng tiền).
    orig01: group === "currency" && money ? nn(r.orig01) : null, orig03: group === "currency" && money ? nn(r.orig03) : null,
    fx01: group === "currency" && money && n(r.orig01) ? n(r.rev01) / n(r.orig01) : null,
  }));
}
export type RevenueRow = Awaited<ReturnType<typeof revenueRows>>[number];


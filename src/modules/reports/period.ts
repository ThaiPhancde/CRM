// Hàm thuần cho báo cáo (có bảng test): bộ lọc kỳ, đổi tiền tệ báo cáo, xoay cohort. Không import DB — dùng được ở client.
import type { RevenueGroup } from "@/adapters/warehouse/reports";

export const REPORT_GROUPS = ["none", "brand", "market", "store", "month", "currency", "brand_market"] as const satisfies readonly RevenueGroup[];
export type ReportFilter = { from: string; to: string; brand: string | null; store: string | null; market: string | null; currency: string; group: RevenueGroup };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** Ngày có thật: đối chiếu hai chiều (V8 tự lăn "2026-02-30" sang 02/03 thay vì báo lỗi). */
const valid = (s: string | undefined) => {
  if (!s || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Ngày hôm nay theo giờ Việt Nam (UTC+7). */
export const todayVN = (now = new Date()) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const MAX_DAYS = 366;

/**
 * Bộ lọc từ query string. Mặc định: đầu tháng (theo ngày hôm nay) → hôm nay; tiền tệ VND; nhóm theo thị trường.
 * Ngày sai bị bỏ; từ > đến thì đảo; kỳ dài hơn 366 ngày thì cắt "từ" về 366 ngày trước "đến".
 */
export function parseReportFilter(sp: Record<string, string | string[] | undefined>, today: string, defaultGroup: RevenueGroup = "market"): ReportFilter {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.trim() || undefined; };
  let to = valid(one("to")) ? one("to")! : today;
  let from = valid(one("from")) ? one("from")! : `${to.slice(0, 7)}-01`;
  if (from > to) [from, to] = [to, from];
  if ((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000 > MAX_DAYS - 1) from = addDays(to, -(MAX_DAYS - 1));
  const g = one("group");
  const cur = one("currency")?.toUpperCase();
  return {
    from, to,
    brand: one("brand") ?? null, store: one("store") ?? null, market: one("market") ?? null,
    currency: cur && /^[A-Z]{3}$/.test(cur) ? cur : "VND",
    group: (REPORT_GROUPS as readonly string[]).includes(g ?? "") ? (g as RevenueGroup) : defaultGroup,
  };
}

/** Tham số SQL: kỳ [from 00:00Z, to+1 00:00Z) — đúng cách /don-hang lọc ngày. */
export const rangeParams = (f: Pick<ReportFilter, "from" | "to">) => ({ from: new Date(`${f.from}T00:00:00Z`), to: new Date(`${addDays(f.to, 1)}T00:00:00Z`) });

/** VND → tiền tệ báo cáo theo rateToBase (VND / 1 đơn vị). VND hoặc thiếu tỷ giá → giữ VND. null giữ null. */
export function toReportCurrency(vnd: number | null, currency: string, rateToBase: number | null): number | null {
  if (vnd == null) return null;
  if (currency === "VND" || !rateToBase || rateToBase <= 0) return vnd;
  return vnd / rateToBase;
}

export type CohortRow = { cohort: string; k: number; customers: number; repeat60: number };
export type CohortLine = { cohort: string; size: number; retention: (number | null)[]; repeat60Pct: number | null };
/**
 * Xoay cohort: mỗi tháng đầu mua một dòng; retention[k] = % khách của cohort còn mua ở tháng thứ k (k = 0..6), null khi tháng đó
 * chưa tới (sau tháng của `today`). Dòng k = -1 là tổng mua lại 60 ngày. repeat60Pct = % khách có đơn hợp lệ thứ 2 trong 60 ngày (CUS-03).
 */
export function pivotCohort(rows: CohortRow[], today: string, months = 7): CohortLine[] {
  const by = new Map<string, CohortRow[]>();
  for (const r of rows) by.set(r.cohort, [...(by.get(r.cohort) ?? []), r]);
  const idx = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));
  const now = idx(today.slice(0, 7));
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cohort, rs]) => {
    const size = rs.find((r) => r.k === 0)?.customers ?? 0;
    const r60 = rs.find((r) => r.k === -1)?.repeat60 ?? 0; // dòng tổng của cohort (xem cohortSql)
    return {
      cohort, size,
      retention: Array.from({ length: months }, (_, k) => (idx(cohort) + k > now ? null : size ? Math.round(((rs.find((r) => r.k === k)?.customers ?? 0) / size) * 1000) / 10 : 0)),
      repeat60Pct: size ? Math.round((r60 / size) * 1000) / 10 : null,
    };
  });
}

/** Tỷ lệ % một chữ số thập phân; mẫu 0 → null (hiển thị "—"). */
export const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : null);

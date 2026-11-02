# 08 — Work order: Phase 9 two report sections + period table tests (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Split **70/30** (D-54) — this batch is deliberately small (Phase 8 drifted to ~52% Gemini by
> lines). Claude built the report SQL, services, the report shell/table/chart components and four sections. Acceptance: Claude.

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Each job delivers only its files.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`.
2. THE CONTRACT (use exactly, do not edit): `src/modules/reports/service.ts` (`fulfillmentReport`, `aiReport`, `ReportContext`),
   `src/modules/reports/period.ts`, `src/app/(app)/bao-cao/report-ui.tsx` (`ReportTable`, `Metric`, `Col`),
   `src/app/(app)/bao-cao/report-chart.tsx` (`ReportChart`), `src/modules/ai/labels.ts` (`FEATURE_LABEL`), `src/components/ui.tsx` (`StatCard`).
3. Examples to copy the style from EXACTLY: `src/app/(app)/bao-cao/[nhom]/sections/sales.tsx`, `.../sections/marketing.tsx`.

## 2. Hard rules

You MUST:
- Create/modify ONLY the files in your brief. Sections are async server components with the same props as the examples:
  `{ user: SessionUser; f: ReportFilter; ctx: ReportContext }`. Never import `db`, `rootDb`, `workspaceDb`, `@prisma/client` values.
- Every chart has the matching `ReportTable` with the SAME rows below it (chart and table must show the same numbers).
- Metric codes next to headers with `<Metric code=… defs={ctx.definitions} />`: OPS-01 (giao thành công %), OPS-02 (thất bại/hoàn %),
  OPS-03 (thời gian giao TB), OPS-04 (lý do thất bại), AI-01 (lượt chạy/token/USD), AI-02, AI-03.
- Money via `fmt: "money"` (currency = `ctx.currency`); USD for AI cost shown as `Number(x).toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + " USD"`.
- Vietnamese copy with diacritics; no raw hex colours; no new components.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p9-reports/checker.py <job> .` until `checker: OK`.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields.

## 3. Briefs

### 3.1 `report-sections` — fulfillment and AI report sections

- Outputs: `src/app/(app)/bao-cao/[nhom]/sections/van-don.tsx` (export `FulfillmentSection`), `src/app/(app)/bao-cao/[nhom]/sections/ai.tsx`
  (export `AiSection`). Both files exist as stubs — replace them.
- `FulfillmentSection`: `fulfillmentReport(user, f, ctx)`. Four `StatCard`s: Đơn xác nhận (`total.confirmed`), Giao thành công (OPS-01, `total.deliveredRate` %),
  Thất bại + hoàn (OPS-02, `total.failRate` %), Lý do thất bại hàng đầu (`reasons[0]?.label` or "—"). Chart (stacked bar, x = `label`): series
  delivered "Giao thành công", failed "Thất bại", returned "Hoàn", pending "Đang xử lý". Table "Theo thị trường": Thị trường, Đơn xác nhận, Giao thành công,
  OPS-01 %, Giao một phần, Thất bại, Hoàn, OPS-02 %, OPS-03 (`fmt: "days"`), COD đã thu (đơn), COD đã thu (money). Table "Lý do thất bại" (OPS-04): Lý do, Số lần.
  Note line under the stat cards: "Kỳ theo ngày xác nhận đơn; COD đã thu theo trạng thái thanh toán của đơn (đối soát COD ở Phase 10)."
- `AiSection`: `aiReport(user, f)`. Stat cards: Lượt chạy (AI-01, sum of `features[].total`), Thành công (% ok over total), Cần làm rõ (sum `clarify`),
  Bị từ chối quyền (AI-03, sum `denied`). If `stats` is not null also: Chi phí tháng (AI-01, `stats.ai01.usd` USD) and Chấp nhận đề xuất (AI-02,
  `stats.ai02.accepted`/`stats.ai02.total`). Chart (line, x = `day`): series runs "Lượt chạy". Table "Theo ngày": Ngày (dd/mm/yyyy), Lượt chạy, Token, Chi phí (USD 4 decimals).
  Table "Theo tính năng": Tính năng (`FEATURE_LABEL[feature]` or the raw key), Lượt chạy, Thành công %, Cần làm rõ, Bị từ chối, Lỗi, Thời gian TB (ms). Empty texts in Vietnamese.

### 3.2 `report-tests` — table tests for the pure period helpers

- Output: `tests/reports-period.test.ts` (vitest), importing from `@/modules/reports/period`.
- `it.each` tables: `parseReportFilter` (defaults: first of month → today, VND, default group; invalid dates ignored; from > to swapped; span > 366
  days clamped; currency lower-case normalised; invalid currency → VND; invalid group → default; array values take the first); `rangeParams`
  (to is the next day 00:00Z, incl. month and year ends and 2028-02-29); `addDays`; `todayVN` (UTC 16:59 vs 17:00 crossing midnight in VN);
  `toReportCurrency` (VND passthrough, null passthrough, missing/zero rate → VND, divide by rate); `pivotCohort` (k = -1 row carries repeat60;
  months after `today` are null; size 0 → 0% retention and null repeat; sorted by cohort); `pct` (0 denominator → null, one decimal rounding).
  At least 40 rows, fixed dates only. Expected values MUST follow the code; list any doubt.

## 4. Report back

Job id, files written, last line of tsc and checker, doubts.

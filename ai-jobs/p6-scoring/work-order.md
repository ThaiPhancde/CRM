# 05 — Work order: Phase 6 metrics + scoring UI, metric dictionary content, formula table tests (Gemini, headless `agy -p`)

> Written 2026-10-29 by Claude (brain). Split **50/50** from Phase 6 (D-51). One headless `agy -p` run per job via `run_agy.py`,
> mode `write`, in parallel. Acceptance: Claude, never the executor's report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Claude wrote the metric
warehouse (CustomerMetric, period R12M), scoring formulas, score versions and services. You build: metric dictionary content,
table tests for the pure scoring formulas, and the screens that show scores. Each job delivers only the files in its brief.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`; `docs/metrics.md` (the metric dictionary — source of truth for content).
2. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx` (reuse components).
3. `src/lib/format.ts` (`money(v, "VND")` / `base(v)` for VND, `dateTime`, `date`, `ago`, `num`).
4. THE CONTRACT (use exactly, do not edit): `src/modules/scoring/formulas.ts`, `src/modules/scoring/service.ts`,
   `src/modules/customers/service.ts` (`CustomerRow.rfm`), `src/modules/sales/leads.ts` (`LeadListRow.score`), server actions
   `src/app/(app)/quan-tri/diem/actions.ts`.
5. Examples: `src/app/(app)/khach-hang/[id]/page.tsx` (where the score card goes), `src/app/(app)/nhu-cau/page.tsx` + `board.tsx` +
   `[id]/page.tsx`, `src/app/(app)/quan-tri/danh-muc/view.tsx` (admin page style).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Server pages: `pageUser("<perm>")` then `bindTenant(user)` (only import allowed from `@/lib/db`), then services. Never `db`,
  `rootDb`, `workspaceDb`, `@prisma/client` values.
- Client/server boundary: `"use client"` files import values only from `@/modules/*/labels` (types via `import type`); server pages
  never import UPPER_CASE constants from `"use client"` files. Idempotency keys (if any) generated in `useEffect`.
- Use EXACT enum values and labels below; never invent new ones:
  - Score types: `SALES_PRIORITY` "Ưu tiên sales", `RFM` "RFM", `TXN_RISK` "Rủi ro giao dịch", `SUPPORT_NEED` "Nhu cầu hỗ trợ"
    (also exported as `SCORE_LABEL` from `@/modules/scoring/service` — server files may import it).
  - Bands: `CAO` "Cao", `VUA` "Vừa", `THAP` "Thấp", `CHUA_DU_DU_LIEU` "Chưa đủ dữ liệu"; RFM segments `CHAMPIONS` "Khách tốt nhất",
    `TRUNG_THANH` "Trung thành", `MOI` "Mới", `CO_NGUY_CO` "Có nguy cơ rời bỏ", `NGU_DONG` "Ngủ đông", `CAN_CHAM_SOC` "Cần chăm sóc".
  - Tones: for SALES_PRIORITY and RFM a higher score is good (CAO success, VUA warning, THAP neutral; CHAMPIONS/TRUNG_THANH success,
    MOI info, CO_NGUY_CO warning, NGU_DONG neutral, CAN_CHAM_SOC info); for TXN_RISK and SUPPORT_NEED a higher score is BAD
    (CAO danger, VUA warning, THAP success). `CHUA_DU_DU_LIEU` always neutral. Define these maps inside your own files.
- Scores are hypotheses (D-33): every score display shows "Phiên bản v{version}" and the line "Điểm là giả thuyết v1, không phải
  xác suất mua" (or for RFM "Phân hạng theo ngũ phân vị trong team"). `value === null` → show "Chưa đủ dữ liệu" + `missingData` list,
  never a number and never "rủi ro cao".
- Money fields may be `null` (viewer lacks finance permission) → show "—". Metric codes (REV-01…REV-04) shown next to money values.
- Vietnamese copy with diacritics; 4 states; captions on tables; labels on inputs; no raw hex colours; one overlay at a time.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p6-scoring/checker.py <job> .` until `checker: OK`.
  Ignore tsc errors only in files that are not yours.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields/routes; change formulas.

## 3. Style

Score card: compact `Card` with `SectionTitle`, the value big (`text-2xl tabular`), band `Badge`, version + computed time small muted;
reasons as a list "part — points/max" with a thin progress bar (`bg-brand` on `bg-bg-muted`, width = points/max) and the evidence
in muted text; `missingData` as small warning list; `suggestedAction` in a `bg-brand-soft` box "Gợi ý: …".

## 4. Briefs

### 4.1 `metrics-content` — metric dictionary JSON

- Output: `fixtures/metrics.json` — array of objects `{ "code", "group", "nameVi", "nameEn", "formula", "timeAnchor", "source", "owner", "pitfalls" }`.
- Exactly the codes in `docs/metrics.md`: REV-01..REV-04, OPS-01..OPS-04, CASH-01..CASH-03, CUS-01..CUS-06, MKT-01..MKT-04, AI-01..AI-03.
  `group` = prefix (REV, OPS, CASH, CUS, MKT, AI). `nameVi`/`formula`/`timeAnchor`/`pitfalls` in Vietnamese, faithful to the doc (do not
  invent new rules; where the doc gives no pitfall write a short sensible one or null). `nameEn` short English name. `source` = the
  tables named in the doc. `owner`: REV/CASH "Kế toán + Quản lý", OPS "Vận đơn", CUS "Quản lý", MKT "Marketing", AI "Quản lý".
  Money metrics must mention "quy VND theo tỷ giá chốt của đơn (D-44)" in `formula`.

### 4.2 `formula-tests` — table tests for the pure formulas

- Output: `tests/formulas.test.ts` (vitest; import from `@/modules/scoring/formulas`).
- Read `src/modules/scoring/formulas.ts` and test with `it.each` tables: `band3` boundaries (0, 39, 40, 69, 70, 100); `rfmSegment` (every
  segment + boundary cases); `scoreRfm` (insufficient when any of r/f/m null or deliveredOrders 0; value = r*100+f*10+m; M evidence when
  rev03 null); `scoreTxnRisk` (confirmedOrders < 2 → null; 0%, 25%, 50%, 100% failure; missing phone/email/address combinations; band);
  `scoreSupport` (0/1/2+ tickets; priority 0–4; waits 0h, 8h, 24h, 48h); `scoreLead` (insufficient case; each intent group detected in
  vi, en, ar and de — use the regexes in `INTENT_KEYWORDS`; recency 1h/48h/5 days/10 days; stage effects; readiness; total max 100 with
  default weights; custom weights scale points). At least 45 cases. Use fixed `now` dates. Expected values MUST follow the code exactly
  (compute them by hand from the formulas); if you believe a formula is wrong, keep the test matching the code and list the doubt.

### 4.3 `customer-scores` — Customer 360 score card + RFM column in the customer list

- Outputs: `src/app/(app)/khach-hang/[id]/score-card.tsx` (server component, presentational), `src/app/(app)/khach-hang/[id]/page.tsx`
  (modify), `src/app/(app)/khach-hang/page.tsx` (modify).
- 360 page: call `getCustomerScores(user, id)` (after the existing `getCustomer360`); replace the StatCard "Điểm khách hàng / Chưa đủ dữ
  liệu / Có ở Phase 6" with the RFM segment label (or "Chưa đủ dữ liệu") and hint "RFM {value} · v{version}". In the "Tổng quan" tab
  add, above the timeline, a section "Điểm & chỉ số" with three score cards (RFM, Rủi ro giao dịch, Nhu cầu hỗ trợ — via `score-card.tsx`)
  and a small "Chỉ số 12 tháng (R12M, tính lúc {dateTime(metric.asOf)})" table: REV-01 Giá trị đặt, REV-02 Xác nhận, REV-03 Giao thành
  công, REV-04 Thực thu (money or "—"), đơn / đơn giao / khách từ chối, chu kỳ mua TB (ngày, 1 decimal, "—"), mua lại trong 60 ngày
  (Có/Không), lợi nhuận gộp ("—" when null, hint "thiếu giá vốn" when showMoney but null). Empty: `metric` null → "Chưa dựng chỉ số —
  chạy job hằng ngày hoặc Quản lý bấm Tính lại ngay ở Quản trị › Điểm khách hàng".
- Customer list: add a column "Hạng RFM" showing the segment badge from `row.rfm` (null or `CHUA_DU_DU_LIEU` → muted "—").

### 4.4 `lead-scores` — lead score in list, Kanban card and detail

- Outputs: `src/app/(app)/nhu-cau/page.tsx`, `src/app/(app)/nhu-cau/board.tsx`, `src/app/(app)/nhu-cau/[id]/page.tsx` (all modify) and
  new `src/app/(app)/nhu-cau/[id]/lead-score.tsx` (server, presentational).
- List: column "Điểm" after "Giai đoạn": value + band badge from `row.score` (null → "—"). Board card: small badge "★ {value}" with the
  band tone when `lead.score?.value != null`. Detail: call `getLeadScore(user, id)` and render `lead-score.tsx` as the first card in the
  right column (title "Điểm ưu tiên sales"); null → "Chưa chấm — worker chấm trong vài phút sau khi có tương tác".

### 4.5 `score-admin` — score configuration + metric dictionary pages

- Outputs: `src/app/(app)/quan-tri/diem/page.tsx`, `src/app/(app)/quan-tri/diem/version-form.tsx`, `src/app/(app)/quan-tri/diem/recompute-button.tsx`,
  `src/app/(app)/quan-tri/chi-so/page.tsx`.
- `/quan-tri/diem` (permission `score.config`): `listScoreVersions(user)`. Header "Điểm khách hàng", crumbs Quản trị › Điểm khách hàng,
  description "Trọng số là giả thuyết (D-33). Đổi trọng số tạo phiên bản mới; điểm của phiên bản cũ giữ nguyên để so sánh." Action:
  recompute-button.tsx → `recomputeAction` (confirm "Dựng lại chỉ số và chấm điểm toàn bộ khách của team? Có thể mất vài chục giây.").
  Info line "Chỉ số tính lúc {dateTime(metricsAsOf)}" or "Chưa dựng chỉ số". One Card per type: versions table (Phiên bản, Trọng số as
  "fit 25 · intent 35 …" with Vietnamese part names: fit "Nhu cầu phù hợp", intent "Tín hiệu mua", engagement "Tương tác", readiness
  "Sẵn sàng đặt", failRate "Từ chối nhận", missingInfo "Thiếu thông tin", address "Địa chỉ", openTickets "Ticket mở", severity "Mức nghiêm
  trọng", wait "Thời gian chờ"; Ghi chú; Đang dùng badge; Số điểm đã chấm; Tạo lúc). For SALES_PRIORITY, TXN_RISK, SUPPORT_NEED a
  version-form.tsx (inline in the card, not a drawer) → `createScoreVersionAction`: hidden `type`; one number input per weight named
  `w.<key>` prefilled from the active version; live sum "Tổng: N/100" (danger when ≠ 100, submit disabled); `note` textarea required.
  RFM card has no form ("RFM không có trọng số — chia 5 bậc theo ngũ phân vị trong team").
- `/quan-tri/chi-so` (permission `catalog.view`): `listMetricDefinitions(user)`. Header "Từ điển chỉ số", description "Mọi số liệu tiền
  và doanh thu ghi mã chỉ số (L1). Quy về VND (D-44)." Group by `group` with a Card per group, table: Mã (mono), Tên (vi + en muted),
  Công thức, Mốc thời gian, Nguồn, Phụ trách, Cạm bẫy. Empty: "Chưa nạp từ điển — chạy npm run db:seed".

## 5. Report back

Job id, files written, last line of tsc and checker, contract gaps, doubts about formulas.

## 6. Acceptance (Claude)

Claude re-runs checker + tsc, reads every file (contract, masking, insufficient-data handling, version shown, tones, boundary rules),
checks every test expectation against the formulas by hand, opens pages at 1440/768, merges, `npm test`, `next build`, LEDGER rows.

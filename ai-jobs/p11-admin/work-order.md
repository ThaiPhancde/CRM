# 10 — Work order: Phase 11.1 admin pages + pure table tests (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Split **70/30** (D-54). Claude built the services (`src/modules/admin/config.ts`, `audit.ts`,
> `privacy.ts`), the server actions, the customer privacy UI and all tests of business logic. Acceptance: Claude.

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Each job delivers only its files.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`.
2. THE CONTRACT (use exactly, do not edit): `src/modules/admin/config.ts` (`getConfig`, `CHANNELS`, the zod schemas), `src/modules/admin/audit.ts`
   (`listAuditLog`, `auditFilter`, `changedKeys`, `AUDIT_PAGE`), `src/app/(app)/quan-tri/cau-hinh/actions.ts` (5 server actions, FormData field names in the comments),
   `src/components/form.tsx` (`pick`, `FormError`, `ActionResult`), `src/components/overlay.tsx` (`useToast`), `src/components/ui.tsx`, `src/lib/format.ts`,
   `src/modules/service/labels.ts` (`PRIORITY_LABEL`).
3. Examples to copy the style from EXACTLY: `src/app/(app)/khach-hang/page.tsx` (filters form, table, paging), `src/app/(app)/ai/budget-form.tsx`
   (small client form with `useActionState` + toast), `src/app/(app)/cham-soc/create-ticket.tsx` (`pick(state, original)` to keep values after an error),
   `tests/reports-period.test.ts` (table tests).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files in your brief. Server pages: `const user = await pageUser("<perm>")`, call the service; never import `db`, `rootDb`,
  `workspaceDb`, `@prisma/client` values; never query the database.
- Client forms: `"use client"`, `useActionState(<action>, null)`, toast `state.message` (success/danger), show field errors from `state.fields`,
  keep the user's values after an error (`pick` or controlled inputs — React 19 resets uncontrolled forms after every action).
- Vietnamese copy with diacritics; no raw hex colours; tables have `<caption className="sr-only">` and `scope="col"`; every input has a `<label htmlFor>`.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p11-admin/checker.py <job> .` until `checker: OK`.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields.

## 3. Briefs

### 3.1 `admin-pages` — /quan-tri/nhat-ky (rewrite) + /quan-tri/cau-hinh (new)

- Outputs: `src/app/(app)/quan-tri/nhat-ky/page.tsx` (replace completely), `src/app/(app)/quan-tri/cau-hinh/page.tsx` (new),
  `src/app/(app)/quan-tri/cau-hinh/forms.tsx` (new, client components).
- **Nhật ký** (`pageUser("admin.audit")`, `searchParams`): `const data = await listAuditLog(user, auditFilter.parse(flatten(sp)))`.
  - `PageHeader` title "Nhật ký thao tác", crumbs Hệ thống / Nhật ký, description "Mọi thay đổi của team, chỉ thêm — không sửa hay xóa được. Lọc theo người, loại bản ghi, kỳ hoặc mã bản ghi."
  - GET filter form: Người thực hiện (select `data.actors`), Loại bản ghi (select `data.entities`), Thao tác (text, placeholder "vd update, privacy.erase"),
    Mã bản ghi (text), Từ ngày / Đến ngày (`type="date"`), buttons Lọc / Đặt lại.
  - List (`<ul>` of `<details>` like the current page): summary row = action badge (label map: create "Tạo", update "Sửa", delete "Xóa", anything else shows the raw
    action in a neutral badge), entity, entityId (mono, truncated), "bởi {actor}", time `dateTime(at)`; when `reason` show it ("Lý do: …"); when `changed.length`
    show "Đổi: " + changed keys joined ", ". Body: two columns Trước / Sau as JSON `<pre>`; keys listed in `changed` must be visible as a list above the JSON
    with a `Badge tone="warning"` per key.
  - Empty: with filters "Không có thay đổi khớp bộ lọc" (+ Đặt lại link), otherwise "Chưa có thay đổi nào". Paging text "Trang x/y · N thay đổi" + prev/next links (keep params).
- **Cấu hình** (`pageUser("admin.settings")`): `const cfg = await getConfig(user)`. `PageHeader` title "Cấu hình vận hành", crumbs Hệ thống / Cấu hình,
  description "Ngưỡng SLA, phân công lead, giới hạn liên hệ, giờ làm việc theo thị trường và ngưỡng tồn thấp. Mỗi thay đổi ghi nhật ký."
  A row of links (ButtonLink): "Tỷ giá & thị trường (ngôn ngữ, múi giờ)" → `/quan-tri/danh-muc`, "Trọng số điểm" → `/quan-tri/diem`, "Ngân sách AI" → `/ai?tab=chi-phi`, "Nhật ký thay đổi" → `/quan-tri/nhat-ky?entity=Setting`.
  Five `Card` sections, each with `SectionTitle` and a one-line muted explanation:
  1. "Ngưỡng SLA ticket" — table Brand (null → "Mọi brand", else brand code) × Mức (`PRIORITY_LABEL`) × Phản hồi đầu (giờ) × Xử lý xong (giờ) × Trạng thái
     ("Mặc định" muted when `!custom`; rows of a brand with null hours show "Theo mọi brand"). Each row has an inline `SlaForm` (hidden brandId ("" for null) +
     priority, two number inputs step 0.5, button "Lưu").
  2. "Phân công lead" — `RoutingForm`: firstResponseHours (giờ phản hồi đầu), maxOpenPerUser (lead mở tối đa / Sales), autoCloseDays (tự đóng sau N ngày không tương tác, 0 = tắt),
     dedupeDays (gộp liên hệ lại trong N ngày). Under it show the rules read-only: `cfg.routing.rules` as "brand · market → nhóm" (missing = "mọi").
  3. "Giới hạn liên hệ (frequency cap)" — one `CapForm` per `cfg.caps` row: channel label, maxCount, windowDays, button Lưu; text "{maxCount} tin / {windowDays} ngày mỗi khách"; "Mặc định" when `!custom`.
  4. "Giờ làm việc theo thị trường" — `HoursForm` for market "*" (Mặc định) then one per `cfg.hours.byMarket` (code · name · timezone · locale), from/to number inputs 0–24,
     empty = "dùng mặc định {default.from}–{default.to} giờ". Explain: "Tin hành trình ngoài khung được dời tới giờ bắt đầu kế tiếp theo giờ địa phương."
  5. "Ngưỡng tồn thấp" — `LowStockForm` for "*" (Mặc định `cfg.lowStock.default`) then one per market (empty = dùng mặc định).
  `forms.tsx` exports `SlaForm`, `RoutingForm`, `CapForm`, `HoursForm`, `LowStockForm` (props = the current values), each calling its server action.

### 3.2 `admin-tests` — table tests for the pure parts

- Output: `tests/admin-pure.test.ts` (vitest), importing from `@/modules/admin/config` and `@/modules/admin/audit` (schemas and `changedKeys` only — no DB).
- `it.each` tables with `.safeParse`: `slaSchema` (resolve < first → error on resolveHours; 0 / negative / > 720 invalid; brandId "" → null; invalid priority),
  `routingNumbers` (strings coerced, maxOpenPerUser 0 invalid, autoCloseDays 0 valid, > 365 invalid, decimals invalid), `capSchema` (unknown channel, maxCount 0 valid, windowDays 0 invalid),
  `hoursSchema` (both empty valid, one empty invalid, window < 2 hours invalid, 25 invalid, "08" valid), `lowStockSchema` (empty → null, negative invalid),
  `auditFilter` (bad dates dropped, page clamps, empty strings → undefined), `changedKeys` (nested objects compared by JSON, key order irrelevant, null/array → "(toàn bộ)", no change → []).
  At least 45 rows. Expected values MUST follow the code; list any doubt (do not change the code).

## 4. Report back

Job id, files written, last line of tsc and checker, doubts.

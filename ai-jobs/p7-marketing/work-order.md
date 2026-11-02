# 06 — Work order: Phase 7 campaign pages, message templates, rule/quiet-hour table tests (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Split **70/30** from Phase 7 (D-54): Claude built the segment builder and journey
> screens; you build the simpler campaign pages, content and table tests. Acceptance: Claude, never the executor's report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Claude wrote segments,
journeys, campaigns + touchpoints (services, server actions, labels, tests). Each job delivers only the files in its brief.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`.
2. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx`, `src/components/data-table.tsx` (reuse components).
3. `src/lib/format.ts` (`money(v, currency)`, `base(v)` = VND, `dateTime`, `date`, `num`).
4. THE CONTRACT (use exactly, do not edit): `src/modules/marketing/campaigns.ts`, `src/modules/marketing/labels.ts`,
   `src/modules/marketing/segments.ts`, `src/modules/marketing/journeys.ts`, server actions `src/app/(app)/chien-dich/actions.ts`.
5. Examples: `src/app/(app)/cham-soc/page.tsx` + `create-ticket.tsx` (list + drawer form with useActionState + toast),
   `src/app/(app)/cham-soc/[id]/page.tsx` (detail, `notFound()` on HttpError 404).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Server pages: `pageUser("campaign.manage")` then `bindTenant(user)` (only import allowed from `@/lib/db`), then services. Never `db`,
  `rootDb`, `workspaceDb`, `@prisma/client` values.
- Client/server boundary: `"use client"` files import values only from `@/modules/*/labels` (types via `import type`); server pages
  never import UPPER_CASE constants from `"use client"` files. Idempotency keys generated in `useEffect` (never during render).
- Use EXACT enum values and labels from `@/modules/marketing/labels` — never invent new ones:
  - Campaign status `DRAFT` "Nháp", `RUNNING` "Đang chạy", `ENDED` "Đã kết thúc" (`CAMPAIGN_STATUS_LABEL`, `CAMPAIGN_STATUS_TONE`).
  - Channels: `CAMPAIGN_CHANNELS` (value/label list). Journey run status: `RUN_STATUS_LABEL` (`RUNNING`/`COMPLETED`/`EXITED`).
  - Journey status: `JOURNEY_STATUS_LABEL` / `JOURNEY_STATUS_TONE` (`DRAFT`/`ACTIVE`/`PAUSED`).
- Money: original currency via `money(cost, costCurrency)`, VND via `base(costBase)`; `null` → "—". Show metric codes: touchpoint/lead
  column headers carry "MKT-01", cost per lead "MKT-02" (cost per lead is VND).
- Vietnamese copy with diacritics; 4 states (route `loading.tsx` already exists under `(app)`; empty state; error toast; success toast);
  captions on tables; labels on inputs; no raw hex colours; one overlay (drawer OR modal) at a time.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p7-marketing/checker.py <job> .` until `checker: OK`.
  Ignore tsc errors only in files that are not yours.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields/routes/actions.

## 3. Style

Same as the ticket pages: `PageHeader` with crumbs "Marketing › Chiến dịch", `Card` around tables, `Badge` for status, primary
orange `Button` only for the main action of the screen ("Tạo chiến dịch", "Lưu", "Ghi điểm chạm").

## 4. Briefs

### 4.1 `campaigns-ui` — campaign list, form, detail, touchpoints

- Outputs: `src/app/(app)/chien-dich/page.tsx` (server), `src/app/(app)/chien-dich/campaign-form.tsx` (client),
  `src/app/(app)/chien-dich/[id]/page.tsx` (server), `src/app/(app)/chien-dich/[id]/touchpoint-form.tsx` (client),
  `src/app/(app)/chien-dich/[id]/status-buttons.tsx` (client).
- List `/chien-dich`: `listCampaigns(user)` + `campaignOptions(user)`. Header "Chiến dịch", description "Gom phân khúc, hành trình và nguồn
  tiếp cận (UTM). Chi phí nhập tay, quy VND theo tỷ giá hiệu lực (D-44)." Action: campaign-form.tsx button "Tạo chiến dịch" (Drawer).
  Table (caption): Tên (link `/chien-dich/{id}`), Trạng thái badge, Kênh (label from `CAMPAIGN_CHANNELS`), Brand, Phân khúc, Hành trình
  (name + journey status badge), Thời gian (`date(startAt)` – `date(endAt)`), Chi phí (original + VND below, muted), "Điểm chạm · MKT-01"
  (`num(touchpoints)`), "Lead · MKT-01" (`num(leads)`), "Chi phí/lead · MKT-02" (`base(costPerLead)`). Empty: "Chưa có chiến dịch" + hint
  "Tạo chiến dịch để gom phân khúc, hành trình và mã UTM".
- campaign-form.tsx (props: `options` = return type of campaignOptions, optional `initial` = a CampaignDetail for edit): Drawer, form →
  `saveCampaignAction` via `useActionState`; fields: hidden `id` (edit), `name` (required), `channel` select required,
  `brandId`/`segmentId`/`journeyId` selects (placeholder "— Không —"; segment option label "{name} · {lastCount} khách" when lastCount
  != null), `utmCampaign` (hint "chữ thường, số, - và _"), `startAt`/`endAt` `<input type="date">` (prefill edit with the `YYYY-MM-DD`
  part of the ISO string), `cost` (inputMode decimal) + `costCurrency` (3 letters, placeholder "VND"). Field errors from `state.fields`,
  values back via `pick(state, initial)`. Toast + close on ok. Button label "Tạo chiến dịch" (create) / "Sửa" (edit).
- Detail `/chien-dich/[id]`: `getCampaign(user, id)` (`notFound()` on HttpError 404) + `campaignOptions(user)`. Header = name with
  crumbs Marketing › Chiến dịch › name, actions: status badge, status-buttons.tsx (→ `setCampaignStatusAction`, hidden `id`, `status`;
  "Bắt đầu chạy" when DRAFT → RUNNING, "Kết thúc" when RUNNING → ENDED with `window.confirm`, "Mở lại" when ENDED → RUNNING) and
  campaign-form.tsx in edit mode. Stat cards (`StatCard` with `metric`): Điểm chạm (MKT-01), Lead (MKT-01), Chi phí (VND, original as
  hint), Chi phí/lead (MKT-02). If `journey`: card "Hành trình" with link `/hanh-trinh/{journey.id}`, journey status badge and counts
  from `journeyStats` labelled with `RUN_STATUS_LABEL`. If `segment`: line "Phân khúc: {name}" linking `/phan-khuc`. Touchpoints table
  (caption, latest 50): Thời điểm `dateTime(occurredAt)`, Nguồn / Kênh (`source` / `medium`), Nội dung UTM, Khách (link
  `/khach-hang/{id}`, displayName) or Lead (link `/nhu-cau/{id}`, contactName), Chi phí (`money(cost, costCurrency)` or "—").
  Empty: "Chưa có điểm chạm" + hint "Ghi điểm chạm khi khách đến từ chiến dịch này".
- touchpoint-form.tsx (prop `campaignId`): button "Ghi điểm chạm" → Drawer → `addTouchpointAction`; hidden `campaignId` and
  `idempotencyKey` (crypto.randomUUID() in useEffect, renewed after success); fields `customerPhone` (label "SĐT khách", hint "Hoặc để
  trống nếu nhập mã nhu cầu mua"), `leadId` (label "Mã nhu cầu mua (tùy chọn)"), `source` required (placeholder "newsletter, facebook…"),
  `medium`, `utmContent`, `cost` + `costCurrency`, `occurredAt` `<input type="datetime-local">` (empty = now).

### 4.2 `message-templates` — journey message templates

- Output: `fixtures/message-templates.json` — array of `{ "key", "language", "subject", "body" }`.
- Exactly keys `repurchase_reminder`, `repurchase_offer`, `back_in_stock`, `winback` (see `TEMPLATE_KEYS` in labels.ts) × languages
  `vi`, `en`, `ar`, `de` = 16 objects. Variables: only `{{name}}` and `{{brand}}` (both must appear in every body). Body ≤ 320
  characters, no URLs, no phone numbers, no prices or discount numbers (offers say "ưu đãi dành riêng" without a figure), polite brand
  tone, and the LAST sentence is the opt-out line in that language, exactly:
  vi "Trả lời STOP để ngừng nhận tin." · en "Reply STOP to unsubscribe." · ar "أرسل STOP لإيقاف الرسائل." ·
  de "Antworten Sie mit STOP, um keine Nachrichten mehr zu erhalten."
  `subject` ≤ 70 characters, same language. Arabic text in Arabic script, German in German.

### 4.3 `marketing-tests` — table tests for pure rule compiling and quiet hours

- Output: `tests/marketing-rules.test.ts` (vitest; import `compileRules`, `segmentWhere`, `FIELDS` from `@/modules/marketing/segments`,
  `nextSendable`, `QUIET`, `OPT_IN_MARKETS` from `@/modules/marketing/journeys`, `ValidationError` from `@/lib/errors`).
- Read the code and test with `it.each` tables:
  - `compileRules` — rows covering every field in `FIELDS` with its allowed comparisons: expected Prisma where object exact (`toEqual`),
    e.g. `orderCount gte 3` → `{ AND: [{ orderCount: { gte: 3 } }] }`; metric fields wrap in `{ metrics: { some: { period: "R12M", … } } }`;
    score fields `{ scores: { some: { type, version: { active: true }, band } } }` and `neq` → `none`; `lastOrderDays` inverts the
    comparison on `lastOrderAt` relative to a fixed `now`; `repurchase60` bool; `market`/`brand` `in` lists; `tag` has/not_has; `or`
    groups; nested groups (depth 3 ok, depth 4 throws). Error rows (`toThrow(ValidationError)`): unknown field, non-number value for a
    number field, `in` on lastOrderDays, `has` on a number field. `rev03` with `money: false` throws an error whose `status` is 403.
    At least 30 rows.
  - `segmentWhere` adds `{ mergedIntoId: null }`.
  - `nextSendable` — time zones `Asia/Ho_Chi_Minh`, `Asia/Dubai`, `Europe/Berlin` (include 2026-10-24 and 2026-10-26 around the DST end),
    `America/New_York`, `Asia/Kolkata` (half-hour offset: assert what the code returns): inside the window returns the same instant;
    08:59 local, exactly 20:00 local, 23:30 local → next send time per the code; at least 15 rows. Fixed dates only (no `new Date()`).
  - `QUIET` equals `{ from: 9, to: 20 }`; `OPT_IN_MARKETS` contains "DE" and "FR".
  Expected values MUST follow the code exactly; if you believe the code is wrong keep the test matching the code and list the doubt.

## 5. Report back

Job id, files written, last line of tsc and checker, contract gaps, doubts.

## 6. Acceptance (Claude)

Claude re-runs checker + tsc, reads every file (contract, money/VND, boundary, empty states), checks test expectations by hand,
runs vitest, opens pages at 1440/768, merges, LEDGER rows.

# 02 — Work order: Phase 3 Customer 360 UI + phone tests (Gemini, headless `agy -p`)

> Written 2026-10-29 by Claude (brain). Owner ruling: user set the Claude/Gemini split to 60/40 on 2026-10-29.
> Executor: one headless `agy -p` run per job through `run_agy.py`, mode `write`, in parallel.
> Acceptance: Claude, never the executor's own report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange design). Claude already
wrote the data layer and server actions for "Customer 360". You build the SCREENS on top of them. Each job delivers the files
named in its brief (section 4) and nothing else.

Read before working, in this order (only these):
1. `AGENTS.md` (project rules; UI must be Vietnamese, white/orange, 4 states, one overlay at a time).
2. `docs/ui-design-system.md` (tokens, layout, components, accessibility).
3. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx` (the components you MUST reuse).
4. `src/lib/format.ts`, `src/lib/status-badge.ts` (formatting + Vietnamese status labels — reuse, do not duplicate).
5. `src/modules/customers/service.ts` (THE CONTRACT: function signatures and return types — use them exactly, do not edit).
6. `src/app/(app)/khach-hang/actions.ts` (server actions you call — do not edit).
7. Example pages to imitate in structure and style: `src/app/(app)/don-hang/page.tsx` (server list page with GET filter
   form + server pagination) and `src/app/(app)/don-hang/[id]/page.tsx` (detail page with cards), and
   `src/app/(app)/xac-minh/page.tsx` + `src/app/(app)/xac-minh/buttons.tsx` (action buttons with toast).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Pages are Server Components: get the user with `pageUser("customer.view")` (or the permission named in the brief) from
  `@/lib/current-user`, then call the service function. Never import `@/lib/db` or `@prisma/client` in your files.
- Show only what the service returns. When a money field is `null` show "—" (the viewer lacks money permission). Phones and
  emails arrive already masked when the viewer lacks PII permission — display them as given.
- Every screen handles 4 states: loading is already provided by `src/app/(app)/loading.tsx`; you handle EMPTY (use
  `EmptyState` with a helpful Vietnamese sentence and, where it makes sense, an action), ERROR (404 from the service →
  `notFound()`; other errors bubble to `error.tsx`), and SUCCESS.
- All user-visible text in natural Vietnamese with diacritics. Money via `money()`/`usd()`, dates via `dateTime()`/`date()`.
- Accessibility: tables have `<caption className="sr-only">`, form inputs have labels, icon-only buttons have `aria-label`.
- Client interactivity only where needed, in a separate `"use client"` file, using `useActionState` + `useToast()` like
  `src/app/(app)/xac-minh/buttons.tsx`. Never stack overlays (no modal inside a drawer). Confirm destructive actions with
  `window.confirm` like the example.
- Other jobs run at the same time in the same folder. If `npx tsc --noEmit` reports errors only in files that are not
  yours, ignore them and say so in your report; never touch another job's files.
- Run `npx tsc --noEmit` from the repository root and fix your files until it exits 0 (at most three rounds), then run
  `python -I ai-jobs/p3-ui/checker.py <your job id> .` and fix until it prints `checker: OK`.

You MUST NOT:
- Edit, create or delete any other file (no service, action, schema, test helper, docs, package.json). No git, no npm
  install, no build, no dev server, no network fetches.
- Invent data, fields or routes that the contract does not provide. If something is missing, show "—" and mention it in
  your final report.
- Use colors outside the design tokens (`bg-brand`, `text-fg-muted`, `bg-success-soft`, … see globals/design system).

## 3. Style

Match the example pages: `PageHeader` with crumbs, `StatCard` row for key numbers, `Card` + `SectionTitle` sections, tables
with sticky header `bg-bg-subtle`, rows `h-11`, `Badge` for statuses/platforms. Orange only for the primary action and the
active state. Keep layouts that do not overlap at 1280px and stack cleanly below 1024px (`grid-cols-1 xl:grid-cols-3`).

## 4. Briefs

### 4.1 `list` — customer list page

- Output: `src/app/(app)/khach-hang/page.tsx` (Server Component, default export `CustomersPage`).
- Data: `parseCustomerFilter(await searchParams)` then `listCustomers(user, f)`; for filter dropdowns you may call
  `getCatalog(user)` from `@/modules/admin/service` (brands, markets).
- Header: title "Khách hàng", crumbs Khách hàng › Khách hàng, description that profiles are merged from every sales platform.
- StatCards: total customers (filtered), repeat customers (`repeatCount`), and a note card about the score being available
  from Phase 6 ("Điểm khách hàng" → "Chưa đủ dữ liệu").
- GET filter form: search `q` (placeholder mentions name, phone, email, source id — phone/email search only works for
  viewers with PII permission, add a small hint when `showPii` is false), brand, market, `minValue` (only render when
  `showMoney`), last purchase from/to, checkbox "Chỉ khách mua lại" (`repeat=1`), sort select (recent/value/orders/name;
  hide "value" when not `showMoney`). Submit button orange "Lọc", link "Xóa lọc" when any filter is set.
- Table columns: Khách (name link to `/khach-hang/{id}` + phone under it), Email, Thị trường, Số đơn (delivered/total),
  Mua lần đầu, Mua gần nhất, Giá trị 12 tháng (REV-03, right aligned, "—" when null), Nguồn (platform badges), Thẻ.
- Pagination like the orders page. Empty states: no customers at all (point to "Kết nối dữ liệu" `/ket-noi`) vs no match.

### 4.2 `profile` — Customer 360 page

- Output: `src/app/(app)/khach-hang/[id]/page.tsx` plus any client files you need inside `src/app/(app)/khach-hang/[id]/`
  (for example `tabs.tsx`, `preference-form.tsx`, `unmerge-button.tsx`).
- Data: `getCustomer360(user, id)`. If the result has `redirectTo`, call `redirect("/khach-hang/" + redirectTo)` from
  `next/navigation`. HttpError 404 → `notFound()`.
- Header: customer name, crumbs Khách hàng › {name}, description with market and "khách từ {createdAt date}". If
  `pendingReviews > 0` and `canMerge`, an orange `ButtonLink` to `/xac-minh?tab=khach` "Có N hồ sơ nghi trùng".
- Summary cards (StatCard row): Giá trị 12 tháng (metric "REV-03", "—" if null), Số đơn (with delivered count hint), Mua gần
  nhất (date + first purchase hint), Giao thất bại/hoàn (failedOrders), Điểm khách hàng → always "Chưa đủ dữ liệu" with hint
  "Có ở Phase 6" (summary.score is null).
- Tabs via query string `?tab=` (server-rendered links, no client state needed): `tong-quan` (default), `don`, `tuong-tac`,
  `dia-chi`, `danh-tinh`, `gop`. Use the same tab look as `src/app/(app)/quan-tri/danh-muc/view.tsx` (border-b-2,
  `border-brand` active, `shadow-[inset_0_-1px_0_var(--border)]` on the container, no negative margin).
  - Tổng quan: left 2/3 = unified Timeline (vertical list like the delivery timeline in the order detail page; dot color by
    `tone`; item title, detail, time; link when `href`); right 1/3 = contact card (phone, email, market, locale, tags) and
    "Quyền liên hệ" card listing `preferences` (channel + purpose + Đồng ý/Từ chối badge + source + time) with, when
    `canEdit`, a small form (client file) calling `recordPreferenceAction` (fields: hidden customerId, channel select
    EMAIL/SMS/PHONE/WHATSAPP/MESSENGER, purpose select MARKETING/SERVICE, optIn checkbox value "true", source text) —
    render it inline in the card, NOT in a drawer or modal.
  - Đơn: table of `orders` (order number link `/don-hang/{id}`, date, store, status badges via `ORDER_STATUS`,
    `PAYMENT_STATUS`, `FULFILLMENT_STATUS`, value + USD or "—").
  - Tương tác: EmptyState "Chưa có tương tác — ghi cuộc gọi, tin nhắn có ở Phase 4".
  - Địa chỉ: list `addresses` (kind label Giao hàng/Thanh toán, country, Mặc định badge).
  - Danh tính: table `identities` (platform badge, store, source customer id in mono, phone, email, "Đã xác minh" badge when
    emailVerified, first seen). Explain in one line that profiles merge automatically only on same source id or same phone.
  - Lịch sử gộp: list `merges` (role survivor/merged in Vietnamese, link to the other profile, merged time, unmerged time or,
    when `canMerge` and not unmerged and role is survivor, a "Tách lại" button calling `unmergeCustomerAction` with the
    merge id, with confirm). Empty state when none.

### 4.3 `review` — customer tab on the verification page

- Outputs: `src/app/(app)/xac-minh/page.tsx` (modify) and `src/app/(app)/xac-minh/customer-reviews.tsx` (new).
- Add tabs at the top via `?tab=` : `don` (default, the existing order reviews — keep current behaviour and markup intact)
  and `khach` ("Khách hàng"). Show counts in the tab labels. The page currently requires `order.link`; keep that for the
  order tab. For the customer tab require `customer.merge`: use `currentUserOrRedirect()` and `can()` from
  `@/lib/permissions` to decide which tabs to show; call `listReviews` only when the order tab is visible/active and
  `listCustomerReviews` only when the customer tab is allowed. A user with neither permission gets `notFound()`.
- Customer tab: for each review a card like the order review cards — header badge "Nghi trùng" + reason text (keys in
  `reasons`: `sameEmailUnverified` → "Cùng email chưa xác minh: {email}", `sameStrongEvidence` → "Cùng SĐT/mã khách nhưng
  đang là hai hồ sơ"), two columns comparing name (link to profile), phone, email, market, orders, last purchase, value
  ("—" if null), platforms; footer buttons "Hai khách khác nhau" (`rejectCustomerReviewAction`) and orange "Cùng một
  khách — gộp" (`mergeCustomerAction`, with confirm "Gộp hai hồ sơ? Đơn và danh tính chuyển về một hồ sơ; có thể tách lại
  sau."). Empty state when none.
- Buttons in a client component inside `customer-reviews.tsx` (or reuse the pattern of `buttons.tsx` without editing it).

### 4.4 `phone` — table tests for phone normalization

- Output: `tests/phone.test.ts` (vitest; `import { describe, expect, it } from "vitest"`; import from `@/lib/phone`).
- Read `src/lib/phone.ts` and test `normalizePhone`, `maskPhone`, `maskEmail`, `normalizeEmail` with `it.each` tables.
- Cover each country VN, US, DE, FR, AE, SA, KW: international with "+", with "00", national with trunk prefix and
  default country, digits with country code but no "+", spaces/dashes/brackets, too short/too long → null, unknown
  default country → null, empty/null input → null. At least 6 cases per country. Masking: at least 6 cases.
- Expected values must follow the rules in `src/lib/phone.ts` exactly (country code + national significant number,
  trunk prefix removed). Do NOT change `src/lib/phone.ts`; if you believe a rule is wrong, keep the test matching the
  current code and list your doubt in the final report.

## 5. Report back (your final reply)

Job id, files written, the last line of `npx tsc --noEmit` and of the checker, anything from the contract you could not
display, any doubt about the rules.

## 6. Acceptance (Claude, not the executor)

1. `run_agy.py` exit 0: no job error, no timeout, no `stray_write`.
2. Claude runs the checker and `npx tsc --noEmit` on the worktree.
3. Claude reads every file: contract use, permission handling, masking, 4 states, Vietnamese copy, tokens, overlay rule.
   Opens each page in the browser at 1440 and 768.
4. Merge into main, `npm test`, `next build`.
5. One row per job in `ai-jobs/LEDGER.md`.

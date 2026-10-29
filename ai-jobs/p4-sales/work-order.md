# 03 — Work order: Phase 4 sales workspace UI + demo content (Gemini, headless `agy -p`)

> Written 2026-10-29 by Claude (brain). Split 60/40 (D-27). Executor: one headless `agy -p` run per job through
> `run_agy.py`, mode `write`, in parallel. Acceptance: Claude, never the executor's own report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange design). Claude wrote the
data layer, permissions and server actions for "Nhu cầu mua" (leads), "Hàng đợi của tôi" (my queue) and "Nhiệm vụ"
(tasks). You build the SCREENS on top of them, plus demo content files. Each job delivers the files named in its brief
(section 4) and nothing else.

Read before working, in this order (only these):
1. `AGENTS.md` (project rules; UI Vietnamese, white/orange, 4 states, ONE overlay at a time).
2. `docs/ui-design-system.md` (tokens, layout, components, accessibility).
3. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx` (components you MUST reuse:
   PageHeader, Card, SectionTitle, StatCard, Badge, Button, ButtonLink, EmptyState; TextField, SelectField, Field,
   FormError, pick; Drawer, Modal, useToast).
4. `src/lib/format.ts` (`dateTime`, `date`, `money`, `num`, `ago`), `src/lib/status-badge.ts` (`pickBadge`, Vietnamese labels).
5. THE CONTRACT (use exactly, do not edit): `src/modules/sales/leads.ts`, `src/modules/sales/tasks.ts`,
   `src/modules/sales/queue.ts`. Server actions you call (do not edit): `src/app/(app)/nhu-cau/actions.ts`,
   `src/app/(app)/nhiem-vu/actions.ts`.
6. Examples to imitate: `src/app/(app)/don-hang/page.tsx` (server list page, GET filter form, server pagination),
   `src/app/(app)/khach-hang/[id]/page.tsx` (detail page with `?tab=` tabs, timeline, inline forms) and its
   `preference-form.tsx` (client form with `useActionState` + toast), `src/app/(app)/xac-minh/buttons.tsx` (action
   buttons), `src/app/(app)/quan-tri/danh-muc/view.tsx` (Drawer with a form).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Pages are Server Components: `const user = await pageUser("<perm>")` from `@/lib/current-user`, then `bindTenant(user)`
  from `@/lib/db` (the ONLY thing you may import from `@/lib/db`), then call the service. Never use `db`, `rootDb`,
  `workspaceDb` or `@prisma/client` in your files.
- Show only what the service returns. Phones/emails arrive already masked for viewers without PII permission — display as given.
- 4 states: loading exists (`src/app/(app)/loading.tsx`); you handle EMPTY (`EmptyState`, helpful Vietnamese sentence, an
  action where it makes sense), ERROR (service 404 → `notFound()`; other errors bubble), SUCCESS.
- All visible text natural Vietnamese with diacritics. Dates via `dateTime()`/`date()`; budget via `money(amount, currency)`.
- Accessibility: tables have `<caption className="sr-only">`, inputs have labels, icon-only buttons have `aria-label`,
  drag-and-drop has a keyboard/button alternative (a stage `<select>` on each card is enough).
- Client interactivity only in separate `"use client"` files using `useActionState` + `useToast()`. Forms that create
  something put a hidden `idempotencyKey` input whose value is `crypto.randomUUID()` generated once when the form/drawer
  opens (so a double click cannot create two records). Never stack overlays: one Drawer OR one Modal at a time.
- Show buttons only when the service says so (`canEdit`, `canAssign`, `canClaim`, `mine`); the server checks again anyway.
- Run `npx tsc --noEmit` from the repo root and fix your files until it exits 0 (at most three rounds), then
  `python -I ai-jobs/p4-sales/checker.py <your job id> .` until it prints `checker: OK`. Other jobs run at the same time:
  if tsc errors are only in files that are not yours, ignore them and say so; never touch another job's files.

You MUST NOT:
- Edit/create/delete any other file (no service, action, schema, test helper, docs, package.json). No git, no npm install,
  no build, no dev server, no network.
- Invent fields or routes the contract does not provide. Missing → show "—" and mention it in your report.
- Use colors outside design tokens (`bg-brand`, `text-fg-muted`, `bg-warning-soft`, …). No raw hex.

## 3. Style

`PageHeader` with crumbs + orange primary action on the right; `StatCard` row; `Card` + `SectionTitle`; tables with sticky
header `bg-bg-subtle`, rows `h-11`; `Badge` for stages. Stage tones: MOI info, DANG_TU_VAN brand, CHO_QUYET_DINH warning,
DA_MUA success, TU_CHOI neutral, MAT_LIEN_LAC danger. Stage labels: use `STAGE_LABEL` from `@/modules/sales/leads`.
Overdue things use `text-danger` + Badge tone danger "Quá hạn". No overlap at 1280px; stack below 1024px.
Task type labels: CALL_BACK "Gọi lại", FOLLOW_UP "Theo dõi", MEETING "Hẹn gặp", OTHER "Khác".
Activity labels: CALL "Cuộc gọi", MESSAGE "Tin nhắn", MEETING "Gặp mặt", NOTE "Ghi chú", SYSTEM "Hệ thống"; direction IN
"Khách gửi", OUT "Gửi khách". Language labels: vi Tiếng Việt, en English, ar العربية, de Deutsch.

## 4. Briefs

### 4.1 `leads` — lead list + kanban + create drawer

- Outputs: `src/app/(app)/nhu-cau/page.tsx` (Server Component, default export `LeadsPage`),
  `src/app/(app)/nhu-cau/board.tsx` (client kanban), `src/app/(app)/nhu-cau/create-lead.tsx` (client button + Drawer form).
- Permission `lead.view`. Data: `parseLeadFilter(await searchParams)`; `?view=board` → `leadBoard(user, f)`, otherwise
  `listLeads(user, f)`. Dropdown options: `getCatalog(user)` from `@/modules/admin/service` (brands, markets).
- Header: "Nhu cầu mua", crumbs Khách hàng › Nhu cầu mua, description "Mỗi nhu cầu có người phụ trách, hạn phản hồi và
  lịch sử". Actions: view switch links "Danh sách" / "Kanban" (keep current filters), and when `canEdit` the orange
  "Tạo nhu cầu mua" button (create-lead.tsx).
- GET filter form: `q` (name, interest, phone/email), stage select (list view only), owner select (Tất cả / Của tôi `me` /
  Chưa giao `none`), brand, market, checkbox "Quá hạn phản hồi" (`overdue=1`), orange "Lọc", "Xóa lọc" link.
- List table: Khách (contactName link `/nhu-cau/{id}` + phone/email under), Nhu cầu (interest, truncate), Nguồn, Brand ·
  Thị trường, Giai đoạn (Badge), Phụ trách (owner name or Badge warning "Chưa giao"), Hạn phản hồi (dateTime; "Quá hạn"
  badge when `overdue`; "Đã phản hồi" muted when `firstRespondedAt`), Tạo lúc. Server pagination like the orders page.
- Board (board.tsx, props = the `leadBoard` result): 6 columns in `LEAD_STAGES` order, header label + total. Cards: name
  link, interest, owner, overdue badge. Native HTML5 drag-and-drop (no library): dropping a card on another column submits
  `changeStageAction` (FormData id, stage). Dropping on TU_CHOI or MAT_LIEN_LAC first opens ONE Modal asking "Lý do"
  (required textarea `lostReason`) then submits. Each card also has a small `<select>` of stages as the keyboard
  alternative (same behaviour). Toast the action message; on error toast the message and keep the card where it was.
  Columns scroll vertically inside a fixed-height board; the board scrolls horizontally only below 1280px.
- Create drawer (create-lead.tsx, props: brands, markets): Drawer title "Tạo nhu cầu mua", form → `createLeadAction`.
  Fields: contactName*, phone, email (hint: cần ít nhất SĐT hoặc email), language select (vi/en/ar/de), source* (select:
  inbox "Hộp thư", website "Website", ads "Quảng cáo", referral "Giới thiệu", manual "Nhập tay"), brandId, marketId,
  interest (textarea), budgetAmount + budgetCurrency (inline row), note (textarea "Ghi chú đầu tiên"), hidden
  idempotencyKey. Show field errors from `result.fields`, keep typed values with `pick()`. Close on success + toast.
- Empty states: no lead at all ("Chưa có nhu cầu mua" + create button when allowed) vs no match ("Không có nhu cầu khớp bộ lọc").

### 4.2 `lead-detail` — one lead

- Outputs: `src/app/(app)/nhu-cau/[id]/page.tsx` plus client files inside `src/app/(app)/nhu-cau/[id]/` (e.g.
  `stage-form.tsx`, `activity-form.tsx`, `reassign.tsx`, `task-form.tsx`, `claim-button.tsx`).
- Permission `lead.view`. Data: `getLead(user, id)` (HttpError 404 → `notFound()`); for the reassign drawer and the task
  assignee select call `assignableUsers(user)` only when `canAssign` / `canEdit`.
- Header: contact name, crumbs Khách hàng › Nhu cầu mua › {name}, description "{source} · tạo {dateTime(createdAt)}". Actions:
  `canClaim` → orange "Nhận lead này" (`claimLeadAction`); `canAssign` → "Chuyển phụ trách" (Drawer, form →
  `reassignLeadAction`: toUserId select from assignableUsers "name — team", reason textarea required).
- StatCards: Giai đoạn (Badge), Phụ trách (name or "Chưa giao"), Hạn phản hồi (dateTime, danger "Quá hạn" when overdue,
  "Đã phản hồi {dateTime}" when responded), Hẹn liên hệ lại (nextActionAt or "—").
- Layout `grid-cols-1 xl:grid-cols-3`. Left 2/3:
  - When `canEdit`: inline card "Ghi tương tác" (activity-form.tsx → `logActivityAction`): type select
    CALL/MESSAGE/MEETING/NOTE, direction select (only for MESSAGE), channel select (PHONE, WHATSAPP, MESSENGER, EMAIL),
    body textarea*, outcome, durationSec (only for CALL), hidden leadId + idempotencyKey. Hint: "Cuộc gọi/tin nhắn gửi khách
    đầu tiên sẽ ghi nhận đã phản hồi".
  - Timeline of `activities` (newest first): icon/dot by type (SYSTEM muted), label, direction, channel, actor or
    "Khách", body (preserve line breaks, `dir="auto"` so Arabic renders right-to-left), outcome, duration, time.
- Right 1/3:
  - "Thông tin liên hệ": phone, email, language, brand · market, interest, budget (`money`) or "—", linked customer
    (link `/khach-hang/{id}` with orderCount and lastOrderAt) or "Chưa gắn hồ sơ khách".
  - When `canEdit`: "Giai đoạn" card (stage-form.tsx → `changeStageAction`): stage select, lostReason textarea shown when
    TU_CHOI/MAT_LIEN_LAC, nextActionAt `datetime-local`, hidden id.
  - "Việc" card: list `tasks` (title, type, dueAt, assignee, status badge); when `canEdit` a compact form (task-form.tsx →
    `createTaskAction`, hidden leadId + idempotencyKey; type, title*, dueAt* datetime-local, assigneeId select when
    `canAssign`).
  - "Kịch bản tư vấn": `scripts` (title + body in a `<details>`; `dir="auto"`). Empty: "Chưa có kịch bản phù hợp".
  - "Lịch sử phụ trách": `assignments` (from → to, by or "Tự động", reason, time).

### 4.3 `queue` — my queue

- Output: `src/app/(app)/hang-doi/page.tsx` (+ optional `src/app/(app)/hang-doi/read-button.tsx` client).
- Permission: `currentUserOrRedirect()` from `@/lib/current-user` then `bindTenant(user)`; call `myQueue(user)` (it throws
  403 for users without lead/task permission → let it bubble) and `listNotifications(user)`.
- Header "Hàng đợi của tôi", crumbs Khách hàng › Hàng đợi của tôi, description "Việc cần làm sắp theo mức gấp: quá hạn trước".
- StatCards: Tổng việc, Quá hạn (`overdue`, danger tone text), Thông báo chưa đọc.
- Main card: list of `items` in the given order. Each row: kind badge (lead_response "Chờ phản hồi" warning, lead_followup
  "Liên hệ lại" info, lead_unassigned "Chưa giao" neutral, task "Việc" brand), title link to `link`, detail, due
  (dateTime + "Quá hạn" badge when overdue). Empty: "Không còn việc gấp — làm tốt lắm!" with links to `/nhu-cau` and `/nhiem-vu`.
- Side card "Thông báo": `rows` (title link, body, time via `ago()`, unread dot), button "Đánh dấu đã đọc tất cả"
  (`markReadAction` with empty id) when unread > 0.

### 4.4 `tasks` — task list

- Outputs: `src/app/(app)/nhiem-vu/page.tsx` + client files inside `src/app/(app)/nhiem-vu/` (e.g. `create-task.tsx`,
  `task-buttons.tsx`).
- Permission `task.manage`. Data: `parseTaskFilter(await searchParams)`, `listTasks(user, f)`, `assignableUsers(user)` from
  `@/modules/sales/leads` (for the create drawer assignee select; when it returns only the user, hide the select).
- Header "Nhiệm vụ", crumbs Khách hàng › Nhiệm vụ; orange "Tạo việc" (Drawer → `createTaskAction`: type, title*, note,
  dueAt* datetime-local, assigneeId, hidden idempotencyKey).
- Filter: tabs-like links for due (Tất cả / Quá hạn `overdue` / Hôm nay `today` / 7 ngày `week`), status select, who select
  (Trong phạm vi / Của tôi `me`).
- Table: Việc (title + note muted), Loại, Hạn (dateTime, "Quá hạn" badge), Người làm, Liên quan (lead link
  `/nhu-cau/{id}`, customer link `/khach-hang/{id}`, order link `/don-hang/{id}` — whichever exist), Trạng thái badge (OPEN
  "Đang mở" info, DONE "Xong" success, CANCELLED "Đã hủy" neutral), actions (task-buttons.tsx → `setTaskStatusAction`):
  OPEN → "Xong" and "Hủy" (confirm); DONE/CANCELLED → "Mở lại". Pagination. Empty states.

### 4.5 `content` — demo leads, conversations and sales scripts (JSON only)

- Outputs: `fixtures/leads.json` and `fixtures/scripts.json`. Fictional people only; no real brands; no medical claims.
- Read `fixtures/catalog.json` for the fictional brands (LUMI, NOVA, ORBI) and their products, and `prisma/seed.ts` for
  markets (AE, SA, KW, US, DE, FR) and the two teams.
- `fixtures/leads.json`: array of 60 objects
  `{ "key": "L001", "workspace": "PIALPHA"|"TEAM-EU", "brand": "LUMI"|"NOVA"|"ORBI", "market": "AE"|..., "contactName",
  "phone": "+<E.164 digits matching the market country>", "email": string|null, "language": "vi"|"en"|"ar"|"de",
  "source": "inbox"|"website"|"ads"|"referral"|"manual", "interest": "<product name from catalog>",
  "budget": { "amount": "123.00", "currency": "<market currency>" } | null,
  "stage": one of MOI, DANG_TU_VAN, CHO_QUYET_DINH, DA_MUA, TU_CHOI, MAT_LIEN_LAC, "lostReason": string|null (required
  for TU_CHOI and MAT_LIEN_LAC, in Vietnamese), "daysAgo": 0..90,
  "messages": [ { "dir": "IN"|"OUT", "channel": "WHATSAPP"|"MESSENGER"|"PHONE"|"EMAIL", "minutesAfter": int, "text" } ] }`.
  PIALPHA brands LUMI/NOVA, markets AE/SA/KW/US; TEAM-EU brand ORBI, markets DE/FR/US. Languages: AE/SA/KW mostly ar with
  some en; DE de; FR en (no French); US en; about 8 leads in vi (Vietnamese diaspora customers). Stage spread roughly:
  MOI 15, DANG_TU_VAN 15, CHO_QUYET_DINH 10, DA_MUA 8, TU_CHOI 7, MAT_LIEN_LAC 5. MOI leads have only IN messages; other
  stages have 2–6 messages alternating, first message IN, written in the lead's language, natural and short (a real
  customer asking about price, size, delivery time, COD; the seller answering). 10 leads (stage MOI) have daysAgo 0.
- `fixtures/scripts.json`: array of 16 objects `{ "brand": "LUMI"|"NOVA"|"ORBI"|null, "market": code|null, "stage":
  stage|null, "language": "vi"|"en"|"ar"|"de", "title", "body" }` — opening greeting, needs discovery questions, handling
  "too expensive", COD confirmation (AE/SA/KW), follow-up after silence, closing. Cover all 4 languages (at least 3 each).
  Titles in the script's language; body 3–8 lines.

## 5. Report back (your final reply)

Job id, files written, last line of `npx tsc --noEmit` and of the checker, anything from the contract you could not
display, doubts.

## 6. Acceptance (Claude, not the executor)

1. `run_agy.py` exit 0: no job error, no timeout, no `stray_write`.
2. Claude runs the checker and `npx tsc --noEmit` on the worktree.
3. Claude reads every file (contract use, permission flags, masking, 4 states, Vietnamese copy, tokens, overlay rule,
   idempotency key) and every content item's language; opens each page in the browser at 1440 and 768.
4. Merge into main, `npm test`, `next build`. One row per job in `ai-jobs/LEDGER.md`.

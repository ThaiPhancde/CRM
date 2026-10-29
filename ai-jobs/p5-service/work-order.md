# 04 — Work order: Phase 5 after-sales service + knowledge UI and content (Gemini, headless `agy -p`)

> Written 2026-10-29 by Claude (brain). Split 60/40 (D-27). One headless `agy -p` run per job via `run_agy.py`, mode `write`,
> in parallel. Acceptance: Claude, never the executor's report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange design). Claude wrote the
data layer, permissions and server actions for "Ticket" (after-sales cases with SLA) and "Tri thức" (versioned knowledge
articles). You build the SCREENS and demo content files. Each job delivers only the files in its brief (section 4).

Read before working, in this order (only these):
1. `AGENTS.md` (Vietnamese UI, white/orange, 4 states, ONE overlay at a time).
2. `docs/ui-design-system.md`.
3. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx` (reuse: PageHeader, Card, SectionTitle,
   StatCard, Badge, Button, ButtonLink, EmptyState; TextField, SelectField, Field, FormError, pick; Drawer, Modal, useToast).
4. `src/lib/format.ts` (`dateTime`, `date`, `num`, `ago`).
5. THE CONTRACT (use exactly, do not edit): `src/modules/service/tickets.ts`, `src/modules/service/knowledge.ts`,
   `src/modules/service/labels.ts` (labels/tones/enums — import labels ONLY from here), `src/modules/sales/leads.ts`
   (`assignableUsers` for the owner/assign selects). Server actions (do not edit): `src/app/(app)/cham-soc/actions.ts`,
   `src/app/(app)/tri-thuc/actions.ts`.
6. Examples to imitate: `src/app/(app)/nhu-cau/page.tsx` (list + filters + pagination + bulk), `src/app/(app)/nhu-cau/[id]/page.tsx`
   and its client forms (`activity-form.tsx`, `stage-form.tsx`, `reassign.tsx`), `src/app/(app)/nhu-cau/create-lead.tsx` (Drawer form).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Pages are Server Components: `const user = await pageUser("<perm>")` from `@/lib/current-user`, then `bindTenant(user)` from
  `@/lib/db` (the ONLY import allowed from `@/lib/db`), then call the service. Never `db`, `rootDb`, `workspaceDb`, `@prisma/client`
  (except `import type`).
- **Client/server boundary (two real bugs last batch):** a `"use client"` file must NOT import values from `@/modules/*` except
  `@/modules/service/labels` and `@/modules/sales/labels` (types via `import type` are fine). A server page must NOT import
  constants (UPPER_CASE names) from a `"use client"` file — put shared constants in the labels modules (read-only for you) or
  define them inside the server file.
- Idempotency keys: forms that create something put a hidden `idempotencyKey` generated with `crypto.randomUUID()` INSIDE
  `useEffect` after mount (never in `useState(() => …)` — that breaks hydration), regenerated after a successful submit.
- Show only what services return; phones/emails may arrive masked — display as given.
- 4 states: loading exists (`src/app/(app)/loading.tsx`); handle EMPTY (`EmptyState`), ERROR (service 404 → `notFound()`), SUCCESS.
- Vietnamese copy with diacritics. Dates via `dateTime()`/`ago()`. Tables have `<caption className="sr-only">`; inputs labelled;
  icon-only buttons have `aria-label`. One Drawer OR one Modal at a time.
- Show action buttons only when the service says so (`canEdit`, `canAssign`, `canPublish`); the server checks again.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p5-service/checker.py <job> .` until
  `checker: OK`. Other jobs run in parallel: ignore tsc errors only in files that are not yours; never touch them.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields or routes (missing → "—" and
report it); raw hex colours.

## 3. Style

Same as the lead pages: `PageHeader` with crumbs + orange primary action; `StatCard` row; tables with sticky `bg-bg-subtle` header,
rows `h-11`. Priority badge uses `PRIORITY_LABEL`/`PRIORITY_TONE`, status badge `TICKET_STATUS_LABEL`/`TICKET_STATUS_TONE`, type
`TICKET_TYPE_LABEL`. VIP customers show a small `Badge tone="warning"` "Khách giá trị cao". Overdue: `text-danger` + Badge
danger "Quá hạn". Event labels: CREATED "Tạo ticket", NOTE "Ghi chú nội bộ", REPLY "Trả lời khách", STATUS "Đổi trạng thái",
ASSIGN "Chuyển phụ trách", PRIORITY "Đổi mức ưu tiên", SYSTEM "Hệ thống". Language labels: vi Tiếng Việt, en English,
ar العربية, de Deutsch. Arabic text containers use `dir="auto"`.

## 4. Briefs

### 4.1 `tickets` — ticket list + create drawer

- Outputs: `src/app/(app)/cham-soc/page.tsx` (default export `TicketsPage`), `src/app/(app)/cham-soc/create-ticket.tsx` (client).
- Permission `ticket.view`. Data: `parseTicketFilter(await searchParams)` → `listTickets(user, f)`; `assignableUsers(user)` for
  the owner select (only when `canAssign`).
- Header "Ticket chăm sóc", crumbs Chăm sóc › Ticket, description "Sự cố sau bán có hạn phản hồi và hạn xử lý theo mức ưu tiên".
  Primary action (when `canEdit`) orange "Tạo ticket" → Drawer form → `createTicketAction`: type*, priority*, subject*,
  body* (textarea "Mô tả sự cố"), orderId (text, hint "Mã nội bộ của đơn — mở từ trang đơn sẽ tự điền"), customerId (text),
  ownerId select (when canAssign; default "Tôi"), hidden idempotencyKey. Field errors from `result.fields`, keep values with `pick()`.
- StatCards: Tổng (theo lọc), Quá hạn xử lý (`overdue`, danger), Đang mở (link `?status=open`).
- GET filter form: q (mã TK-…, tiêu đề, tên khách), status (Tất cả / Đang mở `open` / each status), priority, type,
  owner (Tất cả / Của tôi `me` / Chưa giao `none`), checkbox "Quá hạn" (`overdue=1`), "Lọc", "Xóa lọc".
- Table: Mã (code, link `/cham-soc/{id}`, VIP badge), Tiêu đề + loại, Khách (link `/khach-hang/{id}` or "—"), Mức, Trạng thái,
  Phụ trách (or "Chưa giao" warning), Hạn phản hồi (dateTime; "Đã phản hồi" muted when `firstRespondedAt`; danger when
  `responseOverdue`), Hạn xử lý (dateTime; danger + "Quá hạn" when `resolveOverdue`), Tạo lúc. Server pagination.
- Empty: no tickets at all vs no match.

### 4.2 `ticket-detail` — one ticket

- Outputs: `src/app/(app)/cham-soc/[id]/page.tsx` + client files in `src/app/(app)/cham-soc/[id]/` (e.g. `reply-form.tsx`,
  `status-form.tsx`, `assign.tsx`).
- Permission `ticket.view`. Data: `getTicket(user, id)` (404 → `notFound()`); `assignableUsers(user)` only when `canAssign`.
- Header: `{code}: {subject}`, crumbs Chăm sóc › Ticket › {code}; description "{type label} · tạo {dateTime(createdAt)}";
  badges priority + status + VIP. Action when `canAssign`: "Chuyển phụ trách" (Drawer → `assignTicketAction`: toUserId, reason*).
- StatCards: Hạn phản hồi đầu (dateTime / "Đã phản hồi {dateTime}" / danger "Quá hạn"), Hạn xử lý (dateTime / "Đã giải quyết
  {dateTime}" / danger "Quá hạn"), Phụ trách, Mức ưu tiên.
- Layout `grid-cols-1 xl:grid-cols-3`. Left 2/3: when `canEdit` a reply card (reply-form.tsx → `replyTicketAction`): segmented
  choice "Trả lời khách" (`kind=REPLY`) / "Ghi chú nội bộ" (`kind=NOTE`), textarea body*, hidden id + idempotencyKey; hint under
  REPLY "Demo: tin được ghi vào hàng đợi gửi, không gửi ra ngoài". Below: timeline of `events` (oldest first) — label by type,
  actor or "Hệ thống", time; REPLY in a brand-soft bubble, NOTE in a warning-soft bubble with "Nội bộ"; STATUS/PRIORITY show
  `meta.from → meta.to` using the labels; body with `whitespace-pre-line` + `dir="auto"`.
- Right 1/3: "Khách hàng" card (`customerInfo`: name link, phone, email, orders delivered/total, or "Chưa gắn khách");
  "Đơn liên quan" card (`orderInfo`: number link `/don-hang/{id}`, status, fulfillment, shipments carrier + tracking + last
  events; or "—"); when `canEdit` "Trạng thái & mức" card (status-form.tsx → `setTicketStatusAction` with status select + optional
  note, and `setTicketPriorityAction` with priority select — two small forms, hint "Đổi mức sẽ tính lại hạn"); "Việc" card
  (`tasks`); "Bài tri thức gợi ý" (`articles`: title link `/tri-thuc/{id}`, language label; empty "Chưa có bài phù hợp").

### 4.3 `kb-list` — knowledge list

- Output: `src/app/(app)/tri-thuc/page.tsx`.
- Permission `knowledge.view`. Data: `parseKbFilter(await searchParams)` → `listArticles(user, f)`; `getCatalog(user)` from
  `@/modules/admin/service` for brand/market selects.
- Header "Tri thức", crumbs Chăm sóc › Tri thức, description "Bài hướng dẫn theo brand, thị trường và ngôn ngữ — mỗi lần sửa
  là một phiên bản mới". Action (when `canEdit`) orange ButtonLink "Viết bài mới" → `/tri-thuc/moi`.
- Filters: q, language, brand, market, status (only when `canEdit`: Nháp/Đã xuất bản/Lưu trữ).
- Table: Tiêu đề (link `/tri-thuc/{id}`, tags as small badges), Ngôn ngữ, Brand · Thị trường (null → "Mọi brand"/"Mọi thị
  trường"), Trạng thái (Badge; `hasDraft` → extra Badge info "Có bản nháp mới"), Phiên bản ("v{publishedVersion ?? latestVersion}"),
  Cập nhật (`ago`). Pagination. Empty states (reader: "Chưa có bài nào được xuất bản").

### 4.4 `kb-editor` — read + edit an article

- Outputs: `src/app/(app)/tri-thuc/[id]/page.tsx` (read view; `?v=N` selects a version for editors), `src/app/(app)/tri-thuc/moi/page.tsx`
  (new article), and client files in `src/app/(app)/tri-thuc/[id]/` (e.g. `editor.tsx`, `publish-buttons.tsx`). `moi/page.tsx`
  may import the editor component from `../[id]/editor`.
- Read view: permission `knowledge.view`; `getArticle(user, id, v)` (404 → notFound). Render the markdown body as plain
  paragraphs/lists WITHOUT any HTML injection: split by blank lines; lines starting with "- " become `<li>`; lines starting with
  "# "/"## " become headings; everything else `<p>`; all as React text (no `dangerouslySetInnerHTML`). `dir="auto"`.
  Side card: language, brand/market ids → show "—" if null, tags, status, published/latest version; when `canEdit` a version
  list (links `?v=N`, author, time) and buttons (publish-buttons.tsx → `setArticleStatusAction`): "Xuất bản phiên bản này"
  (when `canPublish` and viewing version ≠ publishedVersion), "Lưu trữ" (confirm), and a ButtonLink "Sửa (tạo phiên bản mới)"
  → `?edit=1`. With `?edit=1` and `canEdit`, show the editor prefilled from the viewed version instead of the read view.
- Editor (editor.tsx → `saveArticleAction`): hidden id (empty for new), title*, language* select, brandId, marketId selects
  (from `getCatalog`, passed as props), tags (comma separated), body* textarea (monospace, 18 rows, hint "Markdown đơn giản:
  # tiêu đề, - gạch đầu dòng"). On success toast and navigate to `/tri-thuc/{id}` is NOT available from the action result —
  for a new article just toast "Đã tạo bài" and show a link "Về danh sách" (`/tri-thuc`).
- `moi/page.tsx`: permission `knowledge.edit` via `pageUser("knowledge.edit")`, header "Viết bài mới", editor empty.

### 4.5 `content` — demo knowledge articles and tickets (JSON only)

- Outputs: `fixtures/knowledge.json`, `fixtures/tickets.json`. Fictional only; no real brands; no medical claims; no real
  carrier tracking numbers (use patterns like `DEMO123456`).
- Read `fixtures/catalog.json` (brands LUMI, NOVA for PIALPHA; ORBI for TEAM-EU), `prisma/seed.ts` (markets).
- `fixtures/knowledge.json`: array of 20 `{ "workspace": "PIALPHA"|"TEAM-EU", "brand": code|null, "market": code|null,
  "language": "vi"|"en"|"ar"|"de", "title", "tags": [..], "body": markdown 8–25 lines, "publish": true|false,
  "revision": null | { "title", "body" } }`. Topics: COD confirmation and refusal policy (AE/SA/KW), delivery times per market,
  return/exchange policy, warranty for home goods (LUMI/ORBI), skin-care usage & patch-test disclaimer (NOVA, no medical claims),
  damaged-on-arrival handling, refund timing, how to answer "where is my order", tone guide per language. At least 4 per
  language; 14 PIALPHA, 6 TEAM-EU; 16 publish:true; 4 with a `revision` (to demo "has newer draft").
- `fixtures/tickets.json`: array of 30 `{ "key": "T001", "workspace", "brand", "market", "type": GIAO_CHAM|LOI_HANG|DOI_TRA|BAO_HANH|KHAC,
  "priority": THAP|TRUNG|CAO|KHAN, "status": MOI|DANG_XU_LY|CHO_KHACH|DA_GIAI_QUYET|DONG, "subject" (Vietnamese, ≤ 80 chars),
  "language", "hoursAgo": 1..240, "messages": [ { "kind": "CUSTOMER"|"REPLY"|"NOTE", "minutesAfter": int, "text" } ] }`.
  First message kind CUSTOMER in the ticket language; REPLY in the same language; NOTE always Vietnamese (internal). Status
  spread: MOI 6, DANG_XU_LY 8, CHO_KHACH 5, DA_GIAI_QUYET 7, DONG 4; MOI tickets have only the CUSTOMER message; 8 tickets with
  hoursAgo ≤ 6 and priority CAO/KHAN (so some are overdue). Type spread covers all five types.

## 5. Report back

Job id, files written, last line of `npx tsc --noEmit` and of the checker, contract gaps, doubts.

## 6. Acceptance (Claude, not the executor)

1. `run_agy.py` exit 0: no error, no timeout, no `stray_write`.
2. Claude re-runs checker + `npx tsc --noEmit`, reads every file (contract, permission flags, masking, 4 states, Vietnamese copy,
   tokens, overlay rule, client/server boundary, idempotency key, no HTML injection) and samples every language in the content.
3. Browser at 1440/768; merge; `npm test`; `next build`; one LEDGER row per job.

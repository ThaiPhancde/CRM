# 07 — Work order: Phase 8 AI admin pages, multilingual lexicon, rule table tests (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Split **70/30** (D-54). Claude built the LLM adapter, AI core (runs, tools, approvals, budget),
> the six AI features, the assistant box and in-page AI drawers. You build the AI admin pages, the lexicon content in Arabic/German
> and table tests. Acceptance: Claude, never the executor's report (section 6).

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Each job delivers only the files in its brief.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`.
2. `src/components/ui.tsx`, `src/components/form.tsx`, `src/components/overlay.tsx` (reuse components).
3. `src/lib/format.ts` (`dateTime`, `date`, `num`, `ago`).
4. THE CONTRACT (use exactly, do not edit): `src/modules/ai/history.ts` (`listRuns`, `getRun`, `listApprovals`, `aiStats`), `src/modules/ai/labels.ts`,
   `src/app/(app)/ai/actions.ts` (`decideApprovalAction`, `setBudgetAction`), `src/app/(app)/ai/assistant-box.tsx` (`AssistantBox`),
   `src/app/(app)/ai/evidence.tsx` (`EvidenceList`), `src/adapters/llm/replay.ts` (`parseSearch`, `parseAssistant`, `norm`), `src/modules/ai/redact.ts`,
   `src/adapters/llm/pricing.ts` (`costUsd`, `DEFAULT_PRICES`).
5. Examples: `src/app/(app)/hanh-trinh/[id]/page.tsx` (server pagination + status filter tabs via searchParams), `src/app/(app)/quan-tri/diem/page.tsx` (admin tables).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files listed in your brief.
- Server pages: `pageUser("ai.run")` then `bindTenant(user)` (only import allowed from `@/lib/db`), then services. Never `db`, `rootDb`, `workspaceDb`,
  `@prisma/client` values. Sections needing other permissions: show approvals only when `can(user.roles, "ai.approve")`, costs only when
  `can(user.roles, "ai.budget")` (import `can` from `@/lib/permissions`); never call `listApprovals`/`aiStats` without the permission.
- Client/server boundary: `"use client"` files import values only from `@/modules/*/labels` (types via `import type`); server pages never import
  UPPER_CASE constants from `"use client"` files.
- Use EXACT labels from `@/modules/ai/labels`: `FEATURE_LABEL`, `RUN_STATUS_LABEL`/`RUN_STATUS_TONE` (OK, NEEDS_CLARIFICATION, DENIED, ERROR),
  `TOOL_LABEL`, `TOOL_STATUS_LABEL`/`TOOL_STATUS_TONE` (OK, DENIED, ERROR, PENDING_APPROVAL), `APPROVAL_STATUS_LABEL`/`APPROVAL_STATUS_TONE`
  (PENDING, APPROVED, REJECTED). Never invent statuses.
- USD amounts: format with 4 decimals (`Number(x).toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })` + " USD"); show
  metric codes AI-01 (runs/tokens/USD), AI-02 (accepted suggestions / total), AI-03 (denied tool calls / total).
- Vietnamese copy with diacritics; 4 states (empty states with a hint; errors via toast); captions on tables; labels on inputs; no raw hex colours;
  one overlay at a time.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p8-ai/checker.py <job> .` until `checker: OK`.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields/routes/actions.

## 3. Style

`PageHeader` title "Trung tâm AI", crumbs "Phân tích › Trung tâm AI", description "Trợ lý chạy với quyền của bạn; mọi câu trả lời có bằng chứng,
mọi lần chạy có chi phí. Demo dùng mô hình replay — không gọi mạng." Tabs as links with `?tab=` (`tro-ly` default, `lich-su`, `duyet`, `chi-phi`),
same pill style as the status tabs in `hanh-trinh/[id]/page.tsx`.

## 4. Briefs

### 4.1 `ai-admin-ui` — /ai and /ai/[id]

- Outputs: `src/app/(app)/ai/page.tsx` (server), `src/app/(app)/ai/[id]/page.tsx` (server), `src/app/(app)/ai/approval-buttons.tsx` (client),
  `src/app/(app)/ai/budget-form.tsx` (client).
- Tab `tro-ly`: Card "Trợ lý" containing `<AssistantBox />`, plus a short list "Bạn có thể hỏi" (6 bullets: tóm tắt khách ở trang khách hàng, tìm tự
  nhiên ở thanh tìm kiếm đầu trang, tóm tắt hội thoại và soạn phản hồi ở ticket/nhu cầu mua, tạo việc/lịch hẹn, hỏi báo cáo REV-01…04).
- Tab `lich-su`: `listRuns(user, { page, feature, status })` from searchParams (validate `feature` ∈ `AI_FEATURES`, `status` ∈ the 4 statuses). Filter
  pills for status; a `<select>` (GET form) for feature. Table (caption): Thời điểm (`dateTime`), Người dùng (only when `seesAll`), Tính năng
  (`FEATURE_LABEL`), Yêu cầu (`input`, truncate 80 chars), Kết quả (status badge), Tool (badges `TOOL_LABEL` + status tone), Bằng chứng (count),
  Token (in/out), Chi phí (USD 4 decimals), Thời gian (ms). Row links to `/ai/{id}`. Server pagination (50/page, Trước/Sau). Empty: "Chưa có lần
  chạy nào" + hint "Thử hỏi trợ lý ở tab Trợ lý".
- Tab `duyet` (only with `ai.approve`): `listApprovals(user, status)` where status from `?trang-thai=` ∈ PENDING (default) / APPROVED / REJECTED / ALL.
  Table: Lúc tạo, Người yêu cầu, Nội dung (tool → `TOOL_LABEL[tool]` + key args `title`/`dueAt`/`assigneeId`; suggestion → "Cập nhật nhu cầu:
  {payload.interest}" with link `/nhu-cau/{entityId}`), Lý do, Trạng thái badge, Người duyệt + lúc duyệt, Thao tác: approval-buttons.tsx when
  PENDING and `!mine` (mine → muted "Yêu cầu của bạn"). Link to run `/ai/{runId}`. Empty: "Không có yêu cầu chờ duyệt".
- approval-buttons.tsx (props `id`): two forms → `decideApprovalAction` (hidden `id`, `approve` "1" / "0"); reject asks `window.confirm`; optional
  `note` input; `useActionState` + toast (message from result).
- Tab `chi-phi` (only with `ai.budget`): `aiStats(user)`. Stat cards: "Lượt chạy · AI-01" (`ai01.runs`), "Token · AI-01", "Chi phí tháng · AI-01"
  (USD), "Chấp nhận đề xuất · AI-02" (`accepted/total` + %), "Từ chối quyền · AI-03" (`denied/total` + %). Budget card: spent / limit (or "Không
  giới hạn") with a thin bar `bg-brand` (danger tone when ≥ 90%), budget-form.tsx. Tables: theo tính năng (`FEATURE_LABEL`), theo model
  (provider · model), theo người dùng (runs). Note line: "Giá ước tính theo bảng giá cấu hình (USD / 1 triệu token); mô hình replay = 0 USD."
- budget-form.tsx: input `monthlyUsd` (number, step 0.01, empty = no limit) → `setBudgetAction`, toast.
- `/ai/[id]`: `getRun(user, id)` (`notFound()` on HttpError 404). Header "Lần chạy · {FEATURE_LABEL}", crumbs Trung tâm AI › Lịch sử. Cards: Thông tin
  (người dùng, thời điểm, provider/model, ms, status badge, error if any), Chi phí (token in/out, USD), Yêu cầu (`input` in a pre-wrapped block —
  already redacted), Kết quả (`output` as formatted JSON in `<pre>` with `overflow-x-auto`), Bằng chứng (`<EvidenceList items={evidence} />`),
  Tool đã gọi (table: tool label, status badge, args JSON short, error), Đề xuất (kind, status, payload).

### 4.2 `ai-lexicon` — Arabic + German (and more Vietnamese/English) for the replay model

- Outputs: `fixtures/ai/lexicon.json`, `fixtures/ai/reply-templates.json` (both exist — modify).
- lexicon.json: KEEP every existing key and every existing phrase (tests depend on them); ADD phrases so that every list in `target`, `fulfillment`,
  `cancelled`, `repeat`, `period`, `intents`, `metrics`, `groupByMarket`, `tomorrow`, `todayWords`, `customerMarkers` contains at least one Arabic
  phrase (Arabic script) and at least one German phrase; `markets` gets Arabic and German country names for every code. Phrases must be
  lowercase-insensitive natural words a user would type (e.g. de "fehlgeschlagen", "zugestellt", "diesen monat", "kunde", "bestellung",
  "termin", "erinnere mich", "umsatz"; ar "طلب", "عميل", "هذا الشهر", "موعد", "ذكرني", "الإيرادات"). No duplicates within a list.
- reply-templates.json: KEEP `vi`, `en`; ADD `ar` and `de` with the same shape: `greeting` (with `{{name}}`), `status` for exactly
  UNFULFILLED, IN_TRANSIT, PARTIAL, DELIVERED, FAILED, RETURNED (each with `{{order}}`), `noOrder` (asks for the order number, no
  placeholder), `kb` (with `{{excerpt}}`), `closing` (with `{{brand}}`). Polite customer-service tone; no promises of refunds, discounts, dates or
  prices; Arabic in Arabic script.

### 4.3 `ai-tests` — table tests for pure AI helpers

- Output: `tests/ai-rules.test.ts` (vitest).
- Import `parseSearch`, `parseAssistant`, `norm` from `@/adapters/llm/replay`, `redactText`, `redactDeep` from `@/modules/ai/redact`, `costUsd`,
  `DEFAULT_PRICES` from `@/adapters/llm/pricing`. Use only phrases that ALREADY exist in `fixtures/ai/lexicon.json` (Vietnamese/English); fixed
  `today` (e.g. "2026-11-02") and a fixed markets list (ids you make up, codes AE, SA, DE).
- `it.each` tables: `parseSearch` — target orders vs customers; each fulfillment code; cancelled; repeat; every period key (exact from/to dates
  computed by hand from the code, incl. last_month across a year boundary with today "2026-01-15"); market by phrase and by bare code; quoted name
  and order code → `q`; explain entries. `parseAssistant` — appointment / task / report (metric detection + groupBy market) / find order / find
  customer / nothing → `[]`; customer name from quotes and after "khách"; time "10h", "14:30", "3 pm"; tomorrow vs today (ISO computed from the
  code, timezone +07:00). `redactText` — sk- keys, Bearer tokens, "password=…", connection strings with user:pass, JWT, long hex → "[đã ẩn]"; phone
  and email masked only when `pii: false`; `redactDeep` on nested objects/arrays. `costUsd` — replay 0; claude-sonnet-5-5 1,000,000 in + 1,000,000 out
  = 12; unknown model 0; haiku small numbers. At least 45 rows. Expected values MUST follow the code exactly; if you think code is wrong, keep the
  test matching the code and list the doubt.

## 5. Report back

Job id, files written, last line of tsc and checker, contract gaps, doubts.

## 6. Acceptance (Claude)

Claude re-runs checker + tsc, reads every file (permissions per section, labels, USD formatting, empty states), checks test expectations by
hand, runs vitest, opens pages at 1440/768, merges, LEDGER rows.

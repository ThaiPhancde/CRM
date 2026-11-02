# 11 — Work order: Phase 11.2 UI/UX fixes from the review (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Two read-only reviewers audited every screen; Claude verified the findings and fixes the logic ones
> (toast top layer, AI summary errors, kanban error state, ticket counts, knowledge duplicate create, tabs on the customer page, own forms).
> These two jobs are the mechanical copy / accessibility / confirm-dialog changes. Acceptance: Claude.

## 1. Context

Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI. Read only: `AGENTS.md`, `docs/ui-design-system.md`, the files of your brief,
`src/components/confirm.tsx` (`ConfirmButton`, already done), `src/components/ui.tsx`, `src/components/form.tsx`.

## 2. Hard rules

- Modify ONLY the files listed in your brief. Change UI text, ARIA attributes and the confirm mechanism only — never business logic, service calls,
  server actions, imports from `@/modules/*` other than labels, or data shapes. Never touch `db`, `@prisma/client`.
- Vietnamese with diacritics. Keep every existing feature working; `npx tsc --noEmit` must exit 0 (max three rounds), then
  `python -I ai-jobs/p11-ux/checker.py <job> .` until `checker: OK`.
- MUST NOT: edit other files; git; npm install; build; dev server; network.

## 3. Briefs

### 3.1 `confirm-modal` — replace `window.confirm` with `ConfirmButton`

Files (each has exactly one `confirm(` call): `src/app/(app)/nhiem-vu/task-buttons.tsx`, `src/app/(app)/xac-minh/buttons.tsx`, `src/app/(app)/xac-minh/customer-reviews.tsx`,
`src/app/(app)/khach-hang/[id]/unmerge-button.tsx`, `src/app/(app)/ai/approval-buttons.tsx`, `src/app/(app)/ket-noi/view.tsx`,
`src/app/(app)/chien-dich/[id]/status-buttons.tsx`, `src/app/(app)/quan-tri/diem/recompute-button.tsx`, `src/app/(app)/hanh-trinh/[id]/status-buttons.tsx`.
- Replace the `confirm(...)`-guarded submit with `<ConfirmButton action={same server action} fields={{ same hidden fields }} label=… title=… description=… confirmLabel=… danger={destructive} ariaLabel=… />`.
  `title` = the question the old confirm asked (shortened), `description` = the consequence in one sentence, `confirmLabel` = the verb ("Hủy nhiệm vụ", "Gộp hai đơn", "Tách lại hồ sơ", "Từ chối", "Tạm dừng", "Tính lại điểm"…).
  Destructive or irreversible actions use `danger`. Buttons in these files that had no confirm stay as they are.
- Every button repeated per row/card in these files gets an `aria-label` with its context, e.g. `Gộp đơn ${orderNumber}`, `Xong nhiệm vụ ${title}`.
- In `xac-minh/buttons.tsx` and `xac-minh/customer-reviews.tsx` never toast an empty string: use `state.message || (state.ok ? "<default success>" : "Không thực hiện được.")`.

### 3.2 `copy-a11y` — consistent Vietnamese terms, no internal jargon, accessible names

Files: `src/app/(app)/page.tsx`, `src/app/(app)/ai/page.tsx`, `src/app/(app)/ai/[id]/page.tsx`, `src/app/(app)/ai/conversation-panel.tsx`, `src/app/(app)/chien-dich/page.tsx`,
`src/app/(app)/chien-dich/[id]/page.tsx`, `src/app/(app)/chien-dich/[id]/touchpoint-form.tsx`, `src/app/(app)/bao-cao/[nhom]/page.tsx`, `src/app/(app)/bao-cao/[nhom]/sections/marketing.tsx`,
`src/app/(app)/bao-cao/[nhom]/sections/sales.tsx`, `src/app/(app)/bao-cao/[nhom]/sections/van-don.tsx`, `src/app/(app)/quan-tri/nguoi-dung/view.tsx`, `src/app/(app)/quan-tri/chi-so/page.tsx`,
`src/app/(app)/quan-tri/vai-tro/page.tsx`, `src/app/(app)/quan-tri/cau-hinh/page.tsx`, `src/app/(app)/quan-tri/cau-hinh/forms.tsx`, `src/app/(app)/quan-tri/danh-muc/view.tsx`,
`src/app/(app)/nhu-cau/page.tsx`, `src/app/(app)/nhu-cau/create-lead.tsx`, `src/app/(app)/nhu-cau/[id]/page.tsx`, `src/app/(app)/nhu-cau/bulk-bar.tsx`, `src/app/(app)/nhu-cau/[id]/claim-button.tsx`,
`src/app/(app)/nhiem-vu/page.tsx`, `src/app/(app)/hang-doi/page.tsx`, `src/app/(app)/hanh-trinh/[id]/page.tsx`, `src/app/(app)/phan-khuc/page.tsx`, `src/app/(app)/xac-minh/page.tsx`.
(`ket-noi/view.tsx` belongs to job 3.1 — do not edit it here.)
- Terms in visible text (JSX text, labels, placeholders, titles, aria-labels, column headers — NOT identifiers, URLs, object keys or enum values):
  "Lead"/"lead" → "nhu cầu mua" ("Nhu cầu mua" at sentence start; "Nhận lead này" → "Nhận nhu cầu này"); "Brand" → "Thương hiệu"; "Shop" → "Cửa hàng";
  "Customer 360" → "hồ sơ khách"; "frequency cap" → "giới hạn liên hệ"; "Tool" → "Công cụ"; "Tham số (args)" → "Tham số"; "Nội dung (payload)" → "Nội dung";
  labels "source" / "medium" / "utm_content" → "Nguồn" / "Kênh" / "Nội dung quảng cáo"; "tags" → "Thẻ phân loại".
- Remove internal jargon from visible text: "Phase <n>", decision codes like "D-44" / "D-55", "L1/L2", "npm run …", "replay" (say "dữ liệu mẫu" or "chế độ demo"). Rephrase as business language.
- `ai/conversation-panel.tsx`: wrap the decorative "✦" in `<span aria-hidden>`; give the waiting text `role="status"`; move any button out of a `<label>`.
- Link tabs (`role="tablist"` / `role="tab"` on `<Link>`) in `nhiem-vu/page.tsx`, `xac-minh/page.tsx`, `quan-tri/danh-muc/view.tsx`: change to `<nav aria-label="…">` with links carrying `aria-current={active ? "page" : undefined}` (copy `src/app/(app)/van-don/page.tsx` lines 33–37).
- Repeated per-row buttons in `phan-khuc/page.tsx` and `quan-tri/cau-hinh/forms.tsx` ("Chạy ngay", "Sửa", "Lưu") get a contextual `aria-label`.
- `hanh-trinh/[id]/page.tsx` and `ai/page.tsx`: when a filter or page is active and the list is empty, show "Không có kết quả khớp bộ lọc" with a "Xóa lọc" link instead of the first-time empty state.
- `bao-cao/[nhom]/sections/marketing.tsx`: put `<Metric code="MKT-02" …>` in the cost-per-lead column header (renamed "Chi phí / nhu cầu mua").

## 4. Report back

Job id, files changed, last line of tsc and checker, doubts (do not change logic to resolve a doubt — list it).

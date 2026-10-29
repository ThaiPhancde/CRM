# Handoff

Checkpoint mới nhất ở trên. Phiên sau: đọc `AGENTS.md` → checkpoint này → `implementation-status.md` → `decisions.md` "Còn mở" → chạy `npm run typecheck && npm test`.

## Checkpoint 29/10/2026 (lần 9) — nghiệm thu Phase 3–5

**Đã làm:** theo yêu cầu người dùng, nghiệm thu Phase 3–5 theo tiêu chí thiết kế mục 10 — tất cả đạt. Biên bản: `docs/acceptance/phase-3-5.md`. Lần đầu bấm thử gộp → tách khách trên trình duyệt (trước chỉ có test), kiểm che PII/tiền qua đường xuất CSV với vai Marketing, chạy worker thật trên DB demo (tự đóng 5 lead im lặng — dữ liệu demo đã đổi).

**Chờ người dùng:** ký nghiệm thu chính thức cùng giám đốc (D-30); xác nhận Q-22, Q-23, D-48, D-49.

**Bước tiếp theo:** Phase 6.

## Checkpoint 29/10/2026 (lần 8) — Phase 5 xong, chờ nghiệm thu

**Đã làm:** ticket + SLA, tri thức có phiên bản, ticket trong hàng đợi, nhắc SLA. Chi tiết: `implementation-status.md` Phase 5.

**Quyết định mới:** D-50 (SLA, phạm vi ticket, khách có ticket vào phạm vi Sales, tri thức).

**Chạy thêm:** `npx prisma migrate deploy` → `npm run db:seed` (SlaPolicy mẫu) → `npx tsx --env-file=.env scripts/seed-service.ts` (DB mới thì `db:seed-demo` gọi sẵn). Thử: Lê Trưởng Nhóm → Ticket; Vũ Vận Đơn → chỉ thấy ticket giao chậm/đổi trả; Đỗ Marketing → Tri thức (soạn, xuất bản).

**Quy ước mới:** loại sự kiện/nhãn dùng chung lấy từ `src/lib/status-badge.ts` hoặc `modules/*/labels.ts` — không để Gemini tự đặt tên enum; work order nên liệt kê đúng giá trị enum.

**Chờ người dùng:** nghiệm thu Phase 3–5; Q-22, Q-23 (số SLA), D-48 (khối lượng mục tiêu), D-49 (7/14 ngày).

**Bước tiếp theo:** Phase 6 — chỉ số, chấm điểm, Warehouse (MetricDefinition, CustomerMetric, RFM, Score v1 có phiên bản/lý do; Warehouse interface + Postgres).

## Checkpoint 29/10/2026 (lần 7) — kiểm chịu tải + nâng cấp, sắp vào Phase 5

**Đã làm:** đo tải trên 1 team/12 tháng (DB `crm_load`), sửa toàn bộ chỗ chậm (trước 8/27 → sau 0/28), luồng lead khối lượng lớn (chống trùng, tự đóng, tự Đã mua, hàng loạt, Kanban một người). Kế hoạch sửa: thiết kế mục 2 (D-48, D-49), mục 5 quy tắc 11, prompt nền, prompt Phase 4 và 9, checklist mục 12; AGENTS.md; architecture NFR. Chi tiết: `docs/performance.md`, `implementation-status.md`.

**Chạy:** `npx prisma migrate deploy` (2 migration index mới — trên DB lớn mất ~1 phút). Đo lại: xem `docs/performance.md` mục 2.

**Quy ước mới:** mọi `@relation` mới kèm `@@index`; ô tìm "chứa chuỗi" kèm index trigram; job worker đánh dấu đã xử lý; thông báo hàng loạt phải gộp; phase có bảng/màn hình lớn thêm phép đo vào `scripts/load/bench.ts`.

**Chờ người dùng:** xác nhận khối lượng mục tiêu (D-48) theo quy mô thật; ngưỡng 7/14 ngày (D-49); nghiệm thu Phase 3 + 4.

**Bước tiếp theo:** Phase 5 (người dùng đã yêu cầu làm tiếp).

## Checkpoint 29/10/2026 (lần 6) — Phase 2 đã rà, Phase 4 xong, chờ nghiệm thu

**Đã làm:** rà Phase 2 (vá `NOT_OWNER`); Phase 4 nhu cầu mua + không gian sales (lead, phân công, Kanban, hàng đợi, nhiệm vụ, nhắc hạn, Outbox SIMULATED). Phase 3 chưa nghiệm thu nhưng người dùng yêu cầu đi tiếp. Chi tiết: `implementation-status.md` Phase 4.

**Quyết định mới:** D-45 (phạm vi lead/khách/đơn), D-46 (phân công), D-47 (thông báo + Outbox, worker 1 phút).

**Chạy thêm:** `npx prisma migrate deploy` → `npm run db:seed` (thêm `leadRouting` + Đặng Sales) → `npx tsx --env-file=.env scripts/seed-sales.ts` (60 lead; DB mới thì `db:seed-demo` gọi sẵn). Đăng nhập Phạm Sales/Đặng Sales để thấy hàng đợi riêng; Lê Trưởng Nhóm thấy cả nhóm.

**Quy ước mới:** hằng số/nhãn dùng ở client đặt trong module thuần (`src/modules/sales/labels.ts`); không export hằng số từ file `"use client"` cho trang server; khóa idempotency trên form sinh trong `useEffect`. Service không gọi `requirePerm` phải tự `bindTenant(user)`. Checker p4 có luật bắt hai lỗi ranh giới client/server — chép sang lô sau.

**Chờ người dùng:** nghiệm thu Phase 3 + 4; xác nhận Q-22 (quy tắc phân công, 30 lead/người), Q-23 (4 giờ phản hồi).

**Bước tiếp theo:** Phase 5 — dịch vụ sau bán + tri thức (Ticket/SLA/KnowledgeArticle; ticket vào hàng đợi; Gemini: `/cham-soc`, `/tri-thuc`, 20 bài tri thức 4 ngôn ngữ).

## Checkpoint 29/10/2026 (lần 5) — tiền quy đổi chung đổi sang VND

**Đã làm:** theo yêu cầu người dùng, mọi giá trị báo cáo quy về VND thay USD (D-44). Cột đổi tên `FxRate.rateToBase`, `Order.netBase`, `Customer.valueBase12m`; dữ liệu cũ đã quy đổi bằng migration (không cần reset). Định dạng: `base()` trong `src/lib/format.ts`.

**Chạy:** `npx prisma migrate deploy` (DB khác máy này) → `npm test`. Dev server phải dừng trước `prisma generate` (Windows khóa file engine).

**Quy ước mới:** không viết "USD" cứng cho giá trị quy đổi; dùng `base()` / `BASE_CURRENCY`. Chi phí AI (`costUsd`, Phase 8) vẫn là USD vì giá nhà cung cấp tính bằng USD.

**Bước tiếp theo:** như lần 4 — chờ nghiệm thu Phase 3, rồi Phase 4.

## Checkpoint 29/10/2026 (lần 4) — Phase 3 xong, chờ nghiệm thu

**Đã làm:** Customer 360 — hợp nhất khách theo D-08/D-41, gộp/tách có ảnh chụp, che PII theo quyền ở mọi dịch vụ, trang `/khach-hang`, hồ sơ 360, tab Khách ở `/xac-minh`. Lần đầu chạy tỷ lệ mới (Gemini làm giao diện + test SĐT). Chi tiết: `implementation-status.md` Phase 3.

**Quyết định mới:** D-40 (sửa cách hiểu chủ nhóm D-32), D-41 (SĐT + bằng chứng gộp), D-42 (quyền PII), D-43 (giá trị 12 tháng).

**Chạy thêm:** `npx tsx --env-file=.env scripts/resolve-customers.ts` (chạy bù khách — `db:seed-demo` đã gọi sẵn); `scripts/reapply-latest.ts <mã shop>` (áp lại phiên bản mới nhất sau khi đổi quy tắc); `scripts/resync-store.ts <mã shop>`.

**Quy ước mới:** mọi SĐT/email trả ra ngoài đi qua `piiFor(user)`; giao diện chỉ hiển thị cái service trả (null → "—"). Giao Gemini: viết service + action + test trước, work order kèm trang mẫu + checker (cấm import `@/lib/db` trong view) — mẫu ở `ai-jobs/p3-ui/`. Worktree Gemini cần `git merge --ff-only main` và junction `node_modules` trước mỗi batch.

**Chờ người dùng:** nghiệm thu Phase 3; cân nhắc lại cách đo tỷ lệ 60/40 (đếm dòng cho ra 45/55 vì JSX dài).

**Bước tiếp theo:** Phase 4 — nhu cầu mua + không gian sales (Gemini: kanban, hàng đợi, nhiệm vụ, fixture lead/hội thoại).

## Checkpoint 28/10/2026 (lần 3) — Phase 2 xong, chờ nghiệm thu

**Đã làm:** kết nối dữ liệu (khung adapter + Pancake/Shopify phát lại), đơn chuẩn nhiều nguồn, hàng đợi xác minh gộp/tách, trang `/ket-noi`, `/don-hang`, `/xac-minh`, `/san-pham`, worker đồng bộ. Code Phase 0–1 đã đẩy lên https://github.com/ThaiPhancde/CRM (nhánh `main`). Chi tiết + kết quả test: `implementation-status.md` Phase 2.

**Quyết định mới:** D-36 (định dạng phát lại Pancake giả định; dữ liệu sinh tất định), D-37 (quy tắc nghi trùng và liên kết), D-38 (xuất CSV có BOM thay xlsx), D-39 (cấu hình demo Team EU hư cấu).

**Chạy (thêm so với Phase 1):**
```bash
npx prisma migrate deploy && npm run db:seed && npm run db:seed-demo   # ~2 phút, 1.963 đơn
npm run worker -- --once          # một lượt đồng bộ các kết nối đến hạn
npx tsx --env-file=.env scripts/retry-errors.ts   # chạy lại mọi sự kiện lỗi sau khi sửa nguyên nhân
```
Reset DB demo `crm` (chỉ khi người dùng đồng ý): `npx prisma migrate reset --force --skip-seed` rồi seed lại — Prisma chặn lệnh này khi AI gọi nếu không có biến đồng ý.

**Còn dở:** không.

**Chờ người dùng:** nghiệm thu Phase 2 (Quản lý → Đơn hàng, chuyển Team EU → lọc "đơn có nhiều nguồn", mở `/xac-minh` thử gộp và tách lại); trả lời Q-14 khi biết team nào có đơn đi qua hai nền tảng.

**Bước tiếp theo:** Phase 3 — Customer 360 (hợp nhất khách từ `Order.customer*` + nguồn, chuẩn SĐT E.164, gộp/tách có bằng chứng). Áp dụng tỷ lệ mới **Claude 60 / Gemini 40** (D-27, chỉnh 29/10): Claude làm schema + service + test trước, giao Gemini trang `/khach-hang`, trang 360, tab Khách ở `/xac-minh`, bảng test SĐT (`antigravity-workflow.md` mục 4).

**Quy ước mới (Phase 2):** dịch vụ chạy nền dùng `workspaceDb(id)` thay vì ngữ cảnh ALS; server action dùng `runAction()` ở `src/lib/action.ts`; nhãn trạng thái lấy từ `src/lib/status-badge.ts`, định dạng tiền/ngày từ `src/lib/format.ts`; mapper nền tảng là nơi DUY NHẤT biết hình dạng bản ghi gốc.

## Checkpoint 28/10/2026 (lần 2) — Phase 1 xong, chờ nghiệm thu

**Đã làm:** nền tảng Next.js 15 + Prisma + PostgreSQL + Tailwind 4; cô lập workspace; đăng nhập thử; quyền; giao diện trắng–cam; trang quản trị; seed. Chi tiết và kết quả test: `implementation-status.md` Phase 1.

**Quyết định mới:** D-34 (vai trò cố định trong code), D-35 (danh mục không xóa, tỷ giá chỉ thêm).

**Chạy:**
```bash
npm install
# .env đã có (gitignore): DATABASE_URL=crm, TEST_DATABASE_URL=crm_test trên PostgreSQL 18 localhost:5432
npx prisma migrate deploy && npm run db:seed
npx next dev -p 3217        # http://localhost:3217 → /dang-nhap
npm test && npm run typecheck
```

**Còn dở:** không có lát dở.

**Chờ người dùng:**
1. Nghiệm thu Phase 1 trên trình duyệt (đăng nhập từng vai, sửa danh mục, thêm thành viên).
2. Cho phép **commit lần đầu** để tạo worktree `../CRM2-gemini` cho batch Gemini (Phase 2 dự kiến giao sinh fixture đơn 12 tháng).

**Bước tiếp theo:** Phase 2 — kết nối dữ liệu + đơn chuẩn (prompt ở bản thiết kế mục 10).

## Quy ước code (đặt ở Phase 1)

- Cấu trúc: `src/lib/*` (lõi: db, session, permissions, audit, idempotency, errors), `src/modules/<tên>/service.ts` (nghiệp vụ, kiểm quyền + zod + audit), `src/app/(app)/...` (trang; `page.tsx` server tải dữ liệu, `view.tsx` client), `src/components/*` (ui, overlay, data-table, form, shell, nav).
- **Ngữ cảnh workspace không truyền ngược qua `await`.** Dịch vụ gọi `requirePerm(user, …)` ở dòng đầu (đồng bộ) là đủ. Trang truy vấn `db` trực tiếp phải gọi `bindTenant(user)` ngay sau `await pageUser(…)` / `await currentUserOrRedirect()`. Script/test dùng `runInWorkspace` hoặc `workspaceDb(id)`.
- `Membership` không lọc tự động (bảng phân quyền toàn hệ thống) → lọc tường minh `workspaceId: user.workspaceId`.
- Server action chỉ chuyển FormData → service, trả `ActionResult { ok, message, fields, values }`; form dùng `pick(state, row)` để hiện lại giá trị vừa nhập khi lỗi.
- Test: `tests/*.test.ts`, mỗi lần chạy dùng mã riêng (`RUN`), không xóa dữ liệu, chạy trên `crm_test`.
- Dev server bỏ qua thư mục do công cụ ghi (`next.config.ts`) — đừng bỏ, nếu không Playwright làm dev server biên dịch lại liên tục.

## Checkpoint 28/10/2026 (lần 1) — Phase 0 đặc tả

Bộ tài liệu thiết kế + vai trò; D-00…D-27. Đã xong.

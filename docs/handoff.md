# Handoff

Checkpoint mới nhất ở trên. Phiên sau: đọc `AGENTS.md` → checkpoint này → `implementation-status.md` → `decisions.md` "Còn mở" → chạy `npm run typecheck && npm test`.

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

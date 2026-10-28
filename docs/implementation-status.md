# Trạng thái triển khai

Mới nhất ở trên. Mỗi mục: đã làm · test đã chạy (lệnh + kết quả thật) · còn thiếu/bị chặn · phần Claude / phần Gemini phụ trợ, tỷ lệ ước tính (mục tiêu ~80/20, D-27).

## Tổng quan

| Phase | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| 0 Audit + đặc tả | **Xong bản nháp, chờ duyệt** | 28/10/2026 | Bộ tài liệu vai trò + thiết kế + prompt phase; chưa có code |
| 1 Nền tảng, quyền, UI shell | **Xong, chờ nghiệm thu** | 28/10/2026 | 22 test xanh; thử trình duyệt 2 vai; chưa commit/worktree |
| 2 Kết nối + đơn chuẩn | Chưa | | |
| 3 Customer 360 | Chưa | | |
| 4 Nhu cầu mua + sales | Chưa | | |
| 5 Dịch vụ + tri thức | Chưa | | |
| 6 Chỉ số + điểm + Warehouse | Chưa | | |
| 7 Journey + marketing | Chưa | | |
| 8 Trung tâm AI | Chưa | | |
| 9 Báo cáo + dashboard | Chưa | | |
| 10 Vận đơn + sản phẩm | Chưa | | |
| 11 Quản trị + rà soát UI + chạy thử | Chưa | | |
| 12 Lên thật | Ngoài demo | | |

## Phase 1 — đã làm (28/10/2026)

**Lát 1.0 — hai agent.** `git init` (main, chưa commit). `agy` 1.4.9 headless trả READY; model Gemini 4 Argon / 3.8 Flash có sẵn. Runner sửa 4 mục chặn + thêm test/mutant (`docs/antigravity-workflow.md` mục 7). Chưa tạo worktree vì repo chưa có commit.

**Lát 1.1 — schema + cô lập.** Prisma schema tổ chức (`prisma/schema.prisma`), migration `init_org`. `src/lib/db.ts`: `db` tự lọc/gán `workspaceId`, thiếu ngữ cảnh → lỗi; chặn ghi sang workspace khác kể cả tạo lồng; `runInWorkspace` tự await (lỗi thật phát hiện qua test: PrismaPromise trả ra ngoài chạy sau khi rời ngữ cảnh). `audit.ts`, `idempotency.ts` (dựa unique của DB, nhả khóa khi lỗi).

**Lát 1.2 — đăng nhập + quyền.** `session.ts` (JWT HS256 cookie httpOnly, chọn workspace, quản trị công ty mang MANAGER ở team không có membership), `permissions.ts` (vai trò cố định, D-34), `current-user.ts` (`pageUser` → 404 khi thiếu quyền). Đăng nhập thử kiểm `DEMO_LOGIN` ở server action. Google OIDC: chỉ có nút tắt khi có `GOOGLE_CLIENT_ID` — **chưa có route OIDC** (để Phase 12).

**Lát 1.3 — giao diện trắng–cam.** Token + Tailwind 4 theme, font Be Vietnam Pro; `AppShell` (sidebar 248/64px thu gọn nhớ lựa chọn, drawer menu ở < 1024px, topbar chọn team + menu người dùng); `Drawer`/`Modal` dùng `<dialog>` gốc + khóa một lớp phủ; `DataTable` (tìm, sắp, phân trang 25/50/100, rỗng/không khớp); form có lỗi inline và giữ giá trị vừa nhập khi lỗi; `loading.tsx` (skeleton), `error.tsx` (thử lại), 404. Trang: Tổng quan, Người dùng, Vai trò & quyền, Danh mục (brand/shop/thị trường/nhóm/tỷ giá), Nhật ký. Mục menu phase sau hiện mờ kèm nhãn P2…P10.

**Lát 1.4 — seed.** `npm run db:seed`: 2 team (PiAlpha, Team EU), 3 brand, 5 shop (pancake/shopify, hư cấu), thị trường US/DE/FR/AE/SA/KW, tỷ giá về USD, 9 người mẫu đủ vai. Chạy hai lần cho cùng kết quả.

**Test đã chạy (28/10):**
- `npx vitest run` → 2 file, **22/22 passed** (cô lập workspace 4, quyền 2, phiên 4, idempotency/audit 4, thành viên 3, danh mục 5).
- `npx tsc --noEmit` → sạch. `next build` → thành công, 8 route.
- `python -I tools/agy-runner/test_run_agy.py` → ALL PASSED, 15/15 mutant.
- Trình duyệt (Playwright, 1440/1920/768): chưa đăng nhập → `/dang-nhap`; Quản lý đăng nhập → Tổng quan; sửa shop gửi dữ liệu sai → lỗi inline đúng 3 ô, giữ giá trị vừa nhập; sửa đúng → drawer đóng, toast, bảng cập nhật; Sales gõ thẳng `/quan-tri/danh-muc` → 404; menu Sales ẩn mục quản trị; menu dạng drawer ở 768. Ảnh: `tests/e2e/shots/p1-*.png` (gitignore).

**Chưa làm / còn hở:**
- Chưa có E2E tự động kiểm "mở drawer rồi mở modal" — chưa trang nào dùng Modal; khóa một lớp phủ mới kiểm bằng đọc code. Làm ở Phase 11.2.
- Route Google OIDC chưa có (chỉ nút tắt).
- Chưa commit lần nào → chưa có worktree Gemini.
- Phase 1 tỷ lệ: Claude 100% / Gemini 0% (xem `antigravity-workflow.md` mục 7).

## Phase 0 — đã làm (28/10/2026)

- Cài BA-KIT 51 skill vào `.claude/` từ `D:\Work\SKILL BA\install.sh`.
- Viết `Thiet_ke_CRM_va_prompt_Claude.md`, `AGENTS.md`, `CLAUDE.md`, `docs/{decisions,requirements,questions-for-manager,architecture,data-model,permissions,system-flow-diagram,ui-design-system,demo-strategy,metrics,integrations,antigravity-workflow,implementation-status,handoff,future-expansion}.md`.
- Copy runner Gemini vào `tools/agy-runner/` (MIT), tạo `ai-jobs/`.
- Chưa: `git init`, kiểm `agy`, test runner, bất kỳ code nào.
- Test: không có.
- Bị chặn: người dùng duyệt D-01…D-27 và trả lời/giữ mặc định Q-xx.

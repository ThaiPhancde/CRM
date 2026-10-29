# Trạng thái triển khai

Mới nhất ở trên. Mỗi mục: đã làm · test đã chạy (lệnh + kết quả thật) · còn thiếu/bị chặn · phần Claude / phần Gemini phụ trợ, tỷ lệ ước tính (mục tiêu ~60/40 từ Phase 3, D-27).

## Tổng quan

| Phase | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| 0 Audit + đặc tả | **Xong bản nháp, chờ duyệt** | 28/10/2026 | Bộ tài liệu vai trò + thiết kế + prompt phase; chưa có code |
| 1 Nền tảng, quyền, UI shell | **Xong, chờ nghiệm thu** | 28/10/2026 | 22 test xanh; thử trình duyệt 2 vai; chưa commit/worktree |
| 2 Kết nối + đơn chuẩn | **Xong, chờ nghiệm thu** | 28/10/2026 | 32 test xanh; demo 1.963 đơn / 5 shop; Gemini 1 batch |
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

## Phase 2 — đã làm (28/10/2026)

**Lát 2.1 — khung connector.** Schema `Connection`, `SyncRun`, `SyncCheckpoint`, `SourceEvent` (migration `phase2_connectors_orders`). `src/adapters/connectors/`: kiểu `NormalizedOrder` (zod), registry theo mã nền tảng (D-28), mapper Pancake (định dạng phát lại giả định, CXM) và Shopify (Admin GraphQL giản lược, TL), nguồn phát lại đọc `fixtures/replay/<mã shop>.json`, nguồn live trả 501 có giải thích. Cấu hình kết nối mã hóa AES-256-GCM (`src/lib/crypto.ts`). `runSync`: khóa chống chạy chồng (409), checkpoint lùi 10 phút, thống kê từng lượt, đặt kết nối ERROR khi lượt thất bại. Chạy lại sự kiện lỗi.

**Lát 2.2 — đơn chuẩn.** `Product`/`Variant`/`SourceProductMapping`; `Order` (4 trạng thái tách, tiền Decimal nguyên tệ + tỷ giá chốt theo ngày đặt + USD), `OrderItem` (đặt/giao/hoàn theo dòng), `Payment`, `Refund`, `Shipment`, `DeliveryEvent`. `src/modules/orders/ingest.ts`: chống trùng theo eventKey, bản cũ đến muộn = STALE theo từng liên kết nguồn, chủ nhóm trường order/payment/fulfillment (D-32), thiếu tỷ giá = ERROR có lý do.

**Lát 2.3 — liên kết hai nguồn.** `SourceOrderLink`, `OrderLinkReview`, `MergeLog`, `Setting` (`linkRules`, `sourceOfTruth`). Tự liên kết khi đúng một đơn khớp quy tắc; nghi trùng → hàng đợi (D-37). Gộp có ảnh chụp, tách lại khôi phục đơn cũ cùng id.

**Lát 2.4 — giao diện + worker.** `/ket-noi` (thẻ kết nối, lượt đồng bộ, Đồng bộ ngay / Nạp lịch sử / Chạy lại lỗi / Tạm dừng, thêm kết nối), `/don-hang` (lọc GET, phân trang server 50/trang, ô REV-01 quy USD, lọc đơn nhiều nguồn, xuất CSV có BOM), `/don-hang/[id]` (dòng hàng, tổng tiền + tỷ giá chốt, dòng thời gian giao hàng, nguồn liên kết + trạng thái gốc, nhật ký bản ghi nguồn), `/xac-minh` (so cạnh nhau, gộp / không phải, tách lại), `/san-pham`. Worker `npm run worker` (`--once`). Quyền mới: `integration.manage/view`, `order.view/link`, `product.view`.

**Dữ liệu demo.** `npm run db:seed-demo`: 42 sản phẩm / 67 SKU (Gemini), sinh 8.288 bản ghi phát lại 12 tháng (tất định), nạp qua luồng đồng bộ thật → **1.963 đơn, 2.003 liên kết nguồn, 40 đơn Shopify–Pancake tự liên kết, 3 cặp chờ xác minh, 118 bản cũ đến muộn bị bỏ qua, 185 bản gửi lặp bị loại, 0 lỗi**.

**Test đã chạy (28/10):**
- `npx vitest run` → 3 file, **32/32 passed** (Phase 2: 10 ca — trùng hai nguồn tính một lần + REV-01 đúng 102,6 USD; DUPLICATE; STALE; giao/hoàn một phần; nghi trùng → gộp → tách lại; thiếu tỷ giá → ERROR → chạy lại; D-32 chủ nhóm giao hàng; nền tảng thứ ba chỉ cần đăng ký adapter; khóa đồng bộ chồng 409; che tiền + cô lập workspace).
- `npx tsc --noEmit` sạch; `next build` thành công (12 route); `npm run worker -- --once` exit 0.
- Trình duyệt (1440): `/don-hang` Team PiAlpha 1.350 đơn; đơn #6025 Team EU 2 nguồn, trạng thái giao lấy từ Pancake; `/xac-minh` 3 cặp; `/ket-noi` đồng bộ ngay → 1 trùng bỏ qua; CSV 200, `text/csv`, BOM EF BB BF.

**Lỗi thật phát hiện và sửa trong phase:** seed tỷ giá có hiệu lực từ 2026 trong khi dữ liệu bắt đầu 10/2025 → hệ thống từ chối quy đổi đúng thiết kế (288+ ERROR), sửa seed về 2025 rồi chạy lại lỗi thành công; bộ sinh dữ liệu đẩy "bản đến muộn" trùng phiên bản đã gửi nên chỉ ra DUPLICATE thay vì STALE — sửa để phiên bản đến muộn chỉ tới sau phiên bản mới hơn.

**Chưa làm / còn hở:**
- Gộp/tách trên trình duyệt chưa bấm thử (nút có hộp thoại xác nhận của trình duyệt); đã có test tự động.
- Sales thấy mọi đơn của team (chưa giới hạn theo khách được giao — Phase 4).
- SĐT so 9 chữ số cuối (Phase 3 thay bằng E.164).
- Webhook Shopify mô phỏng chưa làm (live chưa bật); `Settlement`/đối soát COD ở Phase 10.
- Tỷ lệ: Claude ~93% / Gemini ~7%.

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

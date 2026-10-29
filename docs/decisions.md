# Quyết định

Nguồn: HLD (`CRM_Global_AI_HLD_Open_Source.md`), bản thiết kế (`Thiet_ke_CRM_va_prompt_Claude.md`), yêu cầu người dùng 28/10/2026 (demo đầy đủ chức năng, trắng – cam, tích hợp BigQuery/insight khách).

Trạng thái: **ĐÃ CHỐT** (người dùng xác nhận) · **MẶC ĐỊNH** (Claude đặt theo HLD/mẫu công ty, dùng được ngay, người dùng có thể đổi) · **MỞ** (chưa trả lời, có mặc định tạm nếu ghi).

## Đã chốt (người dùng, 28/10/2026)

| Mã | Quyết định |
|---|---|
| D-00 | **Bản demo trước, chưa triển khai thật.** Demo phải đủ chức năng chính; lên thật chỉ cần cắm API/BigQuery/những gì hệ thống chưa có. |
| D-15 | UI đẹp, **màu chủ đạo trắng và cam**, bố cục không chồng chéo. |
| D-19 | Mục tiêu nghiệp vụ: CRM tích hợp BigQuery, tìm insight khách hàng; chi tiết theo HLD. |
| D-20 | Bộ skill BA-KIT cài vào `.claude/`; cấu trúc tài liệu theo mẫu Purchasing System. |
| D-28 | **Nền tảng bán hàng là chung chung.** Không giả định luồng "đơn Shopify đẩy sang Pancake" hay team nào dùng nền tảng nào (người dùng từ team PiAlpha lên mức công ty, chưa rõ cách các team khác triển khai). `Store.platform` là mã adapter đăng ký (mở rộng được); Pancake POS và Shopify chỉ là hai adapter đầu để chứng minh khung đa nguồn. Quy tắc liên kết đơn giữa hai nguồn cấu hình theo cặp nền tảng (`linkRules`), không hard-code. Ví dụ Shopify→Pancake trong HLD §5.2 chỉ là minh họa. |
| D-29 | **Workspace = team/đơn vị kinh doanh**, không phải công ty con. Công ty chính là LevelUp; ví dụ team PiAlpha. "Quản trị tập đoàn" đổi tên hiển thị thành **Quản trị công ty** (LevelUp), nhìn chéo team. Thực thể vẫn tên `Workspace`. |
| D-30 | Người nghiệm thu bản demo: **người dùng và giám đốc**. |
| D-31 | B2B (Companies/Deals cho ABC, EurroGO): **có thể**, kiểm khả thi và mức cần thiết trước; demo giữ B2C, chừa khung (`future-expansion.md`). |
| D-27 | **Kết hợp Antigravity (Gemini), Claude chỉ đạo — tỷ lệ khoảng 60/40** (người dùng chỉnh 28/10 từ "80/20", chỉnh lại 29/10 thành 60/40). Claude làm ~60%: thiết kế, contract (zod/kiểu TS/chữ ký service), Prisma schema/migration, `db`/`session`/quyền, logic tiền, chống trùng, liên kết/gộp, chấm điểm, journey, tool AI + prompt, tích hợp, review mọi diff, nghiệm thu, cập nhật docs. Gemini làm ~40% qua `tools/agy-runner/run_agy.py`: **phần lớn trang giao diện** dựng trên service Claude đã viết và test, fixture/dữ liệu mẫu, nội dung đa ngôn ngữ, test bảng cho hàm thuần, test E2E theo kịch bản, ảnh chụp rà soát. Gemini không quyết định gì; batch thất bại hoặc agy không sẵn sàng thì Claude tự làm, dự án không bị chặn. Quy trình `docs/antigravity-workflow.md`. |

## Mặc định (Claude đặt, chờ người dùng đổi nếu muốn)

| Mã | Quyết định | Lý do |
|---|---|---|
| D-01 | Stack Next.js 15 + TypeScript + PostgreSQL + Prisma 6 + Tailwind 4, worker Node riêng. Không FastAPI. | Cùng stack Purchasing System; tái dùng mẫu `bindTenant`, Decimal, worker, backup. HLD §10.1 cho phép tiếp tục nền TypeScript/PostgreSQL. |
| D-02 | Modular monolith, DB riêng `crm`. | `CRM2_Claude_Antigravity_Tom_tat.md` §7. |
| D-03 | Nhiều workspace (= team, D-29) tách hoàn toàn, `workspaceId` mọi bảng, thiếu ngữ cảnh thì từ chối. | Mẫu T-53 Purchasing; HLD §6.1 không chia sẻ hồ sơ giữa workspace. |
| D-04 | Workspace ≠ Brand ≠ Store ≠ Market; Market là danh mục. | HLD §2, §6.2. |
| D-05 | Warehouse interface: Postgres (demo) / BigQuery (thật). Màn hình hằng ngày không chờ warehouse. | HLD §2 [S1], §9. |
| D-06 | Một đơn kinh doanh, nhiều liên kết nguồn; chỉ tự gộp khi có mã tham chiếu gốc. | HLD §5.2. |
| D-07 | Tách trạng thái đơn/thanh toán/giao/hoàn; cập nhật muộn không ghi đè. | HLD §4, §14.2. |
| D-08 | Gộp khách bằng SĐT E.164, email xác minh, mã khách nguồn; tên/IP không đủ. | HLD §6.1. |
| D-09 | Tiền Decimal(18,4), nguyên tệ + tỷ giá + ngày + USD báo cáo; tỷ giá demo seed cố định, sửa ở Danh mục. | HLD §6.2; từ điển chỉ số LevelUp L2 (hợp nhất về USD). |
| D-10 | Bốn mốc doanh thu REV-01 Đặt / REV-02 Xác nhận / REV-03 Giao thành công / REV-04 Thực thu; cấm "doanh thu" trần. | `levelup-company-os/06-tu-dien-chi-so.md` L1. |
| D-11 | Điểm = quy tắc + SQL có phiên bản/lý do/dữ liệu thiếu; LLM không sinh xác suất. Trọng số khởi đầu 25/35/25/15. | HLD §7.2, §8.2. |
| D-12 | LlmProvider: replay (demo) / Anthropic `claude-sonnet-5-5` (khi có khóa). AgentRun/ToolCall/Approval. | HLD §8.4, §8.6. |
| D-13 | `DEMO_MODE=replay`, `EXTERNAL_WRITES_ENABLED=false`; mọi gửi ra ngoài vào Outbox `SIMULATED`. | CRM2 doc §7. |
| D-14 | Đăng nhập thử theo vai, `DEMO_LOGIN=true`; Google OIDC khung. | Mẫu Purchasing. |
| D-16 | Audit chỉ thêm; idempotency key cho hành động lặp. | HLD §4, §14.2. |
| D-17 | Mỗi phase: vitest + kiểm thử trình duyệt trên seed; cập nhật status + handoff. | Mẫu Purchasing. |
| D-18 | Seed demo: công ty LevelUp với 2 workspace = team (PiAlpha, Team EU — hư cấu), 3 brand, 5 store trên ≥ 2 nền tảng (Pancake POS, Shopify; hư cấu, không phản ánh team thật dùng gì), 6 market (US, DE, FR, AE, SA, KW), ~300 khách, ~2.000 đơn/12 tháng, có cặp giao dịch xuất hiện ở hai nguồn (để chứng minh liên kết đơn), COD 4 mốc, ticket, hội thoại. Hạt cố định. | Đủ để demo mọi tình huống POC HLD §14.2; thị trường lấy từ 12 thị trường LevelUp. |
| D-21 | Vai trò: Quản trị công ty, Quản lý, Trưởng nhóm sales, Sales/CSKH, Marketing, Vận đơn, Mua hàng (xem), Kế toán (xem tiền). | HLD §3 + cơ cấu team LevelUp (MKT, Sales, Mua hàng, Vận đơn). |
| D-22 | Ngôn ngữ UI: tiếng Việt. Nội dung gửi khách hỗ trợ vi, en, ar, de (replay). | 12 thị trường; HLD §8.1. |
| D-23 | Thời hạn SLA và chu kỳ demo tính theo ngày lịch; giờ làm việc theo market chỉ dùng cho "giờ địa phương" khi gửi. | Đơn giản cho demo; mẫu Purchasing D1. |
| D-24 | Khách "giá trị cao" tạm = ≥ 3 đơn REV-03 trong 12 tháng; ngưỡng ở Cấu hình. | Cần ngưỡng để demo ưu tiên ticket; HLD §7.3 nói ngưỡng theo thị trường, để sau. |
| D-25 | Tích hợp Purchasing System chỉ đọc (giá vốn, tồn) qua adapter `PurchasingLink`, demo dùng fixture. | HLD §1.2, §3. |
| D-26 | Thư viện biểu đồ: Recharts; xuất Excel: `xlsx` (cùng Purchasing). | Có sẵn trong công ty. |
| D-32 | MẶC ĐỊNH: **Nguồn chính theo trường** (HLD §5.3) là cấu hình `Setting.sourceOfTruth` theo cặp nền tảng; "mới hơn thắng" (`sourceUpdatedAt`) chỉ áp giữa các bản của nguồn chủ trường, nguồn khác không ghi đè. | Tránh bản cũ/không chủ ghi đè dữ liệu đúng; HLD §5.3 yêu cầu cấu hình theo luồng. |
| D-33 | MẶC ĐỊNH: Trọng số điểm 25/35/25/15 và các trọng số khác là **giả thuyết v1** (HLD §7.2), không phải chuẩn. Demo chỉ ghi phiên bản; hiệu chỉnh cần đối chiếu điểm với kết quả thật (DA_MUA, hoàn) theo thời gian ở Phase 12, qua `Prediction.evaluatedAt`/`Experiment`. | Trọng số sai làm sales ưu tiên sai khách; chưa có dữ liệu thật để kiểm. |
| D-34 | MẶC ĐỊNH (Phase 1): **Vai trò cố định, ma trận quyền trong code** (`src/lib/permissions.ts`), `Membership.roles` là danh sách enum — không có bảng `Role` sửa được trên giao diện; trang Vai trò & quyền chỉ xem. Quản trị công ty là cờ `User.isCompanyAdmin`, ở team không có membership thì mang Quản lý. | Mẫu Purchasing System; quyền tùy biến trên giao diện là rủi ro bảo mật và chưa có nhu cầu. Đổi khi có yêu cầu vai trò tùy chỉnh. |
| D-35 | MẶC ĐỊNH (Phase 1): Danh mục **không xóa**, chỉ ngừng dùng (`active=false`) để không gãy dữ liệu đã tham chiếu; **tỷ giá chỉ thêm mốc mới**, không sửa mốc cũ (giữ lịch sử quy đổi). Mã danh mục viết hoa, duy nhất trong team; mã nền tảng của shop là chuỗi chữ thường tự do (D-28). | Bảo toàn lịch sử tiền và tham chiếu (D-09, D-16). |
| D-36 | MẶC ĐỊNH (Phase 2): **Định dạng phát lại Pancake là giả định** (mã trạng thái 0–6, sự kiện giao hàng dạng chữ) vì chưa có tài liệu API (CXM); mapper Shopify theo tên trường Admin GraphQL nhưng giản lược (TL). Phase 12 đối chiếu và chỉ sửa file mapper + test. Dữ liệu demo 12 tháng **sinh bằng script tất định** (`scripts/gen-fixtures.ts`, hạt 20261028) mỗi lần seed, không đưa vào git; danh mục sản phẩm `fixtures/catalog.json` (Gemini sinh, Claude duyệt) có commit. | Không bịa API thật; dữ liệu tái lập được. |
| D-37 | MẶC ĐỊNH (Phase 2): **Nghi trùng** = cùng SĐT (so 9 chữ số cuối, Phase 3 thay bằng E.164) + chênh giá trị USD ≤ 1% + đặt cách ≤ 30 phút + khác kết nối → tạo hàng đợi xác minh, không tự gộp. **Liên kết tự động** chỉ khi đúng một đơn khớp `linkRules`; nhiều đơn khớp → không gắn. Gộp giữ đơn đặt sớm hơn, lưu ảnh chụp đơn kia để tách lại. | HLD §5.2, D-06. |
| D-38 | MẶC ĐỊNH (Phase 2): Xuất danh sách đơn là **CSV UTF-8 có BOM** (Excel mở đúng tiếng Việt), tối đa 10.000 dòng; không thêm thư viện `xlsx` (gói SheetJS trên npm đã cũ, có lỗ hổng). Số tiền để trống khi thiếu quyền xem tiền. Thay D-26 phần "xuất Excel". | Bậc thang: định dạng có sẵn trước thư viện mới. |
| D-39 | MẶC ĐỊNH (Phase 2): Demo Team EU cấu hình `linkRules` Shopify.mã đơn ↔ Pancake.ghi chú và `sourceOfTruth = {fulfillment: "pancake"}` (Shopify chủ nhóm đơn/thanh toán, Pancake chủ nhóm giao hàng) — **hư cấu** để minh họa D-28/D-32, không phản ánh team thật. | Q-14 còn mở. |

## Còn mở (chưa trả lời; mặc định tạm trong ngoặc)

| Mã | Câu hỏi | Mặc định tạm |
|---|---|---|
| D-M1 | Danh sách shop/nền tảng thật và market ưu tiên khi lên thật (HLD §15). | Seed D-18 |
| D-M2 | Dataset BigQuery nào dùng (dataset PiAlpha và KPI views chưa xác minh — HLD không nhắc) và ai cấp service account. | Postgres warehouse |
| D-M3 | Định nghĩa "giao dịch hợp lệ" cho RFM với COD: tính từ REV-03 hay REV-04? | REV-03, có cột REV-04 riêng |
| D-M4 | Quyền đọc hội thoại Inbox Pancake có được cấp không. | Không; hội thoại demo là fixture |
| D-M5 | Phạm vi ghi ngược (task/ghi chú có đẩy về Pancake không). | Không ghi ngược |
| D-M6 | Ngôn ngữ thật cần hỗ trợ ngoài vi/en/ar/de. | 4 ngôn ngữ |
| D-M7 | Ngân sách AI/tháng và model khi lên thật. | Chưa có |
| D-M8 | Có tiếp tục nền Comp AI CRM / Twenty không hay xây riêng (HLD §13). | Xây riêng trên stack D-01, mượn mẫu agent của Comp AI |

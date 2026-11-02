# Checklist lên thật — điểm cắm tích hợp (Phase 11.4)

Cập nhật: 02/11/2026. Viết theo **code hiện có**, không theo ý định. Bản demo chạy `DEMO_MODE=replay`, `EXTERNAL_WRITES_ENABLED=false`; mọi điểm cắm dưới đây đổi bằng biến môi trường, **không có nhánh `if (demo)` trong nghiệp vụ**. Mỗi bước bật riêng; bước lùi là đặt lại biến về giá trị demo và khởi động lại app + worker.

Mức xác minh endpoint (theo `docs/integrations.md`): **XM** đã chạy thật · **TL** theo tài liệu công khai, chưa chạy · **CXM** chưa có tài liệu.

Test hợp đồng: `tests/contracts.test.ts` (và BigQuery ở `tests/scoring.test.ts`). Phần **luôn chạy** kiểm khung thật trả 501 có hướng dẫn khi thiếu cấu hình (demo không thể vô tình gọi thật). Phần **chạy thật** bị bỏ qua khi thiếu khóa; Phase 12 điền khóa vào môi trường test rồi chạy `npx vitest run tests/contracts.test.ts`.

## 1. Bảng điểm cắm

| Điểm cắm | Hiện trạng trong code | Biến môi trường | Bật thật cần làm | Xác minh | Test hợp đồng | Rủi ro chính |
|---|---|---|---|---|---|---|
| **Pancake POS** (đơn, khách, giao/COD) | `src/adapters/connectors/pancake.ts` (map + schema zod), nguồn chọn theo `Connection.mode`; `live` → 501 (`registry.ts`) | `Connection.mode = live`; khóa lưu mã hóa trong `Connection.configEncrypted` bằng `INTEGRATION_SECRET_KEY` | Cài `liveSource` gọi API theo tài liệu đối tác (**CXM** — chưa có tài liệu chính thức), phân trang + retry có giới hạn + rate limit | Backfill 1 shop 7 ngày, đối chiếu số đơn và tổng tiền với POS; chạy lại không tạo trùng (idempotency `SourceEvent`) | `Pancake: backfill 1 shop 7 ngày` (skip khi thiếu `PANCAKE_API_KEY`; shop thử `PANCAKE_TEST_SHOP`) | Endpoint/field khác giả định; webhook đang phục vụ hệ khác (HLD §1.2) → dùng polling |
| **Shopify** | `shopify.ts` (GraphQL-shaped), `live` → 501 | như trên | Cài GraphQL Admin `orders`/`customers`, kiểm HMAC webhook, job đối chiếu | Backfill 60 ngày; webhook thử; đơn > 60 ngày cần quyền `read_all_orders` (Q-13) | `Shopify: backfill 60 ngày` (skip khi thiếu `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_SHOP`) | Quyền protected customer data chưa xin (Q-13) |
| **Inbox / hội thoại** | **Chưa có adapter** — hội thoại demo sinh bằng seed (`scripts/seed-sales.ts`) | — | Viết connector `listConversations(since)` theo D-28 (đăng ký adapter + fixture, không sửa nghiệp vụ) | Hội thoại vào thành `Activity` MESSAGE, tóm tắt AI đọc được | Chưa có | Quyền hội thoại (Q-12, D-M4) |
| **Kho phân tích BigQuery** | `src/adapters/warehouse` — cùng SQL cho Postgres/BigQuery (`dialect`); BigQuery → 501 | `WAREHOUSE=bigquery`, `GOOGLE_APPLICATION_CREDENTIALS`, `BIGQUERY_DATASET` | `npm i @google-cloud/bigquery`, cài `BigQueryWarehouse.read/refreshCustomerMetrics`, service account **chỉ đọc** + `maximumBytesBilled` | `refreshCustomerMetrics` rồi so REV-01..04 với Postgres cùng kỳ; báo cáo tài chính hai bên khớp | `BigQuery dry-run` (`tests/scoring.test.ts`, skip khi thiếu credentials) | Dataset công ty chưa xác minh (D-M2); chi phí truy vấn |
| **LLM (Anthropic)** | `src/adapters/llm/anthropic.ts` (khung tool use, đếm chi phí); thiếu khóa/thiếu gói → 501 | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `LLM_MODEL` (mặc định `claude-sonnet-5-5`) | `npm i @anthropic-ai/sdk`; đặt ngân sách tháng ở `/ai?tab=chi-phi` | Chạy 6 chức năng AI trên dữ liệu test, xem chi phí AI-01, kiểm tool thiếu quyền vẫn bị chặn | `Anthropic: một câu ngắn` (skip khi thiếu `ANTHROPIC_API_KEY`) | Chi phí; dữ liệu khách gửi ra ngoài — chỉ ngữ cảnh đã lọc quyền/PII (`src/modules/ai/redact.ts`) |
| **Gửi tin ra ngoài** (email/SMS/WhatsApp) | Mọi gửi đi qua `enqueueOutbox` (`src/lib/notify.ts`); khác `EXTERNAL_WRITES_ENABLED=true` → `SIMULATED`; **chưa có bộ gửi** đọc hàng `PENDING` | `EXTERNAL_WRITES_ENABLED`, (cần thêm) `SMTP_URL`, `MAIL_FROM` | Viết worker gửi `PENDING` theo kênh (nodemailer/nhà cung cấp SMS), cập nhật `SENT/FAILED`, retry | Gửi thử về hộp thư nội bộ; tin hành trình vẫn tôn trọng giới hạn liên hệ + khung giờ | Luôn chạy: `SIMULATED` khi tắt | Gửi nhầm khách thật → bật từng kênh, bắt đầu bằng email nội bộ |
| **Ghi ngược POS / hãng vận chuyển** (giao lại, hủy) | Chỉ ghi yêu cầu vào Outbox kênh `CARRIER` / `POS` (D-13, D-58) | — | Ngoài phạm vi demo; cần đồng ý của chủ hệ thống nguồn | — | — | Ghi sai trạng thái đơn ở POS |
| **Mua hàng (Purchasing System)** | `src/adapters/purchasing` — fixture; `api` → 501 | `PURCHASING_LINK=api`, `PURCHASING_API_URL`, `PURCHASING_API_KEY` | Cài nhánh `live` khi Purchasing có API (Q-16) | Đọc 1 SKU có giá vốn + tồn theo thị trường; "Lấy giá vốn" cập nhật CM-01 | `Purchasing: đọc 1 SKU` (skip khi thiếu `PURCHASING_API_URL`; SKU `PURCHASING_TEST_SKU`) | Purchasing chưa có API |
| **Đăng nhập Google (SSO)** | Nút hiện khi có `GOOGLE_CLIENT_ID` nhưng **chưa có luồng OIDC** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_HD` | Cài OIDC (callback, kiểm `hd` = tên miền công ty, ánh xạ email → `User`), rồi tắt `DEMO_LOGIN` | Đăng nhập tài khoản công ty; tài khoản ngoài tên miền bị từ chối | Chưa có | Bật SSO mà quên tắt `DEMO_LOGIN` |

## 2. Trước khi bật bất kỳ điểm cắm nào

- [ ] `DEMO_LOGIN=false` ở môi trường thật; `SESSION_SECRET`, `INTEGRATION_SECRET_KEY` là chuỗi ngẫu nhiên riêng của môi trường (không dùng giá trị dev).
- [ ] `npm run db:deploy` (migration), `npm run db:seed` (danh mục) — **không** chạy `db:seed-demo` trên dữ liệu thật.
- [ ] Sao lưu: `npm run backup` (cần `pg_dump`; đặt `PG_BIN` nếu không có trên PATH) → `backups/<db>-<thời điểm>.dump`; khôi phục `pg_restore -c -d <db> <file>`. Lên lịch sao lưu hằng ngày ở hệ điều hành.
- [ ] Worker chạy riêng (`npm run worker`, `WORKER_INTERVAL_MIN`).
- [ ] Migration tạo chỉ mục trên bảng lớn: chạy `CREATE INDEX CONCURRENTLY` ngoài transaction trên DB đang chạy thay vì `prisma migrate deploy` thô (migration demo tạo chỉ mục trong transaction — khóa bảng khi dữ liệu lớn; `docs/performance.md`).
- [ ] Bí mật chỉ ở biến môi trường / kho bí mật; không có trong git, log, frontend (kiểm `git grep -i "api_key\|secret"`).
- [ ] Đo tải trên bản sao dữ liệu thật (`scripts/load/bench.ts` chỉ chạy trên DB `*_load`) đạt `docs/performance.md`.

## 3. Dữ liệu cá nhân (GDPR/PDPA)

- Xuất dữ liệu một khách: trang khách → "Tải dữ liệu khách" (JSON, quyền `customer.privacy`, có audit).
- Xóa theo yêu cầu: "Xóa dữ liệu theo yêu cầu" (gõ XOA + lý do) — ẩn danh hóa khách, hồ sơ đã gộp, định danh nguồn (băm), địa chỉ, ảnh chụp khách trên đơn, bản ghi nguồn, nhu cầu mua, hội thoại, ticket, hàng đợi gửi tin; giữ đơn + số tiền.
- **Giới hạn đã biết (xử lý trước khi lên thật):** nhật ký audit cũ (chỉ thêm, D-16) có thể còn thông tin khách trong trường trước/sau; câu hỏi AI người dùng tự gõ (`AgentRun.input`) có thể chứa tên khách; nguồn (POS) gửi lại đơn cũ sẽ tạo hồ sơ khách mới. Cần chính sách lưu giữ + bộ lọc PII cho audit và AI trước khi nhận dữ liệu thật.

## 4. Thứ tự đề xuất (Phase 12, mỗi bước có bước lùi)

1. SSO + tắt đăng nhập thử → 2. Pancake 1 shop chế độ live, so số với POS 7 ngày → 3. Các shop còn lại + Shopify → 4. BigQuery (song song Postgres 2 tuần, so số) → 5. LLM thật với ngân sách nhỏ → 6. Email nội bộ → email khách (từng hành trình) → 7. Purchasing khi có API.

# Chiến lược demo và điểm cắm tích hợp thật

Cập nhật: 28/10/2026 (Phase 0). Nguồn: D-00, D-05, D-12, D-13, D-18, D-25; bản thiết kế mục 6. Mục tiêu: demo chạy đủ chức năng chính trên máy phát triển; lên thật chỉ đổi cài đặt adapter bằng env và điền khóa.

## 1. Nguyên tắc

1. Nghiệp vụ không biết đang demo. Không `if (process.env.DEMO_MODE)` trong `src/modules/*`. Chỉ `src/adapters/index.ts` đọc env để chọn cài đặt.
2. Mỗi adapter có: `interface.ts`, cài đặt replay/giả lập, cài đặt thật (khung, bỏ qua khi thiếu khóa), test hợp đồng chạy trên cả hai (thật bị `skip` khi thiếu khóa).
3. Mọi thứ ra ngoài đi qua `Outbox`; `EXTERNAL_WRITES_ENABLED=false` → trạng thái `SIMULATED`.
4. Fixture là dữ liệu hư cấu, sinh bằng seed có hạt; không chứa PII thật.

## 2. Biến môi trường (`.env.example`)

| Biến | Demo | Thật | Dùng ở |
|---|---|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | postgres cục bộ `crm`, `crm_test` | máy chủ | Prisma |
| `SESSION_SECRET` | chuỗi ≥ 32 | secret manager | auth |
| `DEMO_LOGIN` | `true` | bỏ | auth |
| `DEMO_MODE` | `replay` | `live` | adapters/index |
| `EXTERNAL_WRITES_ENABLED` | `false` | `true` từng kênh | messaging, connectors |
| `INTEGRATION_SECRET_KEY` | chuỗi ≥ 32 | secret manager | mã hóa config kết nối |
| `CONNECTOR_PANCAKE` | `replay` | `live` | adapters/connectors |
| `PANCAKE_POS_BASE_URL`, `PANCAKE_API_KEY` | trống | thật (endpoint chưa xác minh) | pancake/adapter |
| `CONNECTOR_SHOPIFY` | `replay` | `live` | adapters/connectors |
| `SHOPIFY_SHOP`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_WEBHOOK_SECRET` | trống | thật | shopify/adapter |
| `WAREHOUSE` | `postgres` | `bigquery` | adapters/warehouse |
| `GOOGLE_APPLICATION_CREDENTIALS`, `BQ_PROJECT_ID`, `BQ_DATASET` | trống | service account chỉ đọc + dataset ghi riêng | warehouse/bigquery |
| `LLM_PROVIDER` | `replay` | `anthropic` | adapters/llm |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | trống / `claude-sonnet-5-5` | thật | llm/anthropic |
| `AI_MONTHLY_BUDGET_USD` | `0` (chỉ đếm) | ngân sách | ai |
| `MESSAGING` | `outbox` | `smtp` | adapters/messaging |
| `SMTP_URL`, `MAIL_FROM`, `APP_BASE_URL` | trống | thật | messaging/smtp |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_HD` | trống | thật | auth OIDC |
| `PURCHASING_LINK` | `fixture` | `api` | adapters/purchasing |
| `PURCHASING_API_URL`, `PURCHASING_API_KEY` | trống | thật | purchasing/api |
| `WORKER_INTERVAL_MIN` | `5` | theo tải | worker |
| `PG_BIN` | đường dẫn pg_dump | — | backup |

## 3. Adapter và cài đặt

| Adapter | Interface | Replay/giả lập (demo) | Thật (khung) | Test hợp đồng |
|---|---|---|---|---|
| Pancake | `ConnectorAdapter { verify, capabilities, backfill(since,cursor), incremental(since) }` | Đọc `fixtures/pancake/{shop}/orders-YYYY-MM.json`, `customers.json`; lọc theo `since`; mô phỏng gửi lặp và đến muộn bằng cờ trong fixture | Gọi HTTP theo `docs/integrations.md` (mức xác minh ghi rõ); retry có giới hạn; rate limit | Cùng bộ test: verify đạt, backfill trả ≥ 1 trang, incremental idempotent |
| Inbox | `listConversations(since)`, `capabilities()` | `fixtures/inbox/{shop}/conversations.json` → `Activity` MESSAGE; nguồn cho tóm tắt hội thoại Phase 8 | Chưa xác minh endpoint; cần quyền hội thoại (Q-12) | verify + incremental idempotent |
| Shopify | như trên | Fixture GraphQL-shaped; webhook mô phỏng bằng route nội bộ `POST /api/dev/webhook` chỉ bật khi `DEMO_MODE=replay` | GraphQL Admin `orders`, `customers`; webhook HMAC; job đối chiếu | như trên |
| Warehouse | `Warehouse { query(sql, params), refreshMetrics(ws), freshness(ws) }` | Schema `analytics` trong Postgres: view/materialized tạo bởi `prisma/analytics.sql`; SQL chỉ số ở `src/modules/metrics/sql/*.sql` | `@google-cloud/bigquery`; cùng file SQL, hàm khác dialect qua `dialect.ts` | Chạy mọi file SQL trên Postgres; BigQuery dry-run khi có khóa |
| LLM | `LlmProvider { complete(req), completeWithTools(req, tools), estimateCost }` | `replay.ts`: phân loại intent bằng từ khóa; trả fixture `fixtures/llm/{feature}/{case}.json` có `text`, `toolCalls`, `evidence[]`, token giả; chuỗi không khớp → trả "Tôi chưa hiểu, bạn muốn…" | `@anthropic-ai/sdk`, tool use, streaming | Replay: mọi fixture parse đúng schema; thật: 1 prompt ngắn khi có khóa |
| Messaging | `Messenger { send(msg) }` | `outbox.ts`: ghi `SIMULATED` | `smtp.ts` (nodemailer) | — |
| Purchasing | `PurchasingLink { getCost(sku), getStock(sku, market) }` | Fixture | REST tới Purchasing System (chưa có API, Q-16) | — |
| Auth | `IdentityProvider` | Đăng nhập thử | Google OIDC | — |

## 4. Fixture và seed

- `prisma/seed.ts`: danh mục (D-18) — idempotent, không ghi đè chỉnh sửa trên UI.
- `prisma/seed-demo.ts`: người mẫu, khách, đơn 12 tháng (sinh từ fixture connector qua chính luồng sync replay, không insert thẳng vào `Order` để demo đúng đường đi dữ liệu), lead, ticket, hội thoại, journey, AgentRun mẫu. Hạt cố định `SEED=20261028`.
- Fixture có cờ kịch bản: `__scenario: "dup_cross_source" | "late_update" | "resend" | "partial_delivery" | "merge_ambiguous" | "cod_full_cycle"` để test và demo-script trỏ tới đúng bản ghi.
- Fixture do Gemini sinh theo zod schema Claude viết (`src/adapters/connectors/*/schema.ts`), checker = parse toàn bộ file.

## 5. Điểm cắm khi lên thật (Phase 12, chi tiết `docs/deploy-checklist.md` — viết ở Phase 11.4)

| Bước | Đổi gì | Xác minh |
|---|---|---|
| Pancake | `CONNECTOR_PANCAKE=live` + khóa; xác minh endpoint với tài liệu/đối tác | Backfill 1 shop 7 ngày, đối chiếu số đơn với POS |
| Shopify | `CONNECTOR_SHOPIFY=live` + token + webhook secret | Backfill 60 ngày, webhook test, job đối chiếu |
| BigQuery | `WAREHOUSE=bigquery` + service account + dataset | `refreshMetrics` rồi so REV-01..04 với Postgres cùng kỳ |
| LLM | `LLM_PROVIDER=anthropic` + khóa + ngân sách | Chạy 6 chức năng trên dữ liệu test, xem chi phí |
| Email | `MESSAGING=smtp`, `EXTERNAL_WRITES_ENABLED=true` cho kênh email | Gửi thử về email nội bộ |
| SSO | `GOOGLE_CLIENT_ID`… | Đăng nhập tài khoản công ty |
| Purchasing | `PURCHASING_LINK=api` | Đọc 1 SKU |

Mỗi bước bật riêng, có bước lùi là đặt lại env về demo.

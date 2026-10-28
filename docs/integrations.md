# Tích hợp: nền tảng bán hàng, warehouse, LLM

Cập nhật: 28/10/2026 (Phase 0). Nguồn: HLD §5; Purchasing System `docs/integrations.md` (endpoint Pancake/Shopify ghi "chưa xác minh"); D-06, D-07, D-13. Mức xác minh: **XM** đã chạy thật · **TL** theo tài liệu công khai, chưa chạy · **CXM** chưa có tài liệu.

## 1. Trạng thái

| Nguồn | Demo | Thật | Xác minh |
|---|---|---|---|
| Pancake POS | replay fixture | khung, chưa khóa | CXM (endpoint theo Purchasing System, chưa đối chiếu tài liệu chính thức) |
| Shopify | replay fixture | khung GraphQL Admin | TL ([S2–S4] HLD) |
| Inbox (hội thoại vào; connector độc lập, HLD §5) | replay fixture → `Activity` MESSAGE (`adapters/connectors/inbox`) | khung, chưa khóa; cần quyền hội thoại (Q-12, D-M4) | CXM (endpoint chưa xác minh) |
| BigQuery | Postgres `analytics` | khung `@google-cloud/bigquery` | TL |
| Anthropic | replay | khung SDK | TL |
| Purchasing System | fixture | chưa có API | CXM (Q-16) |

**Đã có code (Phase 2, 28/10):** `src/adapters/connectors/{types,registry,pancake,shopify}.ts`. Mapper dùng chung cho phát lại và API thật; nguồn "live" hiện trả 501 có lời giải thích (không gọi endpoint chưa xác minh). Định dạng phát lại Pancake là giả định (D-36). Thêm nền tảng: viết một `Platform` + `registerPlatform()` (có test chứng minh, `tests/orders.test.ts`).

## 2. Dữ liệu chuẩn chung

Shop (`Store`), khách (`CustomerIdentity`), đơn (`Order` + `OrderItem` + `SourceOrderLink`), thanh toán, giao hàng, hoàn. Mỗi bản ghi nguồn giữ bộ trường HLD §4 và `rawPayloadRef` (JSON lưu bảng `RawPayload` theo chính sách 90 ngày demo).

## 3. Luồng đồng bộ

1. `verify()` — đọc shop + 1 đơn, không ghi.
2. `backfill(since, cursor)` — phân trang, checkpoint sau mỗi trang, tối đa 400 ngày/lượt.
3. `incremental(since = checkpoint − 10 phút)` — theo `pollIntervalMin` (5–1440).
4. Webhook (Shopify) — xác minh HMAC, ghi `SourceEvent`, xử lý qua cùng `normalize`; demo mô phỏng bằng route dev.
5. `eventKey = platform:recordId:sourceUpdatedAt` — unique, lặp → `DUPLICATE`.
6. Lỗi → `SourceEvent.outcome = ERROR` + hàng đợi replay ở `/ket-noi`.

## 4. Ánh xạ trạng thái

### Pancake (giả định theo Purchasing; xác minh ở Phase 12)

| Pancake `status` (số/chuỗi) | `Order.status` | `fulfillmentStatus` | `paymentStatus` |
|---|---|---|---|
| mới / chờ xác nhận | BOOKED | UNFULFILLED | COD_PENDING |
| đã xác nhận | CONFIRMED | UNFULFILLED | COD_PENDING |
| đang giao | CONFIRMED | UNFULFILLED (có DeliveryEvent IN_TRANSIT) | COD_PENDING |
| đã giao | CONFIRMED | DELIVERED | COD_COLLECTED khi có mốc thu |
| hoàn / trả | CONFIRMED | RETURNED | theo Refund |
| hủy | CANCELLED | — | — |

### Shopify

| `displayFinancialStatus` | `paymentStatus` | `displayFulfillmentStatus` | `fulfillmentStatus` |
|---|---|---|---|
| PENDING | PENDING | UNFULFILLED | UNFULFILLED |
| PAID | PAID | PARTIALLY_FULFILLED | PARTIAL |
| PARTIALLY_PAID | PARTIAL | FULFILLED | DELIVERED (khi fulfillment event delivered) |
| REFUNDED / PARTIALLY_REFUNDED | REFUNDED / PARTIAL | — | — |
| `cancelledAt` có | `status = CANCELLED` | | |

Bảng ánh xạ là dữ liệu (`src/adapters/connectors/*/status-map.ts`) có test bảng; giao Gemini sinh + test, Claude duyệt.

## 5. Liên kết đơn hai nguồn (D-06)

- **Chung cho mọi cặp nền tảng (D-28).** Không giả định luồng giữa Pancake và Shopify; có xảy ra ở team nào không là câu hỏi Q-14.
- Tự liên kết theo `Setting.linkRules[]`: `{ platformA, fieldA, platformB, fieldB, normalize }` — khớp khi giá trị `fieldA` của bản ghi A (sau chuẩn hóa: bỏ `#`, khoảng trắng, hoa/thường) bằng `fieldB` của bản ghi B trong cùng workspace. Demo seed một quy tắc hư cấu giữa hai adapter đầu để chứng minh cơ chế.
- Nghi ngờ (không có quy tắc hoặc không khớp mã): cùng SĐT E.164 + chênh tiền ≤ 1% + chênh thời gian ≤ 30 phút → `OrderLinkReview`, người có `order.link` quyết.
- Nguồn chính theo trường (HLD §5.3) cấu hình ở `Setting.sourceOfTruth` theo cặp nền tảng: kênh/đặt gốc = nguồn tạo đơn trước; tiến độ xử lý = nguồn có sự kiện xử lý mới nhất; thanh toán = nơi xử lý giao dịch; giao hàng = carrier; phụ trách/task = CRM.

## 6. Ghi ngược

Tắt (D-13). Khi bật ở Phase 12: từng đối tượng, có `Approval`, `Outbox` kênh `POS_WRITEBACK`, idempotency, audit.

## 7. Warehouse

- SQL chỉ số ở `src/modules/metrics/sql/*.sql`, viết chuẩn ANSI; khác biệt qua `dialect.ts` (`DATE_TRUNC`, `SAFE_DIVIDE`, string).
- Postgres: schema `analytics`, materialized view refresh bởi worker.
- BigQuery: dataset `BQ_DATASET` ghi riêng cho CRM; không ghi vào dataset KPI/HRM hiện có của công ty. Đọc bằng service account chỉ đọc cho hỏi đáp AI, giới hạn `maximumBytesBilled`.

## 8. LLM

- Replay: intent → fixture; mọi fixture có `evidence[]` trỏ tới entity/field.
- Anthropic: tool use; `max_tokens` theo tính năng; prompt hệ thống ở `src/modules/ai/prompts/*.md` (Claude viết, không giao Gemini).
- Chi phí: bảng giá ở `Setting.llmPricing`, ước tính cả khi replay (token giả theo độ dài).

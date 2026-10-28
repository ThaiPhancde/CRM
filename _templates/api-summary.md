---
type: api-summary
feature: {{feature_slug}}
provider: {{provider}}
status: draft
updated: {{date}}
links: []
---

# {{provider}} API — Tóm tắt (cho {{feature_name}})

> Nguồn: {{doc vendor / OpenAPI / phiên bản}}. Chỉ tóm tắt operation ta dùng.

## Operations

| # | Operation | Mục đích nghiệp vụ | Method + Path | Tham số cốt lõi | Kết quả | Nguồn |
|---|---|---|---|---|---|---|
| 1 | {{tên}} | {{để làm gì trong luồng ta}} | {{POST /...}} | {{}} | {{}} | {{§mục doc}} |

## Auth

{{Mô hình mức cao: API key / OAuth / HMAC signature — KHÔNG chép secret. Header/nơi đặt.}}

## Rate limit / Quota

{{giới hạn req/s, quota — hoặc OQ}}

## Error semantics

| Mã lỗi vendor | Ý nghĩa nghiệp vụ | Nên xử lý |
|---|---|---|
| {{CODE}} | {{}} | {{retry / báo user / fallback}} |

## Webhook / Callback

{{Có/không; sự kiện nào; xác thực nguồn; idempotency vendor hỗ trợ?}}

## Môi trường

- Sandbox: {{base URL}} · Production: {{base URL}}

## Open Questions

- [ ] OQ-1: {{doc thiếu/mơ hồ}}

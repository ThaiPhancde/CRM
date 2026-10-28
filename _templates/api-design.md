---
type: api-design
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/integration/api-summary.md
  - docs/{{feature_slug}}/srs/{{feature_slug}}-spec.md
---

# {{feature_name}} — Integration Blueprint ({{provider}})

## 1. Orchestration

{{Trình tự gọi trong luồng nghiệp vụ: bước nào → gọi operation nào → chờ gì. (Sơ đồ: /sequence.)}}

| # | Bước nghiệp vụ | Operation | Đồng bộ/Bất đồng bộ | Kết quả kỳ vọng |
|---|---|---|---|---|
| 1 | {{}} | {{}} | {{}} | {{}} |

## 2. State mapping

| Trạng thái của ta | Trạng thái/Mã vendor | Hành động khi vào trạng thái |
|---|---|---|
| {{Chờ thanh toán}} | {{PENDING}} | {{}} |

## 3. Source of truth

| Dữ liệu | Chân lý | Ghi chú |
|---|---|---|
| {{số tiền}} | ta | {{}} |
| {{kết quả giao dịch}} | vendor | {{}} |

## 4. Webhook vs polling

{{Nhận kết quả bất đồng bộ kiểu nào; nếu cả hai → ưu tiên + chống trùng; xác thực nguồn webhook.}}

## 5. Retry & timeout

{{Gọi lại khi nào / mấy lần / backoff; timeout bao lâu = thất bại (chưa chốt → OQ).}}

## 6. Reconciliation

{{Đối soát khi ta & họ lệch: job rà, truy vấn trạng thái, xử lý giao dịch mồ côi.}}

## 7. Degraded UX

{{Vendor chậm/chết → user thấy gì (wording từ Error Matrix) + fallback nghiệp vụ.}}

## Open Questions

- [ ] OQ-1: {{timeout / hành vi lỗi chưa chốt}}

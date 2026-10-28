# Ví dụ chuẩn — /api-doc (tóm tắt contract vendor)

> Mẫu `/api-doc food-delivery @paygate-openapi.yaml`. File `docs/food-delivery/integration/api-summary-paygate.md`. Học: chỉ operation ta dùng; method/path giữ đúng doc để trace; auth mô tả mô hình (không chép secret); doc thiếu → OQ.

---

```markdown
# PayGate API — Tóm tắt (cho food-delivery)
> Nguồn: PayGate OpenAPI v1 (paygate-openapi.yaml). Chỉ tóm tắt operation ta dùng.

## Operations
| # | Operation | Mục đích nghiệp vụ | Method + Path | Tham số cốt lõi | Kết quả | Nguồn |
|---|---|---|---|---|---|---|
| 1 | Create Payment | Tạo giao dịch khi khách trả online (FR-food-delivery-004) | POST /v1/payments | orderId, amount, method | paymentId, status=PENDING | §Create Payment |
| 2 | Get Payment | Truy vấn trạng thái (đối soát) | GET /v1/payments/{id} | id | status | §Retrieve |
| 3 | Refund | Hoàn tiền (BR-food-delivery-003) | POST /v1/payments/{id}/refund | id, amount | refundId, status | §Refund |

## Auth
Bearer token trong header `Authorization` (đọc từ env — KHÔNG chép key).

## Error semantics
| Mã lỗi vendor | Ý nghĩa | Nên xử lý |
|---|---|---|
| INSUFFICIENT_FUNDS | Thẻ không đủ tiền | Báo user (E-food-delivery-004) + cho chọn COD |
| GATEWAY_TIMEOUT | Cổng quá tải | Retry/đối soát |

## Webhook / Callback
POST tới ta khi giao dịch chuyển trạng thái cuối; có chữ ký HMAC `X-PayGate-Signature`. Idempotency-key hỗ trợ.

## Môi trường
- Sandbox: https://sandbox.paygate.example/api · Production: https://api.paygate.example

## Open Questions
- [ ] OQ-1: Doc chưa nêu timeout khuyến nghị khi chờ kết quả (liên quan OQ-1 SRS).
```

---

**Vì sao mẫu này tốt:** (1) **Chỉ operation ta dùng** (create/get/refund) — không chép cả API. (2) Mỗi operation **trace nghiệp vụ** (FR-food-delivery-004, BR-food-delivery-003) + giữ method/path đúng doc. (3) Auth **mô tả mô hình** (Bearer) — KHÔNG chép key. (4) Mã lỗi vendor nối sang **E-food-delivery-004 wording** + fallback COD. (5) Doc thiếu timeout → **OQ**, không chế con số.

# Ví dụ chuẩn — /api-map (field mapping 3 tầng)

> Mẫu `/api-map food-delivery` (PayGate). File `docs/food-delivery/integration/api-map.md`. Học: 3 tầng field ta↔vendor↔transform; **đơn vị tiền** (đồng→cent) là bẫy kinh điển; cả out + in (webhook); field thiếu → OQ.

---

```markdown
## Create Payment — direction: out (ta → PayGate)
| Field của ta | Field vendor | Kiểu/Đơn vị | Bắt buộc | Transform | Chân lý | Ghi chú |
|---|---|---|---|---|---|---|
| Order.id | orderId | string | ✓ | — | ta | idempotency-key = orderId |
| Order.total | amount | đồng → **cent (×100)** | ✓ | 50000đ → 5000000 | ta | bẫy đơn vị! |
| Payment.method | method | enum | ✓ | "online" → "CARD" | ta | |

## Webhook kết quả — direction: in (PayGate → ta)
| Field vendor | Field của ta | Kiểu/Đơn vị | Bắt buộc | Transform | Chân lý | Ghi chú |
|---|---|---|---|---|---|---|
| paymentId | Payment.gatewayRef | string | ✓ | — | vendor | |
| status | Payment.status | enum-map | ✓ | SUCCESS→"Đã thanh toán" · FAILED→"Thất bại" | vendor | theo state-map |
| signature | — | — | ✓ | xác thực HMAC | vendor | KHÔNG lưu như field |

## Chưa map được
- [ ] OQ-1: PayGate trả mã lý do thất bại chi tiết không? (để phân biệt hết tiền vs timeout) — doc chưa rõ.
```

---

**Vì sao mẫu này tốt:** (1) **3 tầng** rõ (ta / vendor / transform). (2) **Đơn vị tiền đồng→cent (×100)** được ghi rõ — lỗi tích hợp kinh điển nếu bỏ sót. (3) Map cả **out + in (webhook)**. (4) Enum trạng thái map **theo state-map** của api-design (nhất quán). (5) `signature` **không lưu như field** (xác thực, không phải data nghiệp vụ). (6) Field vendor chưa rõ → **OQ, không bịa**. (7) `orderId` làm **idempotency-key** (an toàn gọi lại).

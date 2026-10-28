# Ví dụ chuẩn — /api-design (Integration Blueprint)

> Mẫu `/api-design food-delivery` (cổng PayGate). File `docs/food-delivery/integration/api-design.md`. Học: 7 trụ cột; state-map bám trạng thái thật; idempotency + reconciliation + degraded-UX; timeout chưa chốt → OQ-1; "API 200 ≠ nghiệp vụ xong".

---

```markdown
## 1. Orchestration
| # | Bước nghiệp vụ | Operation | Đồng bộ/Bất đồng bộ | Kết quả kỳ vọng |
|---|---|---|---|---|
| 1 | Khách chọn online, đặt đơn (FR-food-delivery-004) | Create Payment | đồng bộ | paymentId, status=PENDING |
| 2 | Chờ kết quả cuối | Webhook (in) hoặc Get Payment (đối soát) | bất đồng bộ | SUCCESS/FAILED |
| 3 | SUCCESS → chuyển đơn cho nhà hàng | (nội bộ) | — | Order "Chờ nhà hàng xác nhận" |

## 2. State mapping
| Trạng thái của ta | Trạng thái/Mã vendor | Hành động |
|---|---|---|
| Chờ thanh toán | PENDING | chờ webhook/đối soát |
| Đã thanh toán | SUCCESS | chuyển đơn cho nhà hàng |
| Thanh toán thất bại | FAILED / INSUFFICIENT_FUNDS | E-food-delivery-004 + fallback COD |

## 3. Source of truth
| Dữ liệu | Chân lý |
|---|---|
| Số tiền đơn | ta |
| Kết quả giao dịch | vendor (PayGate) |

## 4. Webhook vs polling
Chính: webhook `in` (xác thực HMAC `X-PayGate-Signature`), **chống nhận trùng bằng idempotency-key** + bỏ event tới trễ hơn trạng thái hiện tại. Dự phòng: Get Payment khi webhook chậm.

## 5. Retry & timeout
Create Payment lỗi mạng → retry ≤2 lần (backoff). Timeout chờ kết quả: **OQ-1 (SRS chưa chốt số giây)** → tạm coi PENDING, KHÔNG tự hủy.

## 6. Reconciliation
Job rà đơn PENDING > {{ngưỡng}} → gọi Get Payment đối soát; giao dịch mồ côi (vendor SUCCESS mà ta PENDING) → khớp lại + log.

## 7. Degraded UX
PayGate chậm/chết → hiện "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." (E-food-delivery-004); đơn giữ "Chờ thanh toán", cho chọn COD.

## Open Questions
- [ ] OQ-1: Timeout chờ kết quả PayGate bao nhiêu giây (kế thừa OQ-1 SRS).
```

---

**Vì sao mẫu này tốt:** (1) **7 trụ cột** đầy đủ. (2) State-map **bám trạng thái thật** (ta từ SRS, vendor từ api-summary) — không bịa. (3) Webhook **chống nhận trùng + tới trễ** (idempotency). (4) **"API 200 ≠ xong"**: chờ webhook/đối soát mới chuyển đơn. (5) Degraded-UX dùng **wording E-food-delivery-004 exact** + fallback COD. (6) Timeout chưa chốt → **OQ-1 kế thừa SRS**, không chế. (7) Có **reconciliation** cho giao dịch mồ côi (an toàn tiền).

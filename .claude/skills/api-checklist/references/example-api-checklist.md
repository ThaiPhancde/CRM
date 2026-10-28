# Ví dụ chuẩn — /api-checklist (test outline tích hợp)

> Mẫu `/api-checklist food-delivery` (PayGate). File `docs/food-delivery/test/api/api-checklist.md`. Học: mỗi mục có test_layer + direction; phủ happy + error (mã lỗi vendor + Error Matrix) + edge (retry/webhook trùng/reconcile/idempotency).

---

```markdown
## Checklist
| ID | Mục kiểm | test_layer | direction | Loại | Nguồn |
|---|---|---|---|---|---|
| ACHK-001 | Create Payment thành công → status PENDING | 3rd | out | happy | Create Payment |
| ACHK-002 | Thẻ không đủ tiền (INSUFFICIENT_FUNDS) → "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." + cho chọn COD | mixed | out | error | E-food-delivery-004 |
| ACHK-003 | Webhook SUCCESS → Order chuyển "Chờ nhà hàng xác nhận" | mixed | in | happy | design §1 |
| ACHK-004 | Webhook nhận TRÙNG (cùng idempotency-key) → KHÔNG cập nhật/trừ 2 lần | own | in | edge | design §4 |
| ACHK-005 | Webhook sai chữ ký HMAC → từ chối | own | in | edge | design §4 |
| ACHK-006 | Timeout chờ kết quả → giữ PENDING, đối soát bằng Get Payment | mixed | out | edge | design §5-6 |
| ACHK-007 | Refund đơn đã thanh toán online (BR-food-delivery-003) | 3rd | out | happy | Refund |

## Coverage
- [ ] Create/Get/Refund — ACHK-001/006/007
- [ ] Mã lỗi INSUFFICIENT_FUNDS → E-food-delivery-004 — ACHK-002
- [ ] Webhook in (happy/trùng/sai chữ ký) — ACHK-003/004/005
- [ ] Reconciliation/timeout — ACHK-006

## Open Questions
- [ ] OQ-1: Ngưỡng timeout để đối soát (kế thừa OQ-1 SRS).
```

---

**Vì sao mẫu này tốt:** (1) Mỗi mục có **test_layer + direction** (nguồn phân loại cho `/api-test`). (2) Phủ **happy + error + edge** — không chỉ happy. (3) Error dùng **wording E-food-delivery-004 exact** + fallback COD. (4) Edge tích hợp đầy đủ: **webhook nhận trùng, sai chữ ký, timeout/đối soát** (bám 7 trụ cột design). (5) `## Coverage` map về operation/E/design để không sót. (6) Timeout → **OQ kế thừa SRS**.

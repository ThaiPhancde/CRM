# Ví dụ chuẩn — /kb (bài Cơ sở tri thức)

> Mẫu 1 bài `/kb "đơn đã thanh toán online nhưng giao thất bại"`. File `docs/kb/delivery-failed-paid-order.md`. Học: Symptom bám `E-*`/trạng thái thật; Cause bám BR/FR; Resolution theo vai; quy trình chưa chốt → nêu OQ, KHÔNG chế bước.

---

```markdown
# Đơn đã thanh toán online nhưng giao thất bại

## Symptom
Khách phản ánh đơn đã thanh toán online nhưng shipper báo giao không thành công; khách hỏi về tiền đã trả.

## Cause
Đơn đã ở trạng thái "Đang giao" và đã thanh toán online (FR-food-delivery-004, FR-food-delivery-007). Khi giao thất bại, đơn không tự hoàn — cần CSKH xử lý.

## Resolution
**CSKH thao tác:**
1. Xác minh trạng thái đơn = "Đang giao" và phương thức = online đã thanh toán.
2. Xác nhận với shipper lý do giao thất bại.
3. ⚠️ Quy trình xử lý (giao lại / hoàn tiền) **đang chốt** — xem OQ-2. Trong thời gian này: hoàn tiền theo BR-food-delivery-003 (về nguồn tiền gốc, 3–5 ngày làm việc) nếu khách yêu cầu hủy.

**Khi nào escalate:**
- Khách khiếu nại quá 24h chưa được xử lý → chuyển Trưởng nhóm vận hành.

## Related
- FR-food-delivery-007 (giao đơn) · FR-food-delivery-008 (hủy + hoàn) · BR-food-delivery-003 (hoàn tiền)
- FAQ: "Bao lâu tôi nhận được tiền hoàn?"
```

---

**Vì sao mẫu này tốt:** (1) **1 bài 1 sự cố**, slug rõ (`delivery-failed-paid-order`). (2) Symptom = tình huống thật; Cause **bám FR** (FR-food-delivery-004/007), Resolution **bám BR-food-delivery-003** (hoàn 3–5 ngày) — không kỹ thuật DB. (3) Quy trình chưa chốt → **nêu OQ-2 + đánh dấu ⚠️**, KHÔNG chế bước "chờ 24h tự hoàn". (4) Resolution **theo vai** (CSKH / escalate). (5) **Related** nối FR/FAQ để tra tiếp.

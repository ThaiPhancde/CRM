# Ví dụ chuẩn — /release (ghi chú phát hành)

> Mẫu `/release 1.0.0 food-delivery` — bản **internal** và bản **customer** từ cùng nguồn. File `docs/releases/1.0.0-release-notes.md`. Học: highlight bám US done thật; known-issues trung thực (nêu OQ); customer-mode ẩn ID nội bộ.

---

## Bản internal

```markdown
# Food Delivery — Release Notes 1.0.0
> Ngày phát hành: 2026-07-27 · Đối tượng: internal

## Highlights
- **Đặt & theo dõi đơn** — khách đặt món, theo dõi trạng thái realtime. (US-001, US-002; CAP-food-delivery-01)
- **Thanh toán COD/online** — chọn COD hoặc cổng online. (US-004; FR-food-delivery-004)

## Fixes
- Sửa tính lại tổng tiền khi bớt món. (CR-20260720-002)

## Known issues
- Giao thất bại: quy trình xử lý (quay lại nhà hàng vs hoàn tiền) **chưa chốt** — OQ-2. Tạm thời CSKH xử lý thủ công.
- Timeout cổng thanh toán online chưa cấu hình cứng — OQ-1.
```

## Bản customer (cùng nguồn, ẩn ID)

```markdown
## Có gì mới
- **Đặt món & theo dõi đơn realtime** — biết đơn đang ở bước nào.
- **Thanh toán linh hoạt** — COD hoặc thanh toán online.

## Lưu ý
- Nếu giao hàng không thành công, vui lòng liên hệ CSKH để được hỗ trợ hoàn tiền/giao lại.
```

---

**Vì sao mẫu này tốt:** (1) Mỗi highlight **bám US done thật** (US-001…) — không bịa tính năng. (2) **Known-issues trung thực**: nêu OQ-2 (giao thất bại) + OQ-1 (timeout) vì ảnh hưởng người dùng — không giấu. (3) Bản **customer ẩn ID nội bộ** (`US-*`/`CR-*`/`FR-*`) + dịch sang lợi ích. (4) Fix **trace CR** (CR-20260720-002). (5) Cùng 1 nguồn, 2 cách trình bày, nội dung không mâu thuẫn.

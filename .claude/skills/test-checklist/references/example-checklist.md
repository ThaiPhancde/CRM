# Ví dụ chuẩn — Test Checklist + Coverage

> Mẫu output `/test-checklist` cho `food-delivery` (nguồn: AC trong us-001/us-002 + Error Matrix). File `test/checklist/food-delivery-checklist-index.md`. Học: mỗi mục kiểm 1 dòng có số liệu/wording thật; phủ positive/negative/boundary; bảng **Coverage** không để nghĩa vụ mồ côi.

---

```markdown
---
type: test-checklist-index
feature: food-delivery
status: draft
updated: 2026-07-25
next_chk_id: 7
links:
  - docs/food-delivery/userstories/food-delivery-story-index.md
  - docs/food-delivery/srs/food-delivery-spec.md
---

# Food Delivery — Test Checklist

## Checklist

### Đặt món (ordering)
- [ ] CHK-001: Đặt đơn với nhà hàng mở, món còn bán, tổng ≥30.000đ → đơn tạo trạng thái "Chờ nhà hàng xác nhận" + có mã đơn
- [ ] CHK-002: Đặt đơn khi nhà hàng đóng cửa → báo "Nhà hàng hiện đang đóng cửa, vui lòng chọn nhà hàng khác." + không tạo đơn
- [ ] CHK-003: Đặt đơn khi 1 món hết hàng → báo "Món {tên} đã hết, vui lòng cập nhật giỏ hàng." + giữ giỏ
- [ ] CHK-004: Giỏ tổng < 30.000đ → nút "Đặt đơn" vô hiệu + hiện "Đơn tối thiểu 30.000đ."

### Thanh toán (payment)
- [ ] CHK-005: Thanh toán COD → đơn chuyển nhà hàng, trạng thái "Chờ nhà hàng xác nhận"
- [ ] CHK-006: Thanh toán online thất bại/timeout → báo "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." + đơn giữ "Chờ thanh toán"

## Coverage

| Nghĩa vụ | CHK phủ | Loại |
|---|---|---|
| AC-001 (US-001) | CHK-001 | positive |
| E-food-delivery-001 | CHK-002 | negative |
| E-food-delivery-002 | CHK-003 | negative |
| BR-food-delivery-001 / E-food-delivery-003 | CHK-004 | boundary |
| AC-001 (US-002) | CHK-005 | positive |
| E-food-delivery-004 | CHK-006 | negative |

## Retired CHK-IDs

| CHK-ID | Lý do bỏ | Ngày |
|---|---|---|
| — | — | — |
```

---

**Vì sao mẫu này tốt:** (1) Mỗi CHK có **số liệu/wording thật** (30.000đ, câu lỗi exact) — không "kiểm đặt đơn OK". (2) **Phủ 3 loại**: positive (CHK-001/005), negative cho từng error code (CHK-002/003/006), boundary cho BR ngưỡng (CHK-004). (3) Bảng **Coverage** map mọi AC/E/BR → CHK, không nghĩa vụ mồ côi. (4) CHK là **1 dòng** (điều-cần-kiểm), step chi tiết để `/test-cases`. (5) `next_chk_id: 7` sau CHK-006; ID không reuse.

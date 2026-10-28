# Ví dụ chuẩn — /uiux (UI/UX Review)

> Mẫu output `/uiux` cho `food-delivery`. File `docs/food-delivery/food-delivery-uiux-review.md`. Học: checklist trạng thái per màn (chỉ tính thiếu khi nghiệp vụ đòi); findings theo severity; đề xuất sửa + route `/wireframe-*`, KHÔNG tự vẽ.

---

```markdown
## Checklist trạng thái

| Màn | default | loading | empty | error | success | Ghi chú |
|---|---|---|---|---|---|---|
| menu | ✓ | ✓ | ✗ | ✓ | — | thiếu empty khi NH không có món |
| cart | ✓ | — | ✗ | ✓ | — | thiếu empty khi giỏ trống |
| checkout | ✓ | ✓ | — | ✗ | ✓ | thiếu error state cho thanh toán online fail |
| order-tracking | ✓ | ✓ | — | — | ✓ | ok |

## Findings

### BLOCKING
- **Thiếu màn lỗi thanh toán** (checkout): E-food-delivery-004 (online fail) có trong Error Matrix nhưng checkout không có error state. Đề xuất: thêm trạng thái lỗi hiển thị "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." → `/wireframe-html food-delivery --flow checkout`.

### WARNING
- **Thiếu empty state** (menu, cart): danh sách không có trạng thái rỗng. Đề xuất thêm empty state → `/wireframe-html`.
- **Không nhất quán nút chính**: "Đặt đơn" (cart) vs "Xác nhận đặt" (checkout) — cùng luồng, 2 tên.

### SUGGESTION
- A11y: nút "Đặt đơn" disable khi dưới tối thiểu nên kèm text lý do (không chỉ màu xám).

## Flow gaps
- Nhánh E-food-delivery-004 (userflow có) chưa có màn đích.

## Verdict
revise — luồng cốt lõi ổn nhưng thiếu error state thanh toán + empty state list.
```

---

**Vì sao mẫu này tốt:** (1) Checklist trạng thái chỉ đánh **✗ khi nghiệp vụ đòi** (error của E-004 có thật trong Error Matrix), `—` khi không áp dụng — không bịa "best practice". (2) BLOCKING bám **nhánh lỗi thật** thiếu màn; wording đề xuất **khớp Error Matrix**. (3) **Đề xuất sửa + route** `/wireframe-*`, KHÔNG tự vẽ lại. (4) Bắt **không nhất quán** tên nút. (5) Verdict theo `review-format.md`.

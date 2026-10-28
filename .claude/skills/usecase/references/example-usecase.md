# Ví dụ chuẩn — Use case fully-dressed (Cockburn)

> Mẫu output `/usecase` (downstream mode, feature `food-delivery` đã có SRS). Đây là 1 file `usecases/uc-place-order.md` (zero-frontmatter) + trích index. Học: 1 UC = 1 user goal sea-level, Main Success Scenario bằng action nghiệp vụ, mỗi nhánh lỗi là 1 Extension trỏ đúng `E-*`, Related Requirements trỏ FR full-form.

---

## `usecases/uc-place-order.md`

```markdown
# UC-place-order: Duyệt menu & đặt món

**Scope**: food-delivery
**Level**: user-goal (sea)
**Primary Actor**: Khách
**Stakeholders & Interests**: Khách — đặt đúng món, biết đơn đã vào hệ thống · Nhà hàng — nhận đơn hợp lệ, đủ tồn kho
**Trigger**: Khách mở app và chọn 1 nhà hàng để xem menu.
**Preconditions**: Khách đã đăng nhập.
**Minimal Guarantee**: Không tạo đơn rác khi thất bại; giỏ hàng của khách được giữ nguyên để sửa.
**Success Guarantee**: Đơn được tạo ở trạng thái "Chờ nhà hàng xác nhận", gắn đúng nhà hàng + danh sách món + tổng tiền.

## Main Success Scenario

1. Khách mở menu của nhà hàng đang mở cửa; hệ thống hiển thị các món còn bán.
2. Khách thêm món vào giỏ; hệ thống tính lại tổng tiền theo thời gian thực.
3. Khách bấm "Đặt đơn".
4. Hệ thống kiểm tra nhà hàng còn mở, mọi món còn hàng, và tổng đơn ≥ mức tối thiểu.
5. Hệ thống tạo đơn ở trạng thái "Chờ nhà hàng xác nhận" và chuyển khách sang màn theo dõi đơn kèm mã đơn.

## Extensions

- **1a.** Nhà hàng đóng cửa khi khách mở menu/đặt: hệ thống chặn và báo lỗi → E-food-delivery-001.
- **4a.** Một món trong giỏ vừa hết hàng: hệ thống không tạo đơn, giữ giỏ để khách cập nhật → E-food-delivery-002.
- **4b.** Tổng đơn < 30.000đ (BR-food-delivery-001): nút "Đặt đơn" vô hiệu, báo mức tối thiểu → E-food-delivery-003.

## Related Requirements

- FR: FR-food-delivery-001, FR-food-delivery-002, FR-food-delivery-003
- BR: BR-food-delivery-001
- Errors: E-food-delivery-001, E-food-delivery-002, E-food-delivery-003
```

---

## Trích `food-delivery-usecase-index.md` (bảng truy vết)

```markdown
| # | Slug | Level | Status | Actor primary | Covers FR | Screens | Errors (E-*) | OQ ref | Priority | Updated |
|---|------|-------|--------|---------------|-----------|---------|--------------|--------|----------|---------|
| 1 | [place-order](uc-place-order.md) | sea | draft | Khách | FR-food-delivery-001..003 | menu, cart, order-tracking | E-food-delivery-001..003 | — | P0 | 2026-07-24 |
```

CRUD matrix (đối chiếu ERD):

```markdown
| UC \ Entity | Order | OrderLine | MenuItem | Restaurant |
|---|---|---|---|---|
| [place-order](uc-place-order.md) | C | C | R | R |
```

**Vì sao mẫu này tốt:** (1) Main Success Scenario mô tả *nghiệp vụ* ("hệ thống kiểm tra tồn kho"), không technical (không "query DB"). (2) Mỗi Extension gắn 1 điều kiện tại 1 bước cụ thể + trỏ đúng error code. (3) Level = sea (1 goal hoàn chỉnh), login là precondition chứ không tách UC riêng. (4) CRUD khớp entity trong ERD, không bịa bảng.

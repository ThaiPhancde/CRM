# Ví dụ chuẩn — Test Cases

> Mẫu output `/test-cases` cho `food-delivery` (nguồn: checklist CHK-001..006). File `test/testcases/food-delivery-testcase-index.md`. Học: mỗi CHK → ≥1 TC; precondition + test data cụ thể; Expected **đo được** (trạng thái/wording exact); Maps-to trace đủ.

---

```markdown
## Index

| TC-ID | Tiêu đề | Type | Priority | Maps-to | Status |
|---|---|---|---|---|---|
| TC-001 | Đặt đơn thành công | positive | P0 | CHK-001, AC-001, FR-food-delivery-003 | draft |
| TC-002 | Đặt đơn khi nhà hàng đóng cửa | negative | P0 | CHK-002, E-food-delivery-001 | draft |
| TC-003 | Đặt đơn dưới tối thiểu | boundary | P1 | CHK-004, BR-food-delivery-001, E-food-delivery-003 | draft |

## Test cases

### TC-001: Đặt đơn thành công
- **Type**: positive  **Priority**: P0
- **Maps-to**: CHK-001, AC-001, FR-food-delivery-003
- **Precondition**: Khách "an@test.vn" đã đăng nhập; nhà hàng "Phở 24" đang mở; giỏ có 1 Phở (45.000đ)
- **Test data**: tài khoản an@test.vn / nhà hàng Phở 24 / tổng 45.000đ
- **Steps**:
  1. Mở giỏ hàng
  2. Bấm "Đặt đơn"
- **Expected**: Đơn tạo ở trạng thái "Chờ nhà hàng xác nhận"; màn theo dõi đơn hiện mã đơn

### TC-002: Đặt đơn khi nhà hàng đóng cửa
- **Type**: negative  **Priority**: P0
- **Maps-to**: CHK-002, E-food-delivery-001
- **Precondition**: Nhà hàng "Phở 24" đóng cửa; giỏ có 1 Phở
- **Test data**: nhà hàng Phở 24 (trạng thái đóng)
- **Steps**:
  1. Mở giỏ hàng
  2. Bấm "Đặt đơn"
- **Expected**: Hiện "Nhà hàng hiện đang đóng cửa, vui lòng chọn nhà hàng khác."; đơn KHÔNG được tạo

### TC-003: Đặt đơn dưới tối thiểu
- **Type**: boundary  **Priority**: P1
- **Maps-to**: CHK-004, BR-food-delivery-001, E-food-delivery-003
- **Precondition**: Giỏ có 1 món 25.000đ (< 30.000đ)
- **Test data**: tổng giỏ 25.000đ
- **Steps**:
  1. Mở giỏ hàng
- **Expected**: Nút "Đặt đơn" bị vô hiệu; hiện "Đơn tối thiểu 30.000đ."
```

---

**Vì sao mẫu này tốt:** (1) Mỗi CHK → ≥1 TC (CHK-001→TC-001…). (2) **Precondition + test data cụ thể** (tài khoản/nhà hàng/số tiền) → QA chạy được ngay. (3) **Expected đo được**: trạng thái ("Chờ nhà hàng xác nhận"), wording exact (trong ngoặc kép đúng Error Matrix), hành vi UI ("nút vô hiệu"). (4) **Maps-to** trace đủ (CHK + AC/FR/E full-form) cho `/gap`. (5) Type khớp phân loại checklist (positive/negative/boundary). (6) Số biên **đúng ngưỡng** 30.000đ, không bịa.

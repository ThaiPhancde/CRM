# Ví dụ chuẩn — SRS (spec)

> Mẫu output `/srs` cho `food-delivery`. File `docs/food-delivery/srs/food-delivery-spec.md`. Học: FR testable; Error Matrix **wording exact**; BR có ngưỡng; ID full-form. Là **nguồn thật** cho `/usecase`, `/userstory`, `/ac`, `/test-checklist`.

---

```markdown
## 2. Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR-food-delivery-003** | Khách đặt đơn; hệ thống kiểm tra tồn kho + giá trị tối thiểu (BR-food-delivery-001), tạo đơn ở trạng thái "Chờ nhà hàng xác nhận". |
| **FR-food-delivery-004** | Khách chọn COD hoặc online; online → gọi cổng thanh toán, chờ kết quả trước khi chuyển đơn cho nhà hàng. |

## 4. Business Rules

| ID | Rule |
|----|------|
| **BR-food-delivery-001** | Giá trị đơn tối thiểu 30.000đ mới cho đặt. |

## 5. Error Matrix

| ID | Điều kiện | Wording (exact) | Hệ quả |
|----|-----------|------------------|--------|
| **E-food-delivery-003** | Tổng đơn < 30.000đ khi đặt | "Đơn tối thiểu 30.000đ." | Nút "Đặt đơn" vô hiệu |
| **E-food-delivery-004** | Thanh toán online thất bại/timeout | "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." | Đơn giữ "Chờ thanh toán" |

## Open Questions
- [ ] OQ-1: Timeout cổng thanh toán online bao nhiêu giây trước khi coi là thất bại (E-004)?
```

---

**Vì sao mẫu này tốt:** (1) FR phát biểu **1 hành vi testable** (điều kiện + kết quả + trạng thái) — nguồn cho user story + test. (2) Error Matrix có **wording exact** (string user thấy đúng từng chữ) — nguồn cho `/ac`, `/wireframe-*`. (3) BR có **ngưỡng cụ thể** (30.000đ). (4) ID **full-form** (`FR-food-delivery-003`) — nguồn trace. (5) Số chưa chốt (timeout) → **OQ-1**, không bịa "30s".

# Ví dụ chuẩn — Business Requirements (BRD)

> Mẫu output `/brd` cho `food-delivery`. File `docs/food-delivery/food-delivery-brd.md`. Học: BO đo được (KPI + target); out-of-scope tường minh; KHÔNG bịa ROI/%.

---

```markdown
## Executive Summary

FoodFast phục vụ khung giờ trưa cho dân văn phòng — cam kết giao đúng giờ nghỉ, gom đơn theo cao ốc. Mục tiêu chiếm thị phần trưa ở khu văn phòng mục tiêu.

## Business Objectives & Success Measures

| ID | Mục tiêu kinh doanh | KPI đo | Target |
|---|---|---|---|
| BO-food-delivery-01 | Chiếm khung giờ trưa khu văn phòng | Đơn/ngày/cao ốc | Chưa chốt (OQ) |
| BO-food-delivery-02 | Giữ chân khách | Tỷ lệ đặt lặp lại tuần | Chưa chốt (OQ) |

## Stakeholders

| Stakeholder | Vai trò | Mối quan tâm |
|---|---|---|
| Chủ sản phẩm | Quyết scope | Thị phần trưa, chi phí vận hành |
| Nhà hàng đối tác | Cung món | Đơn ổn định, phí hợp lý |
| Đội vận hành | Điều phối giao | Đúng giờ cao điểm |

## Business Scope

**In-scope:** đặt món, thanh toán COD/online, giao vận, hủy/hoàn tiền, đánh giá.
**Out-of-scope:** đặt bàn tại chỗ (dine-in); mở ngoài khung giờ trưa; điểm thưởng phức tạp.
**Dependencies:** cổng thanh toán; đội shipper.

## Risks

| Rủi ro | Khả năng | Hậu quả | Cách giảm |
|---|---|---|---|
| Quá tải cao điểm → giao trễ | thường | Mất niềm tin | Gom đơn theo cao ốc, giới hạn bán |
```

---

**Vì sao mẫu này tốt:** (1) BO **đo được** (KPI "đơn/ngày/cao ốc"); số chưa chốt → **OQ**, KHÔNG bịa "+30%". (2) **Out-of-scope tường minh** (dine-in, điểm thưởng) → chống scope creep. (3) Objective là **kết quả KD** ("chiếm khung giờ trưa"), không giải pháp/UI. (4) Risk có framing KD (adoption/vận hành), không phải bug kỹ thuật.

# Ví dụ chuẩn — Product Discovery

> Mẫu output `/discover` cho sản phẩm **FoodFast** (app giao đồ ăn cho dân văn phòng). File `docs/_product/discovery.md`. Học: pitch 1 câu; segment **cụ thể** + JTBD (không "mọi người"); themes là **mảng cấp cao** (không sa vào flow); tín hiệu thành công chưa có số → **OQ** thay vì bịa; nêu rõ **riskiest assumption**.

---

```markdown
# FoodFast — Product Discovery

## Pitch
FoodFast là app đặt & giao đồ ăn cho **dân văn phòng bận rộn** — đặt món trong 1 phút, giao **đúng giờ nghỉ trưa**.

## Vấn đề & cơ hội
- Vấn đề: giờ nghỉ trưa ngắn; app hiện tại giao trễ giờ cao điểm, phí cao.
- Ai chịu: nhân viên văn phòng khu cao ốc; NH vừa-nhỏ; shipper.
- Why now: mật độ cao ốc tăng, đặt online phổ biến, NH nhỏ cần kênh số.

## Người dùng mục tiêu & JTBD
| Segment | JTBD | Pains | Gains |
|---|---|---|---|
| Khách văn phòng | "Bữa trưa ngon, giao đúng giờ nghỉ, ít thao tác" | giao trễ, phí cao | đặt nhanh, đúng giờ |
| Nhà hàng vừa-nhỏ | "Thêm đơn trưa mà không rối bếp" | quản lý thủ công | nhận đơn gọn |

## Themes (mảng cấp cao — KHÔNG mô tả flow chi tiết)
| Theme | Ưu tiên gợi ý |
|---|---|
| Đặt hàng · Thanh toán · Giao vận · Vận hành NH | P0 |
| Tương tác (đánh giá, khuyến mãi) | P2 |

## Non-goals
- KHÔNG làm dine-in; KHÔNG mở ngoài khung giờ trưa giai đoạn đầu.

## Assumptions cần kiểm chứng
- Riskiest: khách sẽ đổi app **nếu đúng giờ hơn** (chưa kiểm chứng thực tế).

## Open Questions
- [ ] OQ-1: target "giao đúng giờ" và "đặt lặp lại tuần" bao nhiêu?
```

---

**Vì sao mẫu này tốt:** (1) Segment **cụ thể** (dân văn phòng khu cao ốc) + JTBD rõ, không "mọi người". (2) Themes chỉ nêu **tên mảng** — chi tiết flow để `/brainstorm`/`/prd-epic` sau, đúng tầng sản phẩm. (3) **Non-goals tường minh** chống scope creep ngay từ discovery. (4) Con số target chưa có → **OQ-1**, KHÔNG bịa "≥95%". (5) Có **riskiest assumption** — điều nguy hiểm nhất nếu sai. Chốt discovery xong mới route `/prd`.

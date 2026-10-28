# Ví dụ chuẩn — User Requirements (URD)

> Mẫu output `/urd` cho `food-delivery`. File `docs/food-delivery/food-delivery-urd.md`. Học: phát biểu góc **người dùng** ("tôi muốn X để Y"), KHÔNG giải pháp; persona cụ thể; success criteria đo được (hoặc OQ).

---

```markdown
## Personas

| Persona | Đặc điểm | Mục tiêu | Pain chính |
|---|---|---|---|
| Khách văn phòng | Bận, giờ trưa ngắn, đặt lặp lại | Có bữa trưa ngon, giao đúng giờ | Giao trễ, thao tác nhiều |
| Nhà hàng | Nhân sự mỏng, cao điểm trưa | Nhận đơn gọn, không rối bếp | Quản lý đơn thủ công |
| Shipper | Tối ưu thu nhập giờ cao điểm | Nhận đơn gần, quay vòng nhanh | Đơn xa, chờ lâu ở NH |

## User Needs

- **[P0]** Là khách, tôi muốn đặt món và biết đơn đã vào hệ thống để yên tâm chờ giao.
- **[P0]** Là khách, tôi muốn thanh toán COD hoặc online để chọn cách thuận tiện.
- **[P1]** Là khách, tôi muốn hủy đơn khi chưa được xác nhận để không bị tính tiền nhầm.
- **[P0]** Là nhà hàng, tôi muốn xác nhận/từ chối đơn để kiểm soát bếp.

## User Journeys

### Khách đặt bữa trưa
1. Mở menu nhà hàng gần văn phòng
2. Chọn món, xem tổng tiền
3. Đặt đơn + chọn thanh toán
4. Theo dõi tới khi nhận

## Success Criteria

- Khách hoàn tất đặt đơn trong ≤ 1 phút.
- Tỷ lệ giao đúng giờ nghỉ trưa cao (target cụ thể: OQ-1).
```

---

**Vì sao mẫu này tốt:** (1) Need phát biểu **góc user** ("tôi muốn hủy đơn để không bị tính tiền") — KHÔNG "thêm nút hủy" (giải pháp → PRD/SRS). (2) Persona **cụ thể** (khách văn phòng, không "mọi người") + pain riêng. (3) Success criteria **đo được** (≤1 phút); số chưa chốt → **OQ-1**, không bịa. (4) Ưu tiên P0/P1 để downstream biết trọng tâm.

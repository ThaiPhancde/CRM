# Ví dụ chuẩn — /uat (kế hoạch & kịch bản UAT)

> Mẫu `/uat food-delivery`. File `docs/food-delivery/uat/food-delivery-uat-plan.md`. Học: bước là **hành động nghiệp vụ** (không kỹ thuật); kết quả mong đợi = điều người dùng thấy; negative bám `E-*` wording exact; exit criteria đo được; trace về FR/AC.

---

```markdown
## 3. Exit criteria
- [ ] ≥ 95% kịch bản PASS
- [ ] 0 lỗi mức blocking
- [ ] Sign-off của Trưởng nhóm vận hành

## 4. Kịch bản UAT

### UAT-003 — Đặt đơn thành công
> Nguồn: FR-food-delivery-003, AC-001

- **Bối cảnh:** Khách đã đăng nhập, nhà hàng "Cơm Tấm 88" đang mở cửa.
- **Các bước:**
  1. Mở menu nhà hàng, chọn 2 món (tổng ≥ 30.000đ).
  2. Bấm "Đặt đơn".
- **Kết quả mong đợi:** Đơn được tạo ở trạng thái "Chờ nhà hàng xác nhận"; màn theo dõi hiện đơn mới.
- **Kết quả:** ☐ PASS ☐ FAIL — ______

### UAT-004 — Đặt đơn dưới mức tối thiểu (lỗi)
> Nguồn: E-food-delivery-003, BR-food-delivery-001

- **Bối cảnh:** Giỏ hàng có tổng 25.000đ.
- **Các bước:**
  1. Bấm "Đặt đơn".
- **Kết quả mong đợi:** Hiện thông báo "Đơn tối thiểu 30.000đ."; nút "Đặt đơn" bị vô hiệu.
- **Kết quả:** ☐ PASS ☐ FAIL — ______
```

---

**Vì sao mẫu này tốt:** (1) Bước là **hành động người dùng thật** ("chọn 2 món, bấm Đặt đơn") — KHÔNG "gọi API POST /orders". (2) Kết quả mong đợi là **điều người dùng thấy** — negative dùng **wording exact** "Đơn tối thiểu 30.000đ." từ `E-food-delivery-003`. (3) Mỗi kịch bản **trace** về FR/AC/E. (4) Exit criteria **đo được** (≥95% PASS, 0 blocking). (5) Có cả happy (UAT-003) + negative (UAT-004).

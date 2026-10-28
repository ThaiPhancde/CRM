# Ví dụ chuẩn — /faq (câu hỏi thường gặp)

> Mẫu `/faq food-delivery`. File `docs/faq/food-delivery-faq.md`. Học: câu hỏi như user thật hỏi; answer bám `E-*` (wording exact) + `BR-*`; body KHÔNG lộ ID nội bộ; số chưa chốt (OQ) đánh dấu, không chế.

---

```markdown
## Đặt hàng

**Vì sao tôi không đặt được đơn, hệ thống báo "Đơn tối thiểu 30.000đ."?**
Đơn hàng cần đạt tối thiểu 30.000đ mới đặt được. Vui lòng thêm món cho đủ mức tối thiểu rồi bấm "Đặt đơn".

**Vì sao thấy "Nhà hàng hiện đang đóng cửa, vui lòng chọn nhà hàng khác."?**
Nhà hàng đang ngoài giờ mở cửa nên tạm thời không nhận đơn. Bạn chọn nhà hàng khác đang mở nhé.

## Hoàn & hủy

**Tôi hủy đơn được không?**
Được, khi đơn còn ở trạng thái "Chờ nhà hàng xác nhận". Sau khi nhà hàng đã xác nhận thì không hủy được — vui lòng liên hệ CSKH.

**Bao lâu tôi nhận được tiền hoàn?**
Với đơn đã thanh toán online, tiền hoàn về nguồn tiền gốc trong 3–5 ngày làm việc.

## Thanh toán

**Thanh toán online báo "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD." thì sao?**
Giao dịch chưa thành công. Bạn thử lại hoặc chọn thanh toán khi nhận hàng (COD). Đơn được giữ ở trạng thái "Chờ thanh toán".
```

<!-- Trace nội bộ (không hiển thị): E-food-delivery-003, E-food-delivery-001, BR-food-delivery-002, BR-food-delivery-003, E-food-delivery-004 -->

---

**Vì sao mẫu này tốt:** (1) Câu hỏi viết như **user thật hỏi**, dùng **wording lỗi exact** ("Đơn tối thiểu 30.000đ.") để user tra đúng câu họ thấy. (2) Answer bám nguồn: ngưỡng 30.000đ (`BR-001`), hủy khi Chờ xác nhận (`BR-002`), hoàn 3–5 ngày (`BR-003`). (3) **Body KHÔNG lộ ID** — trace để trong comment ẩn. (4) Nhóm theo chủ đề. (5) Không chế số chưa chốt (timeout OQ-1 không đưa vào con số cụ thể).

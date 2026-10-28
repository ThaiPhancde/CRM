# Ví dụ chuẩn — Product Roadmap

> Mẫu output `/roadmap` cho **FoodFast**. File `docs/_product/roadmap.md`. Học: RICE-lite minh bạch (Score = R×I×C/E); horizon = **điểm + phụ thuộc + tính thiết yếu MVP** (không thuần điểm); Dependency Map + horizon **nhất quán** (không feature nào đứng trước thứ nó phụ thuộc).

---

## Trích RICE + Horizons + Dependency

```markdown
## Prioritization (RICE-lite)
| Feature | Reach | Impact | Confidence | Effort | Score |
|---|---|---|---|---|---|
| ordering | 8 | 3 | 100% | 3 | 8.0 |
| payment | 8 | 3 | 80% | 3 | 6.4 |
| delivery-dispatch | 8 | 3 | 80% | 5 | 3.8 |
| promotions | 5 | 2 | 50% | 3 | 1.7 |

## Horizons
### Now — vòng lặp MVP đặt → chuẩn bị → giao
- browse-menu, ordering, payment, restaurant-ops, delivery-dispatch, order-tracking
  (delivery-dispatch điểm thấp do effort cao nhưng **thiết yếu** — không giao thì không có sản phẩm)
### Next
- cancel-refund (cần sau payment), rating-review (cần sau giao)
### Later
- promotions (Confidence 50% — để sau khi lõi ổn định)

## Dependency Map
| Phụ thuộc | Rationale |
|---|---|
| ordering → payment | Có đơn rồi mới thanh toán |
| restaurant-ops → delivery-dispatch | NH xác nhận xong mới gán shipper |
| payment → cancel-refund | Hoàn tiền chỉ áp dụng đơn đã thanh toán |
| delivery-dispatch → rating-review | Chỉ đánh giá sau khi đã giao |
```

---

**Vì sao mẫu này tốt:** (1) **RICE minh bạch** — mỗi feature có điểm theo công thức, so sánh tương đối rõ, không cảm tính. (2) Horizon **không thuần điểm số**: `delivery-dispatch` điểm thấp (effort cao) vẫn ở Now vì **thiết yếu cho MVP** — lý do được ghi rõ. (3) **Nhất quán phụ thuộc**: mọi thứ ở Next/Later phụ thuộc thứ ở horizon sớm hơn hoặc bằng (cancel-refund ở Next phụ thuộc payment ở Now — hợp lệ; không có feature nào đứng TRƯỚC thứ nó cần). (4) Điểm là **ước lượng tương đối**, không trưng như đo đạc thật. (5) Roadmap đọc Feature Map **1 chiều** — không sửa PRD; ưu tiên đổi thì sửa `/prd` rồi chạy lại `/roadmap`.

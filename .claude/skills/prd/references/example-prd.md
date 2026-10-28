# Ví dụ chuẩn — Product PRD

> Mẫu output `/prd` cho **FoodFast**. File `docs/_product/prd.md` (singleton, type `prd-product`). Học: **Non-goals tường minh**; **Feature Map** là trái tim (slug + theme + ưu tiên + cột "Chi tiết hóa" khớp vault); Success Metrics **đo được hoặc OQ**; KHÔNG sa vào flow 1 feature.

---

## Trích các mục cốt lõi

```markdown
## Goals & Non-goals
**Goals**
- Chiếm khung giờ trưa khu văn phòng; tăng đặt lặp lại tuần.
- Tỷ lệ giao đúng giờ nghỉ cao (target: OQ-1).

**Non-goals**
- KHÔNG làm dine-in; KHÔNG mở ngoài khung giờ trưa giai đoạn đầu; KHÔNG điểm thưởng phức tạp.

## Feature Map
| # | Feature (slug) | Theme | Ưu tiên | Chi tiết hóa |
|---|---|---|---|---|
| 1 | browse-menu | Đặt hàng | P0 | ✅ đã chi tiết |
| 2 | ordering | Đặt hàng | P0 | ✅ đã chi tiết |
| 3 | payment | Thanh toán | P0 | ✅ đã chi tiết |
| 4 | order-tracking | Giao vận | P0 | ✅ đã chi tiết |
| 5 | restaurant-ops | Vận hành NH | P0 | ⛔ chưa |
| 6 | delivery-dispatch | Giao vận | P0 | ⛔ chưa |
| 7 | cancel-refund | Thanh toán | P1 | ✅ đã chi tiết |
| 8 | rating-review | Tương tác | P2 | ⛔ chưa |
| 9 | promotions | Tương tác | P2 | ⛔ chưa |

## Success Metrics
| KPI | Định nghĩa | Baseline | Target |
|---|---|---|---|
| Tỷ lệ giao đúng giờ nghỉ | % đơn giao trước cuối giờ nghỉ cam kết | Chưa có (OQ-1) | Chưa chốt (OQ-1) |
```

---

**Vì sao mẫu này tốt:** (1) **Non-goals** rõ ràng → kiểm soát phạm vi. (2) **Feature Map** dùng slug kebab-case + theme + ưu tiên; cột "Chi tiết hóa" phản ánh **vault thực tế** (`✅` = đã có UC/US, `⛔` = chưa) — đây là cột `/brainstorm` Phase E2 mark ngược, và là nguồn `/roadmap` đọc. (3) Success Metrics có **định nghĩa cách đo**; số chưa có → trỏ **OQ-1** thay vì bịa. (4) PRD **không** mô tả flow/validation của từng feature (đó là `/prd-epic` + `/srs`) — giữ đúng tầng sản phẩm. (5) Frontmatter `type: prd-product`, KHÔNG `feature` (project-level).

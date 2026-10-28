# Ví dụ chuẩn — PRD cấp feature (Epic)

> Mẫu output `/prd-epic` cho `food-delivery`. File `docs/food-delivery/food-delivery-prd.md` (type `prd`). Học: capability **mức sản phẩm** + ưu tiên P0/P1/P2; non-goals; phân biệt với `/prd` (cấp sản phẩm).

---

```markdown
## Goals & Non-goals

**Goals**
- Cho khách đặt món → thanh toán → theo dõi tới khi nhận, trong giờ trưa.

**Non-goals**
- KHÔNG làm đặt bàn tại chỗ; KHÔNG điểm thưởng phức tạp giai đoạn đầu.

## Capabilities

| ID | Capability | Ưu tiên | Mô tả |
|---|---|---|---|
| CAP-food-delivery-01 | Đặt món & thanh toán | P0 | Duyệt menu, giỏ, đặt đơn, COD/online |
| CAP-food-delivery-02 | Vận hành đơn (NH + shipper) | P0 | NH xác nhận/chuẩn bị; gán shipper; giao |
| CAP-food-delivery-03 | Hủy/hoàn tiền & đánh giá | P1 | Hủy khi chưa xác nhận + hoàn tiền; đánh giá đơn |
```

---

**Vì sao mẫu này tốt:** (1) Capability **mức sản phẩm** ("Đặt món & thanh toán") — FR chi tiết + Error Matrix là `/srs`, không nhồi vào đây. (2) Mỗi capability có **ưu tiên** (P0 MVP / P1). (3) **Non-goals** rõ. (4) Đây là PRD **1 feature** (`docs/food-delivery/food-delivery-prd.md`, type `prd`) — KHÁC `/prd` (cấp sản phẩm, `docs/_product/prd.md`, type `prd-product`, Feature Map toàn sản phẩm).

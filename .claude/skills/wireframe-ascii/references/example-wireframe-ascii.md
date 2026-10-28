# Ví dụ chuẩn — /wireframe-ascii

> Mẫu output `/wireframe-ascii` cho `food-delivery` flow `ordering` (mobile 375). File `ascii-wireframe/ordering.md` (**zero-frontmatter**). Học: khung ASCII box-drawing (KHÔNG emoji), form căn giữa khung hẹp, **bảng mô tả 5 cột** Description đủ 6 lớp với wording/số liệu thật, state loại trừ tách screen riêng.

---

## `## Screen: cart — Giỏ hàng`

```
┌────────────────────────────────┐
│ < Gio hang                     │
├────────────────────────────────┤
│  Pho bo       x1     45.000d   │
│    [ - ] 1 [ + ]      [ Xoa ]  │
│  ----------------------------  │
│  Tong cong          45.000d    │
├────────────────────────────────┤
│        [   Dat don   ]         │
└────────────────────────────────┘
```

| # | Items | Control type | Data type | Description |
|---|-------|--------------|-----------|-------------|
| 4 | Nút "Đặt đơn" | Button (primary) | — | • Bắt buộc: tổng ≥ 30.000đ và mọi món còn hàng.<br>• States: default / **disabled** khi tổng < 30.000đ (kèm "Đơn tối thiểu 30.000đ." — E-food-delivery-003).<br>• Món vừa hết → E-food-delivery-002 "Món {tên} đã hết, vui lòng cập nhật giỏ hàng.", giữ giỏ.<br>• Navigation: hợp lệ → màn checkout. |

## `## Screen: cart-empty — Giỏ hàng rỗng` (state riêng, Mục 8)

```
┌────────────────────────────────┐
│ < Gio hang                     │
├────────────────────────────────┤
│         (gio trong)            │
│   Chua co mon nao trong gio    │
│      [ Quay lai menu ]         │
└────────────────────────────────┘
```

---

**Vì sao mẫu này tốt:** (1) **Render trong chat** → duyệt cấu trúc nhanh qua L3 iterate (điểm mạnh riêng của ASCII so với HTML/mermaid). (2) Khung dùng **box-drawing** `┌─┐│└┘ [ ]`, **KHÔNG emoji** (emoji lệch viền monospace). (3) Bảng Description **đủ 6 lớp** (mục đích / validation BR / states / navigation / error+wording exact / edge) — rút số liệu (30.000đ) + wording lỗi THẬT từ Error Matrix, KHÔNG bịa. (4) **State loại trừ tách screen** — `cart-empty` là screen riêng, không nhồi 2 trạng thái vào 1 khung (Mục 8). (5) Mobile → khung hẹp, form căn giữa không chạm 2 mép (Mục 8). (6) File zero-frontmatter — metadata sống ở `{feature}-wireframe-index.md`.

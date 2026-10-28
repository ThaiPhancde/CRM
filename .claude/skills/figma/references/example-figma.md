# Ví dụ chuẩn — /figma

> Mẫu output `/figma` cho `food-delivery`: cập nhật cột `Figma` trong `{feature}-wireframe-index.md` (URL frame thật, KHÔNG file local). Học: KHÔNG bịa link `figma.com`; screen chưa import → `— (chưa import)`; HTML import-ready là file tạm.

---

## Cột Figma trong `food-delivery-wireframe-index.md` sau khi `/figma`

```markdown
| Slug | Màn hình | Thuộc flow | Status | Figma | HTML prototype | Updated |
|---|---|---|---|---|---|---|
| menu | Menu nhà hàng | ordering | draft | https://figma.com/design/AbC123/food-delivery?node-id=2-45 | food-delivery-prototype.html#menu | 2026-07-25 |
| cart | Giỏ hàng | ordering | draft | https://figma.com/design/AbC123/food-delivery?node-id=2-88 | food-delivery-prototype.html#cart | 2026-07-25 |
| checkout | Thanh toán | ordering | draft | — (chưa import) | food-delivery-prototype.html#checkout | 2026-07-25 |
```

## File import-ready tạm

```
docs/food-delivery/.figma-import/ordering.html   ← HTML clean semantic, import qua plugin "html.to.design"
```

Bước import (khi không có Figma MCP):
1. Figma → cài plugin **html.to.design** → import `.figma-import/ordering.html`.
2. Copy URL frame mỗi màn, dán lại: `menu = https://figma.com/design/...`.
3. `/figma` ghi URL thật vào cột Figma.

---

**Vì sao mẫu này tốt:** (1) **Output là URL trong index**, KHÔNG file `.fig` local — frame Figma sống trên cloud. (2) **KHÔNG bịa link** — `menu`/`cart` có URL thật (do user import + dán); `checkout` chưa import → `— (chưa import)`, tuyệt đối không chế `figma.com/file/xxx` giả. (3) **HTML import-ready** ở `.figma-import/` là file **tạm** để plugin map sang layer Figma, không phải deliverable. (4) Figma access là **của user** — skill hướng dẫn plugin (hoặc dùng Figma MCP nếu có), không tự có token. (5) Element bám ASCII/HTML nguồn, không suy lại nghiệp vụ.

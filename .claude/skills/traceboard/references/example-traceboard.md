# Ví dụ chuẩn — /traceboard (Visual Board HTML)

> Mẫu output `/traceboard`: file self-contained `docs/_shared/traceboard.html` mở bằng browser. Render từ `_templates/traceboard.html` + data nhúng inline. Học: self-contained (no CDN); trạng thái có **nhãn chữ + số** ngoài màu (a11y); ô thiếu → đỏ + "chưa có", không bịa.

---

## Data nhúng (skill sinh từ traceability của /gap)

Board cho `food-delivery` (health 78%): mỗi feature 1 hàng, mỗi tầng 1 ô màu + số phủ.

```html
<tbody>
  <tr>
    <td>food-delivery</td>
    <td class="cell partial" title="Thiếu UC cho: FR-006, FR-007, FR-009, FR-008... (4/9)">4/9</td>
    <td class="cell full" title="Đủ (7/9 FR có story; 2 backend)">7/9</td>
    <td class="cell full" title="Đủ (7/7)">7/7</td>
    <td class="cell partial" title="Thiếu test cho: FR-006, FR-007 (6/7 AC)">6/7</td>
    <td>78%</td>
  </tr>
</tbody>
```

Panel Orphan:
```html
<ul>
  <li><code>FR-food-delivery-006</code> — thiếu Use case + Test</li>
  <li><code>FR-food-delivery-007</code> — thiếu Use case + Test</li>
</ul>
```

## Cách xem

Double-click `docs/_shared/traceboard.html` → mở browser. Không cần internet/công cụ.

---

**Vì sao mẫu này tốt:** (1) **Self-contained** — CSS/JS inline, mở offline, không CDN. (2) **A11y**: ô có class màu (`full`/`partial`/`empty`) NHƯNG luôn kèm **số phủ** ("4/9") + `title` tooltip liệt kê node thiếu → người mù màu vẫn đọc được; healthbar có `aria-label`. (3) **Không bịa**: ô thiếu → đỏ + "chưa có", số tính từ quan hệ thật (nguồn `/gap`). (4) **Regenerated**: sửa doc rồi chạy lại, KHÔNG sửa tay HTML. (5) Dark-mode-aware qua `prefers-color-scheme`. (6) Trỏ `/gap` (phân tích) + `/rtg` (bàn giao) ở chân board.

# Hệ thống thiết kế giao diện — trắng và cam

Cập nhật: 28/10/2026 (Phase 0). Nguồn: D-15 (người dùng chốt: đẹp, trắng – cam, không chồng chéo); HLD §3 menu. Phase 1 cài đặt; Phase 11 rà soát toàn bộ.

## 1. Nguyên tắc

1. **Trắng là nền, cam là hành động.** Cam chỉ xuất hiện ở nút chính, mục menu đang chọn, liên kết, tiến độ, huy hiệu nhấn. Không dùng cam làm nền khối lớn hay nền bảng.
2. **Một lớp phủ tại một thời điểm.** Mở drawer thì đóng dropdown; mở modal thì không mở drawer; panel AI là drawer phải, đóng khi mở drawer khác. Không modal trong modal.
3. **Mọi màn đủ bốn trạng thái**: tải (skeleton cùng hình dạng nội dung), rỗng (minh họa nhẹ + câu hướng dẫn + nút cam), lỗi (thông báo tiếng Việt + nút thử lại), thành công.
4. **Mật độ vừa phải:** bảng 44px/dòng, form 1 cột ≤ 640px, thẻ số liệu 4 cột trên 1440.
5. **Tiếng Việt nhất quán:** nhãn ngắn, không viết hoa toàn bộ, không dấu chấm cuối nhãn; số theo `vi-VN` nhưng tiền theo currency.

## 2. Token (CSS variables, `src/app/globals.css`)

```css
:root {
  --bg: #FFFFFF;          --bg-subtle: #FAFAF9;     --bg-muted: #F5F5F4;
  --border: #E7E5E4;      --border-strong: #D6D3D1;
  --fg: #1C1917;          --fg-muted: #57534E;      --fg-subtle: #A8A29E;
  --brand: #F97316;       --brand-hover: #EA580C;   --brand-active: #C2410C;
  --brand-soft: #FFF7ED;  --brand-ring: #FDBA74;
  --success: #16A34A; --success-soft: #F0FDF4;
  --warning: #D97706; --warning-soft: #FFFBEB;
  --danger:  #DC2626; --danger-soft:  #FEF2F2;
  --info:    #2563EB; --info-soft:    #EFF6FF;
  --radius-sm: 6px; --radius: 10px; --radius-lg: 14px;
  --shadow-sm: 0 1px 2px rgb(28 25 23 / .06);
  --shadow: 0 4px 16px rgb(28 25 23 / .08);
  --z-sticky: 10; --z-dropdown: 20; --z-drawer: 30; --z-modal: 40; --z-toast: 50;
}
```

Tailwind 4: khai báo `@theme` ánh xạ các biến trên thành `bg-brand`, `text-fg-muted`… Không dùng màu Tailwind trực tiếp ngoài token.

## 3. Chữ

- Font: **Be Vietnam Pro** (400/500/600), fallback Inter, system-ui. Tải qua `next/font`.
- Thang: 12 (phụ), 14 (thân, bảng), 16 (form, mô tả), 20 (tiêu đề thẻ), 24 (tiêu đề trang), 32 (số liệu lớn). Line-height 1.5; tiêu đề 1.25.
- Số liệu dùng `font-variant-numeric: tabular-nums`.

## 4. Bố cục

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │ Topbar 56px: chọn workspace · tìm kiếm · AI · người dùng │
│ 248px    ├───────────────────────────────────────────────┤
│ (64px    │ PageHeader: tiêu đề · mô tả · [nút phụ] [nút cam]      │
│ thu gọn) ├───────────────────────────────────────────────┤
│          │ Nội dung: max 1440px, padding 24px, lưới 8px             │
│          │   StatCard ×4  /  bộ lọc  /  DataTable (header dính)     │
└──────────┴───────────────────────────────────────────────┘
                                   Drawer phải 480px (chi tiết, AI) ─┐
```

- Sidebar: nền trắng, viền phải; mục đang chọn nền `--brand-soft` + chữ `--brand` + thanh cam 3px bên trái. Nhóm menu theo bản thiết kế mục 4.
- Topbar: nền trắng, viền dưới, dính (`--z-sticky`).
- Trang chi tiết (khách, đơn, ticket): cột trái 2/3 nội dung tab, cột phải 1/3 thẻ tóm tắt dính; dưới 1280px xếp dọc.
- Breakpoint: 768 (đọc, sidebar ẩn thành drawer trái), 1024, 1280, 1440, 1920.

## 5. Thành phần (`src/components/ui`)

| Thành phần | Quy tắc |
|---|---|
| `Button` | `primary` cam đặc, `secondary` trắng viền, `ghost`, `danger`. Cao 36px (sm 32). Một `primary` mỗi PageHeader/form. Loading hiện spinner, disabled không đổi màu nền sang cam nhạt (dùng opacity .5). |
| `PageHeader` | Tiêu đề 24, mô tả 14 `--fg-muted`, hành động phải. Breadcrumb trên tiêu đề khi là trang con. |
| `DataTable` | Header dính, dòng 44px, hover `--bg-subtle`, chọn dòng checkbox, sắp xếp cột, phân trang 25/50/100, cột cố định đầu khi cuộn ngang, nút "Xuất Excel" ở toolbar, bộ lọc trên bảng (chip đã chọn hiện cam nhạt). Rỗng/lỗi/tải xử lý bên trong. |
| `StatCard` | Nhãn 12, số 32 tabular, phụ 12 (so kỳ trước, mũi tên xanh/đỏ), mã chỉ số (REV-03) góc phải mờ, rê chuột hiện định nghĩa. |
| `Drawer` | Phải 480px (lg 640), nền trắng, overlay `rgb(28 25 23/.3)`, `--z-drawer`, đóng ESC/overlay/nút, focus trap, chỉ một instance (store `useOverlay`). |
| `Modal` | Giữa, max 560px, `--z-modal`, dùng cho xác nhận và form ngắn. Không mở khi drawer đang mở (store từ chối và cảnh báo dev). |
| `Dropdown`/`Select`/`Combobox` | `--z-dropdown`, đóng khi mở overlay khác, điều hướng bàn phím. |
| `Badge` | Trạng thái: nền soft + chữ đậm (`success/warning/danger/info/brand/neutral`). Ánh xạ trạng thái nghiệp vụ cố định ở `lib/status-badge.ts`. |
| `Form` | react-hook-form + zod; lỗi inline đỏ dưới ô; nhãn trên ô; ô bắt buộc dấu `*` cam; nút lưu cam, hủy ghost. |
| `Timeline` | Chấm theo loại sự kiện (cam = hành động người dùng, xám = hệ thống, xanh dương = AI), thời gian tương đối + tuyệt đối khi rê. |
| `Skeleton`, `EmptyState`, `ErrorState` | Dùng chung cho 4 trạng thái; `EmptyState` nhận `action`. |
| `Toast` | Góc phải dưới, `--z-toast`, tự tắt 5s, có nút hoàn tác khi áp dụng. |
| `AiPanel` | Drawer phải, header "Trợ lý AI" có chip model (replay/anthropic), từng câu trả lời kèm "Bằng chứng" mở rộng, nút "Tạo việc" dẫn tới form xác nhận. |
| `Kanban` (lead) | Cột theo giai đoạn, thẻ 1 dòng tiêu đề + SĐT che + điểm; kéo thả ghi Activity. |
| `Chart` | Recharts; màu chuỗi: cam, xám đậm, xanh dương, xanh lá, vàng; lưới nhạt; tooltip trắng viền. |

## 6. Khả năng truy cập

- Tương phản AA: cam `#F97316` trên trắng chỉ dùng cho chữ ≥ 18px hoặc đậm; chữ nhỏ trên cam dùng trắng; liên kết cam đậm `#C2410C` cho chữ 14.
- Focus ring 2px `--brand-ring` offset 2px cho mọi phần tử tương tác.
- Bàn phím: Tab trong bảng/drawer/modal; ESC đóng lớp phủ; Enter mở dòng.
- Mọi input có `label`; icon-button có `aria-label`; bảng có `caption` ẩn.

## 7. Checklist rà soát (Phase 11, dùng `/uiux`)

- [ ] Mỗi trang 4 trạng thái có ảnh chụp.
- [ ] E2E: mở drawer → bấm mở modal → modal không mở, không lỗi console.
- [ ] Không có hai lớp phủ trong DOM cùng lúc.
- [ ] Sidebar thu gọn và 768px không che nội dung.
- [ ] Bảng cuộn ngang không lồng trong vùng cuộn ngang khác.
- [ ] Axe không lỗi nghiêm trọng.
- [ ] Tất cả chuỗi tiếng Việt, không chữ tiếng Anh lọt (trừ mã chỉ số, SKU).

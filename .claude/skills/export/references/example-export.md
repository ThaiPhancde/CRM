# Ví dụ chuẩn — /export (đóng gói tài liệu bàn giao)

> Mẫu `/export food-delivery`. Output `docs/exports/2026-07-27-feature-food-delivery-package.md` (+ `.html`). Học: gom theo thứ tự chuỗi; giữ nguyên nội dung; danh mục nguồn minh bạch trạng thái; pdf trung thực khi thiếu pandoc.

---

```markdown
# Gói tài liệu bàn giao — food-delivery

> Ngày xuất: 2026-07-27 · Phạm vi: feature food-delivery · Số tài liệu: 5 · Người xuất: @hoangpm
> ⚠️ 2 tài liệu còn draft (SRS, UAT) — xem trạng thái ở Danh mục nguồn.

## Mục lục
1. [User Requirements (URD)](#user-requirements-urd)
2. [Business Requirements (BRD)](#business-requirements-brd)
3. [PRD (Feature)](#prd-feature)
4. [SRS (spec)](#srs-spec)
5. [UAT plan](#uat-plan)

---

## SRS (spec)
### 2. Functional Requirements
| ID | Requirement |
|----|-------------|
| **FR-food-delivery-003** | Khách đặt đơn; kiểm tồn kho + giá trị tối thiểu (BR-food-delivery-001)... |
...(giữ NGUYÊN nội dung, ID, bảng, wording)...

[↑ Mục lục](#mục-lục)

---

## Danh mục nguồn
| # | Tài liệu | Loại | Trạng thái | Cập nhật |
|---|---|---|---|---|
| 1 | docs/food-delivery/food-delivery-urd.md | urd | approved | 2026-07-24 |
| 4 | docs/food-delivery/srs/food-delivery-spec.md | srs | draft ⚠️ | 2026-07-25 |
```

## Report

```
✅ Export `food-delivery`:
   docs/exports/2026-07-27-feature-food-delivery-package.md   (5 doc)
   docs/exports/2026-07-27-feature-food-delivery-package.html (tự chứa, in được)
   pdf: chưa tạo (thiếu pandoc — cài `pandoc` rồi chạy lại `--format pdf`)
   Cảnh báo: 2 doc chưa approved (đã ghi trạng thái trong gói).
```

---

**Vì sao mẫu này tốt:** (1) Gom **theo thứ tự chuỗi** BA (URD→…→UAT) + TOC anchor. (2) **Giữ nguyên** ID/bảng/wording — export không sửa nội dung. (3) **Danh mục nguồn** ghi rõ status (`draft ⚠️`) — minh bạch, không "làm đẹp" thành approved. (4) Thiếu pandoc → **báo trung thực** "chưa tạo pdf" + cách cài, KHÔNG giả vờ đã tạo. (5) File đúng chỗ `docs/exports/{date}-{scope}-package.{ext}`.

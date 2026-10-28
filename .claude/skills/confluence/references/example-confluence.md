# Ví dụ chuẩn — /confluence (xuất bản tài liệu ↔ Confluence)

> Mẫu `/confluence publish food-delivery` (mặc định publish `srs/food-delivery-spec.md`). Học: nội dung 1 chiều lên; version guard chống đè; KHÔNG bịa URL/page_id; markdown → storage format giữ ID/bảng.

---

## sync-state.yaml (mappings.confluence, sau publish thật)

```yaml
mappings:
  confluence:
    - artifact: docs/food-delivery/srs/food-delivery-spec.md
      page_id: "88410"
      url: "https://acme.atlassian.net/wiki/spaces/FD/pages/88410"
      last_published: "2026-07-27T10:00:00"
      local_hash: "d4e5f6"
      remote_version: "4"
```

## Report publish (có kết nối)

```
✅ Confluence sync `food-delivery` (publish):
   Đã publish thật: srs/food-delivery-spec.md → page 88410 (v3→v4)
   Bỏ qua (không đổi): food-delivery-brd.md (hash khớp)
```

## Report publish (CHƯA cấu hình — dry-run)

```
⧗ Confluence dry-run `food-delivery` (chưa cấu hình kết nối):
   srs/food-delivery-spec.md → SẼ tạo/cập nhật page:
     title: "Food Delivery — SRS (spec)"   space: FD   parent: —
     body (storage): Overview · 9 FR · NFR · 4 BR · 6 Error Matrix · Data · OQ
   (page_id: — chưa publish)
→ Điền .claude/state/atlassian/sync-state.yaml (config.confluence.base_url + space_key).
```

## CONFLICT (ai đó sửa trực tiếp trên Confluence)

```
⚠️ CONFLICT srs/food-delivery-spec.md: Confluence version v4 > base v3 (có người sửa trên Confluence).
   Giữ local (đè) / xem remote / hủy?
```

---

**Vì sao mẫu này tốt:** (1) Dry-run in **title/space/body preview** + `page_id: —`, KHÔNG bịa URL. (2) Nội dung **1 chiều** local→Confluence (local là nguồn thật). (3) **Version guard**: Confluence v4 > base v3 → CONFLICT, không đè. (4) Hash khớp → **skip**, không tạo version rác. (5) Markdown → storage format **giữ ID** (`FR-*`/`E-*`) + bảng. (6) URL/page_id chỉ điền sau API thật.

---
type: api-map
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/integration/api-design.md
---

# {{feature_name}} — Field Mapping ({{provider}})

## {{Operation 1}} — direction: out (ta → vendor)

| Field của ta | Field vendor | Kiểu/Đơn vị | Bắt buộc | Transform | Chân lý | Ghi chú |
|---|---|---|---|---|---|---|
| {{Order.amount}} | {{amount}} | {{đồng → cent ×100}} | ✓ | {{}} | ta | {{}} |

## {{Operation 2}} — direction: in (webhook vendor → ta)

| Field vendor | Field của ta | Kiểu/Đơn vị | Bắt buộc | Transform | Chân lý | Ghi chú |
|---|---|---|---|---|---|---|
| {{status}} | {{Payment.status}} | {{enum-map}} | ✓ | {{SUCCESS→"Đã thanh toán"}} | vendor | {{}} |

## Chưa map được

- [ ] OQ-1: {{field 1 bên thiếu — cần làm rõ, KHÔNG bịa}}

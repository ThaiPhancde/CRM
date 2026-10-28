---
type: screen-index
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature}}-userflow.md
---

# {{feature_name}} — Screens Index

> Single source of metadata + descriptions cho mọi screen của feature. Nội dung screen (khung ASCII + bảng mô tả 5 cột) ở `ascii-wireframe/{flow-slug}.md`. Cột Figma/HTML là designs map (URL Figma + file HTML).

## Screens

| Slug | Màn hình | Thuộc flow | Status | Figma | HTML | HTML prototype | Updated |
|---|---|---|---|---|---|---|---|
| {{screen-slug}} | {{tên}} | {{flow-slug}} | draft | — (chưa import) | — | — | {{date}} |

## Descriptions

### {{screen-slug}}
{{1-2 câu mục đích màn — người đọc cần để hiểu}}

## Nguồn dữ liệu

- Flow + màn + transitions: [[../srs/{{feature}}-userflow.md|User Flow]]
- Nghiệp vụ (FR/BR/Error): [[../srs/{{feature}}-spec.md|SRS spec]]

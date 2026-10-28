---
type: uiux-review
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature}}-userflow.md
---

# {{feature_name}} — UI/UX Review

> Output `/uiux`. Review chất lượng trải nghiệm — đề xuất sửa, không thiết kế lại (route `/wireframe-*`).

## Checklist trạng thái

> ✓ có · ✗ thiếu · — không áp dụng. Trạng thái nào nghiệp vụ đòi (theo userflow/AC/Error) mới tính thiếu.

| Màn | default | loading | empty | error | success | Ghi chú |
|---|---|---|---|---|---|---|
| {{screen}} | ✓ | — | ✗ | ✓ | ✓ | {{...}} |

## Findings

### BLOCKING
- **{{tiêu đề}}** ({{màn}}): {{mô tả}}. Đề xuất: {{fix}} → `/{{skill}}`.

### WARNING
- {{...}}

### SUGGESTION
- {{...}}

## Flow gaps

- {{nhánh thiếu màn / màn mồ côi / luồng cụt}}

## Verdict

{{approve | revise | block}} — {{1 câu tóm tắt}}

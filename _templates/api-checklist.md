---
type: api-checklist
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/integration/api-design.md
---

# {{feature_name}} — API Test Checklist ({{provider}})

## Checklist

| ID | Mục kiểm | test_layer | direction | Loại | Nguồn |
|---|---|---|---|---|---|
| ACHK-001 | {{tạo giao dịch thành công}} | 3rd | out | happy | {{operation 1}} |
| ACHK-002 | {{lỗi {{CODE}} → wording E-{{feature}}-NNN + fallback}} | mixed | out | error | {{Error Matrix}} |
| ACHK-003 | {{webhook nhận trùng không trừ tiền 2 lần}} | own | in | edge | {{design §4}} |
| ACHK-004 | {{timeout → retry/đối soát}} | mixed | out | edge | {{design §5-6}} |

## Coverage

- [ ] Operation {{1}} — ACHK-001 (happy)
- [ ] Mã lỗi vendor {{CODE}} — ACHK-002
- [ ] Webhook in — ACHK-003
- [ ] Reconciliation/timeout — ACHK-004

## Open Questions

- [ ] OQ-1: {{ngưỡng/hành vi chưa chốt}}

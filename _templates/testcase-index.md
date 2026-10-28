---
type: test-cases-index
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/test/checklist/{{feature}}-checklist-index.md
---

# {{feature_name}} — Test Cases

> Mỗi test case là kịch bản chạy được: precondition + steps + test data + expected (đo được). Mỗi CHK có ≥1 TC. TC-ID đọc index lấy max+1, KHÔNG reuse.

## Index

| TC-ID | Tiêu đề | Type | Priority | Maps-to | Status |
|---|---|---|---|---|---|
| TC-001 | {{tiêu đề}} | positive | P0 | CHK-001, AC-001 | draft |

## Test cases

### TC-001: {{tiêu đề}}
- **Type**: positive | negative | boundary  **Priority**: P0/P1/P2
- **Maps-to**: CHK-{{NNN}}, AC-{{NNN}}, FR-{{feature}}-NNN / E-{{feature}}-NNN
- **Precondition**: {{trạng thái trước khi chạy — trích test data}}
- **Test data**: {{tài khoản / nhà hàng / số tiền mẫu}}
- **Steps**:
  1. {{hành động}}
  2. {{hành động}}
- **Expected**: {{kết quả đo được — trạng thái / wording exact / số liệu}}

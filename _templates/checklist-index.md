---
type: test-checklist-index
feature: {{feature_slug}}
status: draft
updated: {{date}}
next_chk_id: 1
links:
  - docs/{{feature_slug}}/userstories/{{feature}}-story-index.md
  - docs/{{feature_slug}}/srs/{{feature}}-spec.md
---

# {{feature_name}} — Test Checklist

> Mỗi mục là 1 điều-cần-kiểm ngắn gọn (điều kiện → hành động → mong đợi). Step/data chi tiết ở test case (`/test-cases`). CHK-ID cấp từ `next_chk_id`; ID bỏ chuyển xuống Retired, KHÔNG reuse.

## Checklist

### {{Khu vực / Màn}}
- [ ] CHK-001: {{điều cần kiểm — trích số liệu/wording thật}}
- [ ] CHK-002: {{...}}

## Coverage

> Mọi nghĩa vụ (AC / FR / Error / BR) phải có ≥1 CHK. Cạnh truy vết VERIFIES. Loại: positive / negative / boundary.

| Nghĩa vụ | CHK phủ | Loại |
|---|---|---|
| AC-001 | CHK-001 | positive |
| E-{{feature}}-002 | CHK-002 | negative |
| BR-{{feature}}-001 | CHK-003 | boundary |

## Retired CHK-IDs

| CHK-ID | Lý do bỏ | Ngày |
|---|---|---|
| — | — | — |

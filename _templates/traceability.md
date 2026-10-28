---
type: traceability
scope: {{all | feature-slug}}
status: draft
updated: {{date}}
links: []
---

# Traceability & Gap Analysis

> Output `/gap`. Ma trận truy vết cross-doc + lỗ hổng. Read-only phân tích — sửa nội dung qua skill sở hữu doc.

## Coverage

| Feature | FR→UC | FR→US | US→AC | AC→Test | E→Test(neg) | Health |
|---|---|---|---|---|---|---|
| {{feature}} | {{x/y}} | {{x/y}} | {{x/y}} | {{x/y}} | {{x/y}} | {{%}} |

## Ma trận truy vết

| FR | UC | US | AC | CHK/TC | Screen | Error | Trạng thái |
|---|---|---|---|---|---|---|---|
| FR-{{feature}}-001 | UC-{{slug}} | US-001 | AC-001 | CHK-001/TC-001 | {{screen}} | E-{{feature}}-001 | verified |

## Gaps

### BLOCKING
- {{mô tả}} tại {{vị trí}} → khắc phục: `/{{skill}} {{feature}}`

### WARNING
- {{...}}

### SUGGESTION
- {{...}}

## Broken references

| ID trỏ | Trong file | Vấn đề |
|---|---|---|
| {{FR-...-099}} | {{path}} | không tồn tại ở nguồn |

## Cần người xác nhận

- {{quan hệ mơ hồ}}

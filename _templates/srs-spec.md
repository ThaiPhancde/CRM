---
type: srs
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/{{feature}}-prd.md
---

# {{feature_name}} — SRS (spec)

## 1. Overview

{{phạm vi feature, actor, bối cảnh}}

## 2. Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR-{{feature}}-001** | {{hệ thống làm gì, điều kiện — testable}} |

## 3. Non-Functional Requirements

| ID | Requirement | Target đo được |
|----|-------------|----------------|
| **NFR-{{feature}}-001** | {{loại: perf/security/...}} | {{≤2s p95 / hoặc OQ}} |

## 4. Business Rules

| ID | Rule |
|----|------|
| **BR-{{feature}}-001** | {{luật + ngưỡng cụ thể}} |

## 5. Error Matrix

| ID | Điều kiện | Wording (exact) | Hệ quả |
|----|-----------|------------------|--------|
| **E-{{feature}}-001** | {{khi nào}} | "{{string user thấy}}" | {{hệ quả}} |

## 6. Data Requirements

> Entity nghiệp vụ (không schema DB — /erd hoặc /dbdiagram vẽ chi tiết).

- **{{Entity}}** — {{thông tin nghiệp vụ cần lưu}}

## 7. External Interfaces

- {{dịch vụ ngoài: tên + mục đích nghiệp vụ}}

## 8. Constraints & Assumptions

- {{ràng buộc / giả định}}

## Open Questions

- [ ] OQ-1: {{...}}

---
type: nfr-assessment
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature}}-spec.md
---

# {{feature_name}} — NFR Assessment

> Output `/nfr`. Soát 8 nhóm NFR — mỗi NFR áp dụng cần target đo được + cách kiểm. Số chưa chốt → Open Question, KHÔNG bịa.

## Đánh giá 8 nhóm

| Nhóm | Áp dụng? | Trạng thái | NFR hiện có | Target đo được đề xuất | Cách kiểm |
|---|---|---|---|---|---|
| Performance | có/không | đủ/mơ hồ/thiếu | {{NFR-...}} | {{≤2s p95}} | {{đo p95 latency}} |
| Security | | | | | |
| Availability | | | | | |
| Usability | | | | | |
| Scalability | | | | | |
| Maintainability | | | | | |
| Compliance | | | | | |
| Observability | | | | | |

## Findings

### BLOCKING
- {{nhóm quan trọng với feature nhưng trống, vd payment thiếu Security}}

### WARNING
- {{NFR mơ hồ không đo được}}

### SUGGESTION
- {{...}}

## Đề xuất ghi vào SRS (Mục 3)

- **NFR-{{feature}}-001** — {{phát biểu + target đo được}}

## Open Questions

- [ ] OQ-1: {{target chưa chốt}}

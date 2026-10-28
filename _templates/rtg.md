---
type: rtg
scope: {{all | feature-slug}}
status: draft
updated: {{date}}
links: []
---

# Requirements Traceability Matrix (RTM)

> Output `/rtg`. Ma trận bàn giao/audit — 1 hàng/1 yêu cầu, mọi yêu cầu đều có mặt (kể cả chưa phủ, ô trống + đánh dấu). ID full-form. Render Confluence/GitHub, paste Excel được.

## RTM

| # | Requirement | Source | Use case | User story | AC | Test (CHK/TC) | Screen | Priority | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | FR-{{feature}}-001 | CAP-{{feature}}-01 | UC-{{slug}} | US-001 | AC-001 | CHK-001, TC-001 | {{screen}} | P0 | testable |

## Chưa phủ

> Yêu cầu còn ô trống ở tầng quan trọng (chưa có UC/US/test). Phân tích sâu: `/gap`.

- {{FR-...}}: thiếu {{tầng}}

## Chú giải Status

- **draft** — mới có yêu cầu (FR), chưa thiết kế.
- **designed** — đã có UC/US.
- **specified** — đã có AC.
- **testable** — đã có CHK/TC.
- **verified** — có bằng chứng test pass (cần kết quả chạy).

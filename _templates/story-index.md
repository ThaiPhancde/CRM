---
type: userstory-index
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature}}-spec.md
---

# {{feature_name}} — User Stories Index

## Stories

> Single source of metadata + status + jira-key cho mọi story của feature. Cột "Covers FR" phủ hết FR trong spec (coverage). Nội dung story (prose As-a/I-want/so-that + AC) ở `us-{NNN}.md`.

| # | ID | Title | Persona | Covers FR | Screens | Priority | Status | Jira key | Updated |
|---|----|-------|---------|-----------|---------|----------|--------|----------|---------|
| 1 | [US-001](us-001.md) | {{title}} | {{persona}} | FR-{{feature}}-001 | {{screen-slug}} | P0 | draft | — | {{date}} |

## Coverage

> FR nào đã có story. Đối chiếu với `srs/{{feature}}-spec.md` Mục 2. FR mồ côi (không story UI) ghi rõ lý do.

| FR | Story | Ghi chú |
|----|-------|---------|
| FR-{{feature}}-001 | US-001 | — |

## Nguồn dữ liệu

- FR + Error Matrix + BR: [[../srs/{{feature}}-spec.md|SRS spec]]
- Personas: [[../{{feature}}-urd.md|URD]] / [[../{{feature}}-prd.md|PRD]]
- Use cases: [[../usecases/{{feature}}-usecase-index.md|UC index]]
- Screens: [[../ascii-wireframe/{{feature}}-wireframe-index.md|Screens index]]

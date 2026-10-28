---
type: reverse-srs
feature: {{feature_slug}}
status: draft
updated: {{date}}
confidence_summary: "✅ {{a}}% · 🔵 {{b}}% · 🟡 {{c}}%"
links: []
---

# {{feature_name}} — Reverse SRS (tái lập từ nguồn)

> Tái lập từ tài liệu cũ — **status draft cứng, cần người xác thực**. Nhãn tin cậy: ✅ nguồn nói rõ · 🔵 suy luận hợp lý · 🟡 giả định/gap (nguồn không nói). Mọi 🟡 + mâu thuẫn ở `reverse-gaps.md`.

## 0. Provenance

- **Nguồn:** {{danh sách file — chi tiết ở reverse-sources.md}}
- **Độ tin cậy:** ✅ {{a}} mục · 🔵 {{b}} · 🟡 {{c}}
- **Đối chiếu:** {{ghi chú tái lập}}

## 2. Functional Requirements

| ID | Requirement | Nguồn | Nhãn |
|----|-------------|-------|------|
| **FR-{{feature}}-001** | {{...}} | {{file:vị trí}} | ✅/🔵/🟡 |

## 3. Non-Functional Requirements

| ID | Requirement | Nguồn | Nhãn |
|----|-------------|-------|------|
| **NFR-{{feature}}-001** | {{...}} | {{...}} | 🟡 |

## 4. Business Rules

| ID | Rule | Nguồn | Nhãn |
|----|------|-------|------|
| **BR-{{feature}}-001** | {{...}} | {{...}} | ✅ |

## 5. Error Matrix

| ID | Điều kiện | Wording | Nguồn | Nhãn |
|----|-----------|---------|-------|------|
| **E-{{feature}}-001** | {{...}} | "{{...}}" | {{...}} | 🔵 |

## 6. Data Requirements

- **{{Entity}}** — {{...}} ({{nguồn}}, ✅/🔵/🟡)

## Open Questions & Gaps

> Chi tiết ở `reverse-gaps.md`. Tóm tắt:

- [ ] 🟡 {{gap: nguồn không nói}}
- [ ] ⚠️ Conflict: {{nguồn A nói X, nguồn B nói Y}}

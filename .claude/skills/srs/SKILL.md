---
name: srs
description: Dùng khi cần đặc tả kỹ thuật nghiệp vụ (SRS) cho 1 feature — FR, NFR, Business Rules, Error Matrix (mã hóa đầy đủ) + điều phối sang sơ đồ/flow/user story. Kích hoạt bằng `/srs <feature | mô tả>`. Kế thừa brainstorm + URD + BRD + PRD.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature-slug> | <mô tả nghiệp vụ mới>"
---

# /srs — Software Requirements Spec (orchestrator)

## Goal

Viết **SRS spec** — đặc tả kỹ thuật-nghiệp vụ đầy đủ cho 1 feature tại `docs/{feature}/srs/{feature}-spec.md`: **Overview**, **Functional Requirements** (`FR-{feature}-NNN`), **Non-Functional Requirements** (`NFR-{feature}-NNN`), **Business Rules** (`BR-{feature}-NNN`), **Error Matrix** (`E-{feature}-NNN` + wording exact), **Data Requirements** (entities), **External Interfaces**, **Constraints/Assumptions**, **Open Questions**. Là **nguồn thật** cho toàn bộ downstream (`/usecase`, `/userstory`, `/ac`, `/test-checklist`, wireframe...).

`/srs` cũng là **orchestrator**: sau khi chốt spec, đề xuất menu điều phối sang sơ đồ (`/sequence`, `/activity`, `/erd`, `/state`), chia flow (`/user-flow`), use case/story (`/usecase`, `/userstory`) — các skill này ở gói khác trong BA-KIT.

## Constraints

- **spec.md là điểm-vào (nhóm A).** Chưa có spec + arg là mô tả/feature mới → derive slug + phỏng vấn Batch 1-2 + tạo `srs/` folder (`feature-bootstrap.md` — srs là trường hợp riêng). Downstream menu (flows/erd/story...) theo nhóm B (cần spec vừa chốt). Có brainstorm/URD/BRD/PRD → trích (no-re-ask).
- **L1 approval TRƯỚC MỖI Write** (mô hình tuần tự) — KHÔNG sub-agent write-then-confirm (`approval-gate.md`: sub-agent trả proposed content, main thread show L1/L2 rồi mới Write). **L2 diff** khi update.
- **KHÔNG L3** (text). Chốt qua L1.
- **ID đầy đủ + full-form** — FR/NFR/BR/E theo `naming-conventions.md` (`FR-{feature}-NNN` 3-digit). KHÔNG short-form. ID không reuse.
- **Error Matrix wording exact** — mỗi error case: điều kiện + **wording chính xác** (string user thấy) + hệ quả. Số/ngưỡng chưa có → OQ, KHÔNG bịa.
- **FR đo được, testable** — mỗi FR 1 hành vi rõ, nguồn cho `/userstory` + `/test-checklist`. NFR có target đo được (hoặc OQ) — có thể route `/nfr` để audit sâu.
- **Data Requirements liệt kê entity nghiệp vụ** (không schema DB) — route `/erd`/`/dbdiagram` để vẽ chi tiết.
- **IT-BA framing** — spec là nghiệp vụ + hành vi hệ thống mức business; quyết định kiến trúc (framework/schema) để dev. Nhưng SRS ĐƯỢC nói "hệ thống làm gì" chi tiết hơn URD/PRD.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**. Frontmatter FULL (`type: srs`, status, links...).
- **resolve-oqs Phase E** — own + inherited (brainstorm + URD + BRD + PRD).

## Inputs

```
/srs <feature>                    # viết/cập nhật SRS spec (kế thừa upstream)
/srs <mô tả tính năng mới>        # feature chưa có → derive slug + phỏng vấn + tạo srs/
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có upstream (brainstorm/urd/brd/prd): !`for d in docs/*/; do f=$(basename "$d"); { ls "$d"brainstorms/*.md >/dev/null 2>&1 || ls "$d"*-urd.md >/dev/null 2>&1 || ls "$d"*-prd.md >/dev/null 2>&1; } && echo "$f"; done 2>/dev/null | grep -v '^_' | tr '\n' ' '`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature** (slug / mô tả → derive nhóm A / list). Tạo `docs/{feature}/srs/` khi Write (feature mới).
2. **Update mode?** spec.md tồn tại → Read full (no-re-ask), lấy max ID mỗi loại.
3. **Gather upstream:** brainstorm (flows, số liệu, wording, state, decision) + URD (needs → FR) + BRD (BO, business rules, scope) + PRD (capabilities → FR nhóm). 
   > *Tăng tốc:* `kg facts {feature}` cho biết FR/entity/OQ hiện có; `kg coverage` để không bỏ sót capability→FR. Thiếu KG → đọc trực tiếp (`kg-usage.md`). Kết luận nội dung dựa prose Read.

### Phase B — Interview (Batch 1-2, phần thiếu)

4. **Batch 1 — FR + Business Rules:** mỗi capability (PRD) / need (URD) / flow (brainstorm) → FR cụ thể (hệ thống làm gì, điều kiện). Business rules + ngưỡng số liệu. Có brainstorm chi tiết → phần lớn tự trích.
5. **Batch 2 — Error + NFR + Data:** mỗi FR có nhánh lỗi nào → Error Matrix (điều kiện + wording exact + hệ quả). NFR (perf/security/... — có thể để `/nfr` audit). Entity nghiệp vụ cần lưu. Số chưa rõ → OQ.

### Phase C — Compose + quality gate

6. **`{feature}-spec.md`** (theo `_templates/srs-spec.md`): Overview · FR · NFR · Business Rules · Error Matrix · Data Requirements · External Interfaces · Constraints/Assumptions · Open Questions. ID full-form, liên tục.
7. **Self-check**: mọi capability/need có FR phủ; mỗi FR có nhánh lỗi → Error; BR có ngưỡng; NFR có target/OQ; wording error exact; ID không trùng/thiếu.
8. **Spec-Reviewer gate (CHỈ khi vượt ngưỡng)** — **≥15 FR** HOẶC **≥8 error** HOẶC feature nhạy cảm (payment/auth) → spawn `spec-reviewer` (Task tool, lens senior-BA: completeness, FR testable, error coverage, NFR đo được). Sub-agent **trả proposed findings**, KHÔNG tự Write. BLOCKING → sửa, loop ≤2. Dưới ngưỡng → self-check đủ.

### Phase D — Approval + Write (tuần tự)

9. **L1 plan preview** (prose BA-friendly): "Em sẽ {tạo/cập nhật} `srs/{feature}-spec.md`: {N} FR, {M} NFR, {B} rule, {E} error (wording cụ thể), {D} entity; còn {Q} câu hỏi mở. Apply?"
10. **Set env trước Write**: `CLAUDE_SKILL_NAME=/srs` + author + note (vd `SRS: {N} FR + {E} error`). Write spec.md.

### Phase E — Resolve OQ + orchestration menu

11. **resolve-oqs Phase E**: own + inherited (brainstorm+URD+BRD+PRD) → loop → cascade (spec sections + downstream) → L2 diff.
12. **Orchestration menu (report):**
    ```
    ✅ SRS spec: docs/{feature}/srs/{feature}-spec.md
       FR {N} · NFR {M} · BR {B} · Error {E} · Entity {D} | OQ: {r}/{n} | Reviewed: {y/n}

    Điều phối tiếp (skill ở gói khác trong BA-KIT):
      Sơ đồ:   /sequence · /activity · /erd · /state   (docs/{feature}/srs/, dbdiagram/)
      Flow/màn: /user-flow → /wireframe-ascii · /wireframe-html · /prototype-html
      Đặc tả:  /usecase · /userstory · /ac
      Kiểm thử: /test-checklist · /test-cases
      Chất lượng: /nfr (audit NFR) · /gap (truy vết)
    ```

## Gotchas

- **spec là nguồn thật downstream** — bịa FR/error làm hỏng cả chuỗi. Thiếu → OQ, không chế.
- **Error wording không exact** — Error Matrix phải là string user thấy đúng từng chữ (nguồn cho `/ac`, `/wireframe-*`).
- **NFR mơ hồ** — target đo được hoặc route `/nfr` audit; đừng ghi "nhanh".
- **Short-form ID** — luôn `FR-{feature}-NNN` full-form (nguồn trace).
- **Sub-agent tự Write** — CẤM; spec-reviewer trả findings, main thread Write sau approval (`approval-gate.md`).
- **`/srs` không tự vẽ sơ đồ** — điều phối route sang skill sơ đồ; spec.md chỉ chứa FR/NFR/BR/Error/Data text.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../rules/agent-conventions.md
- @../../rules/kg-usage.md
- @../../rules/diagram-selection.md
- @../../../_templates/srs-spec.md
- @./references/example-srs.md
- @../../agents/spec-reviewer.md

---
name: brd
description: Dùng khi cần viết Business Requirements Document — góc NGHIỆP VỤ/KINH DOANH (mục tiêu KD + đo lường, stakeholders, phạm vi nghiệp vụ, cost-benefit, rủi ro). Kích hoạt bằng `/brd <feature | mô tả>`. Kế thừa brainstorm + URD.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> | <mô tả nghiệp vụ mới>"
---

# /brd — Business Requirements Document

## Goal

Viết **BRD** cho 1 feature — góc **kinh doanh/nghiệp vụ**: **Executive Summary**, **Business Objectives & Success Measures** (`BO-{feature}-NNN` + KPI đo được), **Stakeholders**, **Business Scope** (in/out + dependencies), **Business Rules** (mức nghiệp vụ), **Cost-Benefit** (định tính/định lượng), **Risks**. Output: `docs/{feature}/{feature}-brd.md`. Kế thừa brainstorm + `{feature}-urd.md`.

BRD trả lời "**vì sao doanh nghiệp làm feature này + đo thành công ra sao**" — biện minh đầu tư, không phải giải pháp.

## Constraints

- **Nhóm A — điểm vào.** Feature mới → derive slug + phỏng vấn business case + tạo. Có brainstorm/URD → trích (no-re-ask).
- **L1 approval** trước Write. **L2 diff** khi update. **KHÔNG L3**.
- **BO đo được** — mỗi Business Objective `BO-{feature}-NNN` có success measure (KPI + target). Số chưa chốt → OQ, KHÔNG bịa ROI/%.
- **Góc kinh doanh, KHÔNG kỹ thuật/UI** — objective là "giảm thời gian xử lý đơn 30%", không "thêm cache". IT-BA framing.
- **Business Scope tường minh** — in-scope + **out-of-scope** + dependencies (vendor/phòng ban). Chống scope creep.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**. Frontmatter `type: brd`.
- **resolve-oqs Phase E** — own + inherited (brainstorm + URD).

## Inputs

```
/brd <feature>                    # viết BRD (kế thừa brainstorm + URD)
/brd <mô tả tính năng mới>        # feature chưa có → derive slug + phỏng vấn + tạo
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có URD/brainstorm: !`for d in docs/*/*-urd.md docs/*/brainstorms/*.md; do [ -f "$d" ] && basename $(dirname $(echo "$d" | sed 's#/brainstorms/.*##;s#/[^/]*-urd.md##')/x); done 2>/dev/null | sort -u | tr '\n' ' '`
Feature có BRD: !`for d in docs/*/*-brd.md; do [ -f "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature** (slug / mô tả → derive nhóm A / list).
2. **Update mode?** BRD tồn tại → Read full (no-re-ask).
3. **Gather:** Read brainstorm (why now, risks, pains) + `{feature}-urd.md` (personas, needs) + `docs/_product/prd.md` nếu có (mục tiêu sản phẩm để align). Thiếu → phỏng vấn business case.

### Phase B — Interview (business case, phần thiếu)

4. Hỏi gom: **mục tiêu KD** (tăng gì/giảm gì) + **cách đo** (KPI + target) · **stakeholders** (ai quan tâm, vai trò) · **phạm vi** (in/out, dependencies) · **cost-benefit** (chi phí lớn, lợi ích) · **rủi ro KD** (adoption/vendor/compliance/timeline). Số chưa rõ → OQ.

### Phase C — Compose + approval + write

5. **`{feature}-brd.md`** (theo `_templates/brd.md`): Executive Summary · Business Objectives & Success Measures (`BO-*` + KPI) · Stakeholders · Business Scope (in/out/deps) · Business Rules · Cost-Benefit · Risks (Khả năng/Hậu quả/Cách giảm) · Assumptions · Open Questions.
6. **L1 plan preview** → **Write** (env note `BRD: {N} objective, {R} risk`).
7. **Phase D — resolve-oqs**: own + inherited (brainstorm + URD) → loop → cascade → L2 diff.
8. **Output report:**
   ```
   ✅ BRD: docs/{feature}/{feature}-brd.md
      Objectives: {N} (BO-*) | Stakeholders: {S} | Risks: {R} | OQ: {r}/{n}

   Recommended next:
     - /prd-epic {feature}  — product scope (capabilities P0/P1/P2)
     - /srs {feature}       — đặc tả kỹ thuật
   ```

## Gotchas

- **BO không đo được = khẩu hiệu** — "cải thiện trải nghiệm" vô nghĩa; ép KPI + target hoặc OQ.
- **Bịa ROI/%** — số tài chính chưa có nguồn → OQ + "cần chốt", KHÔNG chế.
- **Thiếu out-of-scope** — BRD không có OOS dễ scope creep; luôn ép.
- **Objective = giải pháp/UI** — sai góc; objective là kết quả KD, không "thêm dashboard".
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../../_templates/brd.md
- @./references/example-brd.md

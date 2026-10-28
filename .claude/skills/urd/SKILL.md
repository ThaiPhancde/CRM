---
name: urd
description: Dùng khi cần viết User Requirements Document — góc NGƯỜI DÙNG (personas, nhu cầu, hành trình, tiêu chí thành công) từ brainstorm. Kích hoạt bằng `/urd <feature | mô tả>`. Kế thừa brainstorm nếu có; tự tạo feature nếu chưa.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> | <mô tả nghiệp vụ mới>"
---

# /urd — User Requirements Document

## Goal

Viết **URD** cho 1 feature — mô tả yêu cầu theo **góc người dùng**: **Personas** (ai dùng, đặc điểm), **User Needs** (họ cần gì — phát biểu bằng ngôn ngữ người dùng), **User Journeys** (hành trình đạt mục tiêu), **Success Criteria** (khi nào coi là thành công với user). Output: `docs/{feature}/{feature}-urd.md`. Kế thừa `docs/{feature}/brainstorms/*.md` nếu có (no-re-ask).

URD trả lời "**người dùng cần gì và vì sao**" — chưa phải giải pháp (PRD) hay đặc tả kỹ thuật (SRS). Là tầng đầu chuỗi tài liệu feature.

## Constraints

- **Nhóm A — điểm vào.** Feature chưa tồn tại + arg là mô tả → derive slug + phỏng vấn user-needs + tạo feature (`feature-bootstrap.md` nhóm A). Có brainstorm → trích, KHÔNG hỏi lại (no-re-ask).
- **L1 approval** trước Write. **L2 diff** khi URD đã tồn tại. **KHÔNG L3** (text thuần).
- **Góc người dùng, KHÔNG giải pháp/kỹ thuật.** User Need phát biểu "tôi muốn X để Y", KHÔNG "hệ thống phải có nút Z". Giải pháp là `/prd-epic`, kỹ thuật là `/srs`. IT-BA framing (`ba-conventions.md` Mục 3).
- **Personas cụ thể** — không "mọi người"; mỗi persona có đặc điểm + mục tiêu + pain.
- **Success Criteria đo được** khi có thể; số chưa rõ → OQ, KHÔNG bịa.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**. Frontmatter `type: urd`.
- **resolve-oqs Phase E** — collect own OQs + inherited từ brainstorm.

## Inputs

```
/urd <feature>                    # viết URD (kế thừa brainstorm nếu có)
/urd <mô tả tính năng mới>        # feature chưa có → derive slug + phỏng vấn + tạo
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có brainstorm: !`for d in docs/*/brainstorms/*.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | sort -u | tr '\n' ' '`
Feature có URD: !`for d in docs/*/*-urd.md; do [ -f "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature** (slug khớp folder / mô tả → derive slug nhóm A / no-arg → list).
2. **Update mode?** URD tồn tại → Read full (no-re-ask).
3. **Gather:** Read `docs/{feature}/brainstorms/*.md` (user types, flows, pains). Có → trích personas/needs/journeys; thiếu → phỏng vấn góc user (nhóm A).

### Phase B — Interview (chỉ phần thiếu, góc user)

4. Hỏi gom (business language, no-re-ask): **ai dùng** (personas + đặc điểm) · **họ cần gì** (needs, vì sao) · **hành trình** đạt mục tiêu (các bước từ góc user) · **thành công là gì** (tiêu chí user cảm nhận). Vague → re-ask 1 lần → OQ.

### Phase C — Compose + approval + write

5. **`{feature}-urd.md`** (theo `_templates/urd.md`): Personas · User Needs (đánh dấu ưu tiên) · User Journeys · Success Criteria · Assumptions · Open Questions.
6. **L1 plan preview** (prose BA-friendly) → **Write** (env note `URD: {N} persona, {M} need`). 
7. **Phase D — resolve-oqs**: own + inherited từ brainstorm → loop → cascade → L2 diff → activity log.
8. **Output report:**
   ```
   ✅ URD: docs/{feature}/{feature}-urd.md
      Personas: {N} | Needs: {M} | OQ: resolved {r}/{n}, hold {m}

   Recommended next:
     - /brd {feature}       — business case (mục tiêu KD, ROI)
     - /prd-epic {feature}  — product scope (capabilities)
     - /srs {feature}       — đặc tả kỹ thuật (FR/NFR/BR/Error)
   ```

## Gotchas

- **URD ≠ giải pháp** — "user cần đăng nhập nhanh" (need) KHÔNG "thêm nút Google OAuth" (solution → PRD/SRS).
- **Persona generic** — "người dùng" trong feature nhiều vai là red flag; cụ thể hóa.
- **Bịa success metric** — chưa có số → OQ.
- **No-re-ask** — brainstorm đã nói thì trích, đừng hỏi lại.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../../_templates/urd.md
- @./references/example-urd.md

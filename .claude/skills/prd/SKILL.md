---
name: prd
description: Dùng khi cần dựng PRD cấp SẢN PHẨM (không phải feature) — pitch, vấn đề, người dùng, giá trị, mục tiêu/non-goals, Feature Map, chỉ số thành công, ràng buộc, rủi ro. Kích hoạt bằng `/prd`. Đọc `docs/_product/discovery.md` nếu có; tự vào update mode nếu PRD đã tồn tại.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "(empty) | <mô tả sản phẩm nếu chưa có discovery>"
---

# /prd — Product PRD (PRD cấp sản phẩm) + Feature Map

## Goal

Dựng **PRD cấp sản phẩm** (project-level, singleton) tại `docs/_product/prd.md` — bức tranh sản phẩm để mọi feature bám theo. Gồm: **Pitch** (elevator), **Problem**, **Target Users/Personas**, **Value Proposition**, **Goals & Non-goals**, **Themes**, **Feature Map** (bảng danh mục tính năng + ưu tiên + trạng thái chi tiết hóa), **Success Metrics**, **Constraints/Assumptions**, **Risks**, **Open Questions**.

**Feature Map là trái tim của PRD** — bảng liệt kê mọi tính năng của sản phẩm với slug, theme, ưu tiên, và cột "Chi tiết hóa" (đã có brainstorm/SRS chưa). Đây là nơi `/roadmap` đọc để ưu tiên, và là nơi các feature per-feature (`/brainstorm`, `/srs`…) được sinh ra rồi mark ngược `✅ đã chi tiết`.

> `/prd` (cấp **sản phẩm**, type `prd-product`, file `docs/_product/prd.md`) khác `/prd-epic` (cấp **feature**, type `prd`, file `docs/{feature}/{feature}-prd.md`). Đừng nhầm 2 skill.

## Constraints

- **Project-level (nhóm C).** Không cần feature. Chưa có gì trong vault vẫn chạy được (greenfield) — `feature-bootstrap.md` nhóm C.
- **Singleton** — 1 sản phẩm = 1 `docs/_product/prd.md`. Đã tồn tại → **tự vào update mode** (Read full trước, L2 diff), KHÔNG cần flag.
- **L1 approval** trước Write. **L2 diff** khi update.
- **Nguồn ưu tiên: `docs/_product/discovery.md`.** Có → trích pitch/problem/users/value/goals/themes/risks/OQ từ đó (no-re-ask, KHÔNG hỏi lại cái discovery đã chốt). Chưa có discovery → phỏng vấn gọn đúng phạm vi PRD (hoặc đề xuất chạy `/discover` trước nếu ý tưởng còn thô).
- **Feature Map bám themes + vault thực tế.** Scan `docs/*/` (feature đã tồn tại) để điền cột "Chi tiết hóa"; theme từ discovery/PRD; feature ứng viên từ themes. KHÔNG bịa feature không có cơ sở.
- **Product framing — KHÔNG feature-detail.** PRD sản phẩm mô tả **capability cấp sản phẩm + phạm vi**, KHÔNG mô tả flow/validation/wording 1 tính năng (đó là `/prd-epic` + `/srs`). CẤM technical (schema/endpoint/framework).
- **Non-goals tường minh** — ghi rõ điều sản phẩm **KHÔNG** làm (chống scope creep).
- **Success Metrics đo được** — số chưa có → OQ, KHÔNG bịa (KPI phải có định nghĩa + baseline/target hoặc đánh dấu cần chốt).
- **Doc sạch — KHÔNG meta-text** (`ba-conventions.md` Mục 0). Frontmatter tối giản `type: prd-product` / `status` / `updated` / `links` (KHÔNG `feature` — project-level). **Vietnamese-first**.
- **ID capability sản phẩm** (nếu dùng) theo `naming-conventions.md`; Feature slug kebab-case ASCII.

## Inputs

```
/prd                          # đọc discovery.md → dựng/cập nhật PRD sản phẩm
/prd <mô tả sản phẩm>          # chưa có discovery → phỏng vấn gọn rồi dựng PRD
/prd thêm feature <slug> vào Feature Map    # update mode: bổ sung 1 dòng Feature Map
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Discovery? !`[ -f docs/_product/discovery.md ] && echo "có → dùng làm nguồn" || echo "chưa"`
PRD sản phẩm? !`[ -f docs/_product/prd.md ] && echo "docs/_product/prd.md (update mode)" || echo "chưa — tạo mới"`
Feature đã có trong vault: !`ls -d docs/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null | grep -v '^_' | tr '\n' ' '`

## Approach

### Phase A — Resolve nguồn + mode (silent)

1. **Update mode?** `docs/_product/prd.md` tồn tại → Read full (no-re-ask). Xác định cần thêm/sửa section nào (vd thêm dòng Feature Map, cập nhật metric).
2. **Nguồn discovery.** `docs/_product/discovery.md` có → Read, trích nội dung. Không có → nếu arg là mô tả thô → gợi ý "nên chạy `/discover` trước để khám phá kỹ; hoặc em phỏng vấn gọn ngay để dựng PRD?" (user chọn).
3. **Scan vault** `docs/*/` → danh sách feature đã tồn tại + artifact nào có (brainstorm/srs) để điền cột "Chi tiết hóa" của Feature Map.
   > *Tăng tốc tùy chọn:* `kg counts` / `kg facts` cho biết feature nào có brainstorm/spec. Thiếu KG engine → scan trực tiếp (`kg-usage.md`).

### Phase B — Gather (phỏng vấn gọn nếu thiếu discovery)

4. Có discovery → không phỏng vấn lại, chỉ hỏi gap (vd metric chưa có, feature map chưa rõ ưu tiên). Thiếu discovery → hỏi gọn đúng phạm vi PRD: pitch · problem · personas · value · goals & non-goals · themes → feature ứng viên · success metrics · constraints · risks. Business framing, no-re-ask, push cụ thể, số chưa có → OQ.

### Phase C — Compose

5. **`docs/_product/prd.md`** theo `_templates/prd-product.md`:
   - **Pitch** — 1-2 câu elevator.
   - **Problem** — vấn đề + ai chịu + why now.
   - **Target Users / Personas** — segment + đặc điểm + JTBD (trích discovery).
   - **Value Proposition** — vì sao sản phẩm này, khác biệt.
   - **Goals & Non-goals** — mục tiêu sản phẩm (định tính/định lượng) + điều KHÔNG làm.
   - **Themes** — các mảng lớn (nhóm feature).
   - **Feature Map** (bảng): `# | Feature (slug) | Theme | Mô tả 1 dòng | Ưu tiên (P0/P1/P2) | Trạng thái | Chi tiết hóa`. Cột "Chi tiết hóa": `⛔ chưa` / `✅ đã chi tiết (N brainstorm)` / `📄 có SRS` — điền theo scan vault.
   - **Success Metrics** — KPI + định nghĩa + baseline/target (hoặc OQ).
   - **Constraints & Assumptions**.
   - **Risks** — Khả năng / Hậu quả / Cách giảm.
   - **Open Questions** — ID `OQ-N` (canonical cấp sản phẩm).

### Phase D — Quality gate + (optional) review

6. Self-check (fail → in gap):
   - [ ] Pitch súc tích; Problem có "ai chịu" + "why now".
   - [ ] Personas cụ thể (không "mọi người").
   - [ ] **Non-goals** tường minh (≥1).
   - [ ] Feature Map: mỗi feature có theme + ưu tiên; cột "Chi tiết hóa" khớp vault thực tế.
   - [ ] Success Metrics đo được (hoặc OQ).
   - [ ] Risks framing sản phẩm; Open questions có ID.
7. **Product-Reviewer gate (CHỈ khi vượt ngưỡng)** — Feature Map **≥8 feature** HOẶC **≥3 theme** → spawn `product-reviewer` (Task tool, lens PO+PM: value/scope-creep/prioritization/dependency). BLOCKING → sửa, loop ≤2 vòng. Dưới ngưỡng → self-check đủ. Task unavailable → report ghi `reviewer skipped`.

### Phase E — Approval + Write

8. **L1 plan preview** (prose BA-friendly):
   > Em sẽ {tạo mới | cập nhật} `docs/_product/prd.md`:
   > - Pitch + {N} persona + value proposition; {G} mục tiêu, {NG} non-goal.
   > - Feature Map: {F} feature / {T} theme ({P0} P0); {đã chi tiết X, chưa Y}.
   > - {K} success metric; {R} rủi ro; còn {Q} câu hỏi mở.
   >
   > Apply? (Y / sửa)
9. **Set env trước Write**: `CLAUDE_SKILL_NAME=/prd` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `PRD sản phẩm: {F} feature, {T} theme`). Write (L2 diff nếu update).

### Phase F — Resolve Open Questions (per `resolve-oqs.md`)

10. `/prd` là gốc cấp sản phẩm (không inherit). Collect own OQs → prompt Y/skip/ids → loop → **cascade scan trong chính prd.md** (Assumptions/Risks/Constraints/Feature Map — theo topic map). KHÔNG cascade sang `roadmap.md` (roadmap đọc 1 chiều Feature Map — muốn đồng bộ thì chạy lại `/roadmap`). L2 diff → activity log.

11. **Output report:**
    ```
    ✅ Product PRD: docs/_product/prd.md
       Feature Map: {F} feature ({P0} P0, đã chi tiết {X}/{F}) | Metrics: {K} | OQ: resolved {r}/{n}, hold {m}

    Recommended next:
      - /roadmap                    — ưu tiên Feature Map thành Now/Next/Later (RICE-lite)
      - /brainstorm <feature>       — chi tiết hóa 1 feature P0 trong Feature Map
      - /prd thêm feature <slug>     — bổ sung feature vào Feature Map (update mode)
    ```

## Gotchas

- **Nhầm với `/prd-epic`** — `/prd` = sản phẩm (`docs/_product/prd.md`); `/prd-epic` = 1 feature (`docs/{feature}/{feature}-prd.md`). User gõ `/prd payment` ý muốn PRD feature → hỏi rõ, route `/prd-epic payment`.
- **Feature Map lệch vault** — cột "Chi tiết hóa" phải khớp thực tế (scan `docs/*/`); brainstorm/SRS được thêm sau → chạy lại `/prd` (hoặc `/brainstorm` Phase E2 tự mark ngược).
- **Sa vào feature-detail** — PRD sản phẩm KHÔNG mô tả flow/validation 1 feature; chỉ capability + phạm vi. Chi tiết để `/prd-epic` + `/srs`.
- **Thiếu Non-goals** — PRD không có non-goals rất dễ scope creep; luôn ép ≥1.
- **Bịa metric** — KPI không nguồn → OQ + đánh dấu "cần chốt baseline/target".
- **Update mode viết đè** — Read full trước, chỉ sửa section liên quan, L2 diff.
- **@author** — memory `user-identity`; frontmatter KHÔNG có owner/feature (project-level).

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
- @../../../_templates/prd-product.md
- @./references/example-prd.md
- @../../agents/product-reviewer.md

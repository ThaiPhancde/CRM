---
name: prd-epic
description: Dùng khi cần viết PRD cấp FEATURE (epic) — capabilities P0/P1/P2, user flows chi tiết, goals & non-goals, release plan. Khác /prd (cấp sản phẩm). Kích hoạt bằng `/prd-epic <feature | mô tả>`. Kế thừa brainstorm + URD + BRD.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> | <mô tả nghiệp vụ mới>"
---

# /prd-epic — Feature PRD (Epic)

## Goal

Viết **PRD cấp feature (epic)** — chuyển yêu cầu (URD/BRD) thành **phạm vi sản phẩm**: **Capabilities** (`CAP-{feature}-NNN`, ưu tiên P0/P1/P2), **User Flows** (mức sản phẩm), **Goals & Non-goals**, **UX Requirements** (mức cao), **Release plan** (nếu chia phase). Output: `docs/{feature}/{feature}-prd.md` (type `prd`). Kế thừa brainstorm + URD + BRD.

PRD-epic trả lời "**feature này làm được gì (capability) + ưu tiên ra sao**" — cầu giữa yêu cầu và đặc tả SRS.

> Khác `/prd` (cấp **sản phẩm**, `docs/_product/prd.md`, type `prd-product`, Feature Map toàn sản phẩm). `/prd-epic` là **1 feature** (`docs/{feature}/{feature}-prd.md`). User gõ nhầm → hỏi rõ.

## Constraints

- **Nhóm A — điểm vào.** Feature mới → derive slug + phỏng vấn scope + tạo. Có brainstorm/URD/BRD → trích (no-re-ask).
- **L1 approval** trước Write. **L2 diff** khi update. **KHÔNG L3**.
- **Capabilities có ưu tiên** — mỗi `CAP-{feature}-NNN` gắn P0/P1/P2 (P0 = MVP). Bám objectives BRD + needs URD.
- **Non-goals tường minh** — điều feature KHÔNG làm (chống scope creep).
- **Mức sản phẩm, KHÔNG kỹ thuật** — capability là "khách hủy đơn và được hoàn tiền", KHÔNG "gọi API refund". FR chi tiết + Error Matrix là `/srs`. IT-BA framing.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**. Frontmatter `type: prd`.
- **resolve-oqs Phase E** — own + inherited (brainstorm + URD + BRD).

## Inputs

```
/prd-epic <feature>               # viết PRD feature (kế thừa URD/BRD)
/prd-epic <mô tả tính năng mới>   # feature chưa có → derive slug + phỏng vấn + tạo
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có URD/BRD: !`for d in docs/*/*-urd.md docs/*/*-brd.md; do [ -f "$d" ] && basename $(dirname "$d"); done | sort -u | tr '\n' ' '`
Feature có PRD: !`for d in docs/*/*-prd.md; do [ -f "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature.** Arg `payment` mà ý là PRD sản phẩm → gợi ý `/prd`. Feature mới → derive slug (nhóm A).
2. **Update mode?** PRD tồn tại → Read full (no-re-ask).
3. **Gather:** brainstorm (capabilities P0/P1/P2, flows) + URD (personas, needs) + BRD (objectives, scope, OOS) + `docs/_product/prd.md` Feature Map (align ưu tiên sản phẩm). Thiếu → phỏng vấn scope.

### Phase B — Interview (scope, phần thiếu)

4. Hỏi gom: **capabilities** (feature làm được gì) + **ưu tiên** (cái nào MVP P0) · **user flows** mức sản phẩm · **goals & non-goals** · **UX requirements** mức cao (không chi tiết màn). Số/ngưỡng chi tiết → để `/srs`; ở đây ghi capability + OQ nếu cần.

### Phase C — Compose + approval + write

5. **`{feature}-prd.md`** (theo `_templates/prd-epic.md`): Overview · Goals & Non-goals · Personas (tóm từ URD) · **Capabilities** (`CAP-*` + priority + mô tả) · User Flows (mức sản phẩm) · UX Requirements · Release plan (nếu có) · Dependencies · Open Questions.
6. **L1 plan preview** → **Write** (env note `PRD-epic: {N} capability, {P0} P0`).
7. **Phase D — resolve-oqs**: own + inherited (brainstorm + URD + BRD) → loop → cascade → L2 diff.
8. **Output report:**
   ```
   ✅ PRD (feature): docs/{feature}/{feature}-prd.md
      Capabilities: {N} ({P0} P0) | Non-goals: {NG} | OQ: {r}/{n}

   Recommended next:
     - /srs {feature}        — đặc tả kỹ thuật FR/NFR/BR/Error từ capabilities
     - /user-flow {feature}  — chia flow + màn để vẽ wireframe
   ```

## Gotchas

- **Nhầm `/prd` (sản phẩm) vs `/prd-epic` (feature)** — hỏi rõ nếu arg mơ hồ.
- **Capability = FR chi tiết** — capability là mức sản phẩm ("khách hủy đơn"); FR + Error Matrix chi tiết là `/srs`. Đừng nhồi số/error vào PRD.
- **Thiếu non-goals** — luôn ép ≥1.
- **Priority thiếu** — mỗi capability phải P0/P1/P2.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../../_templates/prd-epic.md
- @./references/example-prd-epic.md

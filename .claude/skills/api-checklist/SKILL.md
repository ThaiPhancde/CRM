---
name: api-checklist
description: Dùng khi cần dựng test outline cho tích hợp API — mỗi mục có cột test_layer (own/3rd/mixed) và direction (out/in), phủ happy + error + edge (retry/timeout/webhook trùng/reconciliation). Nguồn cho /api-test. Kích hoạt bằng `/api-checklist <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature>"
---

# /api-checklist — Test outline tích hợp

## Goal

Viết **test outline** tại `docs/{feature}/test/api/api-checklist.md`: mỗi mục kiểm (`ACHK-NNN`) có 2 cột phân tầng (`api-integration.md` Mục 2):
- **test_layer** — `own` (logic phía ta) · `3rd` (hành vi vendor) · `mixed` (end-to-end).
- **direction** — `out` (ta gọi họ) · `in` (webhook họ gọi ta).

Phủ **happy + error + edge**: mỗi operation happy; mỗi mã lỗi vendor (từ api-summary) + mỗi nhánh Error Matrix; edge tích hợp (retry, timeout, webhook nhận trùng/tới trễ, reconciliation, idempotency, degraded-UX/fallback). Là nguồn cho `/api-test`.

## Constraints

- **Nhóm B — cần blueprint + mapping** (`feature-bootstrap.md`): `integration/api-design.md` (+ `api-map.md`). Thiếu → refuse + route `/api-design`.
- **Mỗi mục có test_layer + direction** — bắt buộc (nguồn phân loại cho `/api-test`). Không để trống.
- **Phủ edge tích hợp** — KHÔNG chỉ happy path: retry/timeout, webhook trùng/tới trễ/sai chữ ký, reconciliation lệch, idempotency gọi lại, degraded-UX (fallback COD). Bám 7 trụ cột blueprint.
- **Bám nguồn — KHÔNG bịa** — mã lỗi từ api-summary; wording user từ Error Matrix; ngưỡng từ BR. Số chưa chốt → OQ.
- **ID `ACHK-NNN`** (scope trong file, không prefix feature — như CHK theo `naming-conventions.md`). Có `## Coverage` map về operation/FR/E.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **api-reviewer gate** khi lớn (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-checklist`.

## Inputs

```
/api-checklist food-delivery      # test outline từ api-design + api-map
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có api-design: !`for d in docs/*/integration/api-design.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
api-checklist đã có: !`ls docs/*/test/api/api-checklist.md 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather
1. **Resolve feature.** Thiếu api-design → refuse + route `/api-design`. Update mode? checklist tồn tại → Read full, giữ max `ACHK-NNN`.
2. **Gather:** orchestration + 7 trụ cột (api-design) · field/transform (api-map) · mã lỗi vendor (api-summary) · Error Matrix + BR (SRS).

### Phase B — Dựng outline
3. **Mỗi operation happy** (layer 3rd/mixed, direction out). **Mỗi mã lỗi vendor + nhánh Error Matrix** (negative). **Edge tích hợp** (retry/timeout/webhook trùng/reconcile/idempotency/degraded — layer own/mixed). Điền test_layer + direction mỗi mục.
4. **`## Coverage`** — map ACHK → operation/FR/E để không sót.

### Phase C — Quality gate
5. **Self-check:** mọi operation có happy; mọi mã lỗi + Error Matrix có negative; edge 7 trụ cột có mặt; mỗi mục đủ layer+direction; ID liên tục.
6. **api-reviewer gate (khi ≥15 mục HOẶC payment/auth)** — spawn Task (lens: coverage operation/error/edge đủ chưa, layer/direction đúng chưa, có bịa mã lỗi không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write
7. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `test/api/api-checklist.md`: {N} mục ({H} happy · {E} error · {G} edge), layer own/3rd/mixed × out/in, coverage {operation/FR/E}. Apply?
8. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-checklist` + author + note). Write.

### Phase E — Report
9. **Report:**
    ```
    ✅ API checklist: docs/{feature}/test/api/api-checklist.md
       {N} mục ({H}/{E}/{G}) · own {a} 3rd {b} mixed {c} · out {x} in {y} | Reviewed: {y/n}
    Tiếp: /api-test {feature} (sinh Bruno collection chạy được từ checklist)
    ```

## Gotchas

- **Chỉ happy path** — thiếu edge tích hợp (retry/webhook trùng/reconcile) là lỗ hổng nguy hiểm.
- **Trống test_layer/direction** — `/api-test` cần để phân loại; bắt buộc điền.
- **Bịa mã lỗi vendor** — lấy từ api-summary; thiếu → OQ.
- **Quên chiều in (webhook)** — webhook cần test nhận trùng/tới trễ/sai chữ ký.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/api-integration.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../rules/agent-conventions.md
- @../../rules/kg-usage.md
- @../../../_templates/api-checklist.md
- @./references/example-api-checklist.md
- @../../agents/api-reviewer.md

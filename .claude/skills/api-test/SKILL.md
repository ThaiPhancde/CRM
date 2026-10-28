---
name: api-test
description: Dùng khi cần sinh bộ test API chạy được (Bruno) từ api-checklist — soạn plan.json + vars.json rồi chạy engine sinh collection .bru deterministic; mục chưa map đủ URL/giá trị thật → .bru.todo (không false-pass). Kích hoạt bằng `/api-test <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature>"
---

# /api-test — Sinh Bruno collection từ checklist

## Goal

Sinh **bộ test API Bruno chạy được** tại `docs/{feature}/test/api/bruno/` + index `docs/{feature}/test/api/api-tests.md`:
- BA soạn **plan.json** (mỗi request: name/method/url-template/headers/body/assert + layer/direction/source) + **vars.json** (biến môi trường, secret dùng `{{process.env.*}}` — KHÔNG giá trị thật).
- Chạy **engine** `.claude/scripts/api-test-gen.mjs` → sinh `bruno.json` + `environments/*.bru` + `*.bru` (deterministic).
- Request **chưa map đủ** (thiếu URL thật/giá trị/assert) → `*.bru.todo` (Bruno KHÔNG chạy → **không false-pass**), như `test.fixme()`.

## Constraints

- **Nhóm B — cần checklist** (`feature-bootstrap.md`): `test/api/api-checklist.md`. Thiếu → refuse + route `/api-checklist`.
- **Engine sinh, KHÔNG viết .bru tay** (`api-integration.md` Mục 5): BA/skill viết `plan.json` + `vars.json`; engine sinh `.bru`. `.bru` là output máy — KHÔNG sửa tay (chạy lại engine đè).
- **KHÔNG false-pass** — request thiếu URL thật/assert → engine đánh `.bru.todo`. KHÔNG tự bịa URL/giá trị để test "xanh". Chưa có sandbox → phần lớn là `todo` (trung thực).
- **KHÔNG hardcode secret** (`api-integration.md` Mục 6) — `vars.json` dùng placeholder `{{process.env.KEY}}`; giá trị thật ở env lúc chạy Bruno. KHÔNG commit key.
- **Assert bám nghiệp vụ** — status + field cốt lõi + trạng thái (từ state-map/api-map). Mỗi request giữ `layer`/`direction`/`source` (trace về checklist).
- **L1 TRƯỚC Write** (`approval-gate.md`) cho plan.json/vars.json/index. Engine chạy sau khi user Y.
- **Doc sạch** cho index (`ba-conventions.md`). **Vietnamese-first**. Index frontmatter `type: api-tests`.

## Inputs

```
/api-test food-delivery          # sinh plan + vars + chạy engine → bruno/
/api-test food-delivery          # chạy lại → cập nhật plan rồi regen (idempotent)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có api-checklist: !`for d in docs/*/test/api/api-checklist.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`
Engine sẵn sàng: !`[ -f .claude/scripts/api-test-gen.mjs ] && echo yes || echo "THIẾU engine"`
Node: !`command -v node >/dev/null 2>&1 && node -v || echo "THIẾU node"`

## Approach

### Phase A — Resolve + gather
1. **Resolve feature.** Thiếu checklist → refuse + route `/api-checklist`. Kiểm engine + node có sẵn.
2. **Gather:** mục checklist (layer/direction) · field/transform (api-map) · operation method/path (api-summary) · assert từ state-map + Error Matrix.

### Phase B — Soạn plan.json + vars.json
3. **Mỗi mục checklist testable → 1 request trong plan.json**: name/method/url-template (từ api-summary)/headers/body (từ api-map)/asserts (status + field/trạng thái) + layer/direction/source (ACHK-NNN).
4. **Mục chưa có URL/giá trị thật** (chưa có sandbox, thiếu doc) → để url rỗng + `todo_reason` → engine sẽ đánh `.bru.todo`. KHÔNG bịa để xanh giả.
5. **vars.json**: baseUrl sandbox, ourBaseUrl, secret `{{process.env.*}}`, biến động rỗng.

### Phase C — Approval + generate
6. **L1 plan preview** (prose BA):
   > Em sẽ tạo `test/api/bruno/plan.json` + `vars.json` ({N} request: {R} có URL thật → chạy được, {T} chờ sandbox → .bru.todo) rồi chạy engine sinh collection Bruno. Secret dùng biến môi trường. Apply?
7. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-test` + author + note vd `APIGEN: {N} request, {T} todo`). Write plan.json + vars.json.
8. **Chạy engine:** `node .claude/scripts/api-test-gen.mjs --dir docs/{feature}/test/api`. Đọc dòng `APIGEN-OK: requests=N bru=R todo=T`. Lỗi `APIGEN-ERROR` → sửa plan, chạy lại.
9. **Viết `api-tests.md`** (index): bảng request (name/layer/direction/trạng thái chạy-được|todo/source ACHK) + cách chạy Bruno + note secret qua env.

### Phase D — Report
10. **Report:**
    ```
    ✅ API tests: docs/{feature}/test/api/ (Bruno)
       plan {N} request → chạy được {R} · .bru.todo {T} (chờ sandbox/doc)
       Chạy: bruno CLI/app, chọn environment sandbox, set env {SECRET}
    ⚠️ {T} request chưa chạy được (todo) — cần URL sandbox/giá trị thật, KHÔNG bịa để xanh.
    Tiếp: /api-readiness {feature} (go-live gate)
    ```

## Gotchas

- **Viết .bru tay** — sai; sửa `plan.json` rồi regen (engine là nguồn `.bru`).
- **Bịa URL/giá trị để test xanh** — CẤM; thiếu thật → `.bru.todo`.
- **Hardcode API key** — CẤM; `{{process.env.KEY}}`.
- **Assert chỉ `status 200`** — thêm field/trạng thái nghiệp vụ (bám api-map/state-map).
- **Quên regen sau sửa plan** — chạy lại engine.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/api-integration.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/api-tests.md
- @./references/example-api-test.md

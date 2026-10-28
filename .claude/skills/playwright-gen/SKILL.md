---
name: playwright-gen
description: Dùng khi cần sinh bộ E2E Playwright (TypeScript) từ test case đã có — skill dựng plan JSON + selector map rồi engine codegen ra .spec.ts (deterministic). Cần có test case (từ /test-cases). Kích hoạt bằng `/playwright-gen <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> [--base-url <url>]"
---

# /playwright-gen — Codegen Playwright E2E từ Test Cases

## Goal

Sinh bộ **E2E test Playwright (TypeScript)** từ test case (`TC-*`) của 1 feature. Skill **KHÔNG tự viết `.spec.ts`** — mà dựng **plan trung gian** (`{feature}-e2e.plan.json`) + **selector map** (`selectors.json`), rồi gọi **engine chung** `.claude/scripts/playwright-gen.mjs` codegen deterministic. Output trong `docs/{feature}/test/e2e/`:
- `{feature}-e2e.plan.json` — kế hoạch (spec → scenario → step), do skill sinh từ test case.
- `selectors.json` — map `{ "selector-key": "css/[data-testid]/text=" }` (dev điền; skill seed key + TODO).
- `specs/{scope}.spec.ts` — spec Playwright **auto-gen, KHÔNG sửa tay** (engine sinh).
- `{feature}-e2e-index.md` · `playwright.config.ts` · `.env.example` — engine sinh (config/env chỉ tạo nếu chưa có).

> Tách vai: **skill** (LLM) hiểu test case → dựng plan; **engine** (Node thuần) biến plan → TS deterministic. Giống pattern `/bpmn` (IR → engine render). Nhờ vậy `.spec.ts` luôn tái sinh được, không drift.

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc `test/testcases/{feature}-testcase-index.md` (từ `/test-cases`). Thiếu → **refuse + route `/test-cases`** (`feature-bootstrap.md` nhóm B).
- **KHÔNG sửa tay `.spec.ts`.** Sửa test case → chạy lại `/playwright-gen` (engine regen). Selector thay đổi → sửa `selectors.json` rồi chạy lại. Header mỗi spec ghi rõ "AUTO-GENERATED".
- **L1 approval** trước khi Write plan/selectors + chạy engine. **L2 diff** cho plan/selectors nếu đã tồn tại (giữ selector dev đã điền — no-re-ask).
- **BA không bịa selector.** Test case (IT-BA) mô tả hành vi nghiệp vụ, KHÔNG có selector. Skill map mỗi phần tử UI thành **selector-key** (đặt tên nghiệp vụ, vd `place-order-btn`) và **để `selectors.json` cho dev điền** selector thật. Key chưa có selector → engine tự `test.fixme()` (không giả-pass) — đây là hành vi đúng, KHÔNG cố đoán selector.
- **Plan bám test case** — mỗi `TC-*` → 1 scenario (giữ id + type/priority thành tag `@TC-... @P0 @happy`, giữ trace `@AC-*`/`@E-*`). Steps map từ Steps + Expected của test case sang **action vocabulary** (dưới). KHÔNG thêm scenario ngoài test case.
- **Engine là nguồn sinh duy nhất** — skill KHÔNG tự viết `.spec.ts`/`config`. Chạy: `node .claude/scripts/playwright-gen.mjs --dir docs/{feature}/test/e2e`.
- **Doc/report Vietnamese-first.** Frontmatter index do engine sinh (`type: e2e-index`).

## Action vocabulary (map Steps/Expected → engine)

| action | target | value | Sinh ra |
|---|---|---|---|
| `goto` | URL/path | — | `page.goto(target)` |
| `click` | selector-key | — | `locator.click()` |
| `fill` | selector-key | text | `locator.fill(value)` |
| `check`/`uncheck` | selector-key | — | `locator.check()/.uncheck()` |
| `select` | selector-key | option | `locator.selectOption(value)` |
| `press` | selector-key (optional) | phím | `locator.press(value)` / `page.keyboard.press(value)` |
| `expectText` | selector-key | text | `expect(locator).toContainText(value)` |
| `expectVisible`/`expectHidden` | selector-key | — | `toBeVisible()/toBeHidden()` |
| `expectDisabled`/`expectEnabled` | selector-key | — | `toBeDisabled()/toBeEnabled()` |
| `expectURL` | — | url/pattern | `expect(page).toHaveURL(value)` |
| `note` | — | text | `// comment` (dùng cho Given/precondition/mock) |

> `goto` target là URL/path; các action còn lại `target` là **selector-key** (tra `selectors.json`). `expectText` value lấy **wording exact** từ Expected/Error Matrix.

## Inputs

```
/playwright-gen <feature>                     # dựng plan + selectors + codegen
/playwright-gen <feature> --base-url http://localhost:5173
/playwright-gen                               # list feature có test case → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có test case: !`for d in docs/*/test/testcases/*-testcase-index.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`
Engine có sẵn? !`[ -f .claude/scripts/playwright-gen.mjs ] && echo "yes" || echo "THIẾU — copy .claude/scripts/playwright-gen.mjs"`

## Approach

### Phase A — Readiness + resolve (silent)

1. **Resolve feature** từ arg/list. Kiểm engine `.claude/scripts/playwright-gen.mjs` tồn tại (thiếu → báo copy từ gói).
2. **Readiness gate (nhóm B).** Không có testcase-index → refuse:
   ```
   Chưa thể chạy /playwright-gen cho `{feature}` — thiếu test/testcases/{feature}-testcase-index.md.
   → Chạy /test-cases {feature} trước, rồi quay lại /playwright-gen.
   ```
3. **Update mode?** `test/e2e/` đã có plan/selectors → Read: giữ selector dev đã điền (no-re-ask), chỉ cập nhật scenario theo test case mới.

### Phase B — Build plan từ test case

4. Read `test/testcases/{feature}-testcase-index.md` (+ TC chi tiết). Với mỗi TC:
   - 1 **scenario** trong plan, `id = TC-NNN`, `tags = [@TC-NNN, @{type}, @{priority}, @{AC/E maps-to}]`.
   - **Steps → action list**: precondition/Given → `note`; mỗi step thao tác → `goto/click/fill/...`; Expected → `expectText/expectVisible/expectDisabled/...` với wording exact.
   - **Nhóm scenario theo khu vực/màn** → mỗi nhóm 1 `spec` (`scope` = area slug, vd `ordering`, `payment`).
5. **Thu selector-key**: mỗi phần tử UI được thao tác → 1 key nghiệp vụ (`place-order-btn`, `toast-error`). Gom thành `selectors.json` — key đã biết selector (nếu dev từng điền) giữ nguyên; key mới → để giá trị rỗng/`""` (engine coi là chưa map → fixme).

### Phase C — Approval + Write plan/selectors

6. **L1 plan preview**:
   > Em sẽ sinh E2E Playwright cho `{feature}`:
   > - {S} spec ({scope list}), {N} scenario từ {N} test case.
   > - {K} selector-key → `selectors.json` ({đã map M}/{K}, còn {U} để dev điền → tạm `test.fixme`).
   > - Rồi chạy engine codegen `.spec.ts`.
   >
   > Apply? (Y / sửa)
7. **Set env trước Write**: `CLAUDE_SKILL_NAME=/playwright-gen` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `E2E plan {N} scenario, {S} spec`). Write `{feature}-e2e.plan.json` + `selectors.json` (L2 diff nếu đã có — giữ selector dev điền).

### Phase D — Codegen (engine)

8. **Chạy engine:** `node .claude/scripts/playwright-gen.mjs --dir docs/{feature}/test/e2e` (thêm `--base-url` nếu user cấp). Engine sinh `specs/*.spec.ts` + `{feature}-e2e-index.md` + `playwright.config.ts` + `.env.example` (config/env chỉ nếu chưa có), in `PWGEN-OK: ... fixme={U}`.
   - **PWGEN-ERROR** (plan/selectors JSON lỗi) → đọc lỗi, sửa plan/selectors, chạy lại. Tối đa 2 lần.
9. **Output report:**
   ```
   ✅ E2E Playwright: docs/{feature}/test/e2e/ → {S} spec, {N} scenario
      Selector đã map: {M}/{K} | Còn test.fixme (chưa map): {U}
      Index: {feature}-e2e-index.md

   Cách chạy:
     cd docs/{feature}/test/e2e && npm i -D @playwright/test && npx playwright install
     cp .env.example .env   # điền BASE_URL
     npx playwright test

   Còn {U} selector chưa map → điền selectors.json rồi chạy lại /playwright-gen.
   Recommended next:
     - Dev điền selectors.json (selector thật của UI) → chạy lại để bỏ test.fixme.
   ```

## Gotchas

- **Không tự đoán selector** — BA doc không có selector; skill để `selectors.json` cho dev, key chưa map → engine `test.fixme()` (không giả-pass). Đây là thiết kế đúng, đừng bịa `#submit`.
- **Sửa tay `.spec.ts`** — mất khi regen. Sửa test case (rồi `/playwright-gen`) hoặc `selectors.json`, KHÔNG sửa spec.
- **Wording expect sai** — `expectText` phải lấy wording exact từ Expected/Error Matrix của test case, không tự diễn đạt lại.
- **Engine thiếu** — nếu workspace chưa copy `.claude/scripts/playwright-gen.mjs` → codegen fail; báo user copy từ gói.
- **Nhóm scope hợp lý** — quá nhiều scenario 1 spec → khó đọc; nhóm theo màn/khu vực (ordering/payment/delivery…).
- **Regen giữ selector** — update mode: đọc `selectors.json` cũ, giữ selector dev đã điền, chỉ thêm key mới.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/changelog.md
- @../../rules/status-lifecycle.md
- @../../scripts/playwright-gen.mjs (engine codegen — bước Phase D)
- @./references/example-plan.json
- @./references/example-spec.md

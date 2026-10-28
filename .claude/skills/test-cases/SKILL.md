---
name: test-cases
description: Dùng khi cần chi tiết hóa checklist kiểm thử thành test case chạy được — precondition, các bước, dữ liệu test, kết quả mong đợi, kèm truy vết CHK/AC/E. Cần có checklist (từ /test-checklist). Kích hoạt bằng `/test-cases <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> [--area <khu vực>]"
---

# /test-cases — Detailed Test Cases

## Goal

Chi tiết hóa mỗi mục checklist (`CHK-*`) thành **test case chạy được** (`TC-{NNN}`): **Precondition** · **Steps** (đánh số) · **Test data** · **Expected result** · **Type** (positive/negative/boundary) · **Priority** · **Maps-to** (CHK/AC/FR/E). Output: `docs/{feature}/test/testcases/{feature}-testcase-index.md`. Đọc `test/test-strategy.md` (dữ liệu/môi trường/thiết bị) — no-re-ask.

Test case là **kịch bản thực thi** cho QA làm tay (và là nguồn cho `/playwright-gen` sinh E2E). Mỗi bước rõ ràng, kết quả mong đợi **đo được** (trạng thái/wording/số liệu thật).

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc `test/checklist/{feature}-checklist-index.md` (từ `/test-checklist`). Thiếu → **refuse + route `/test-checklist`** (`feature-bootstrap.md` nhóm B).
- **L1 approval** trước Write. **L2 diff** khi testcase-index đã tồn tại.
- **Mỗi CHK → ≥1 TC** (coverage checklist→testcase). CHK phức tạp → nhiều TC (variant data). TC không thuộc CHK nào → note nguồn hoặc bỏ.
- **Steps thực thi được** — mỗi step 1 hành động cụ thể; Expected result **đo được** (không "hoạt động đúng"). Test data cụ thể (tài khoản/nhà hàng/số tiền mẫu — lấy từ test-strategy).
- **Phủ đúng loại theo CHK** — positive/negative/boundary giữ nguyên phân loại nghĩa vụ từ checklist; mỗi `E-*` → TC negative với wording lỗi exact.
- **TC-ID** `TC-{NNN}` 3-digit, đọc index lấy max+1; không reuse.
- **Maps-to đầy đủ** — mỗi TC trỏ CHK + AC/FR/E nguồn (full-form ID) để `/gap` truy vết.
- **IT-BA framing** — kịch bản theo hành vi nghiệp vụ quan sát được, KHÔNG assert kỹ thuật (không "API 200"/"row inserted"). Số liệu/wording từ nguồn, thiếu → OQ.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**.

## Inputs

```
/test-cases <feature>              # chi tiết hóa mọi CHK chưa có TC
/test-cases <feature> --area payment   # chỉ 1 khu vực
/test-cases                        # list feature có checklist → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có checklist: !`for d in docs/*/test/checklist/*-checklist-index.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`
Feature có testcase: !`for d in docs/*/test/testcases/*-testcase-index.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`

## Approach

### Phase A — Readiness + resolve (silent)

1. **Resolve feature** từ arg/list.
2. **Readiness gate (nhóm B).** Không có checklist-index → refuse:
   ```
   Chưa thể chạy /test-cases cho `{feature}` — thiếu test/checklist/{feature}-checklist-index.md.
   → Chạy /test-checklist {feature} trước, rồi quay lại /test-cases.
   ```
3. **Update mode?** testcase-index tồn tại → Read full (no-re-ask): TC đã có, next TC-ID, CHK nào đã có TC.

### Phase B — Gather

4. Read `checklist-index.md` (CHK + bảng Coverage), `test/test-strategy.md` (data/env/device — no-re-ask), `userstories/us-*.md` (AC → step/expected), `srs/{feature}-spec.md` (Error Matrix wording, BR ngưỡng), `usecases/` (Main Success Scenario → steps happy). KHÔNG hỏi lại cái đã đọc.

### Phase C — Compose

5. **Sinh TC** cho mỗi CHK (≥1). Mỗi TC (theo `_templates/testcase-index.md`):
   ```markdown
   ### TC-{NNN}: {tiêu đề}
   - **Type**: positive | negative | boundary   **Priority**: P0/P1/P2
   - **Maps-to**: CHK-{NNN}, AC-{NNN}, FR-{feature}-NNN / E-{feature}-NNN
   - **Precondition**: {trạng thái trước khi chạy — trích test data}
   - **Test data**: {tài khoản/nhà hàng/số tiền mẫu}
   - **Steps**:
     1. {hành động}
     2. {hành động}
   - **Expected**: {kết quả đo được — trạng thái/wording exact/số liệu}
   ```
6. **Index metadata** — bảng tổng: `TC-ID | Tiêu đề | Type | Priority | Maps-to | Status`. Frontmatter `type: test-cases-index`.

### Phase D — Quality gate + (optional) review

7. Self-check (fail → sửa):
   - [ ] Mỗi CHK có ≥1 TC (coverage checklist→testcase).
   - [ ] Mỗi `E-*` có TC negative với wording lỗi exact.
   - [ ] Mỗi BR có TC biên (đúng ngưỡng).
   - [ ] Expected result **đo được**; steps thực thi được; test data cụ thể.
   - [ ] Maps-to đầy đủ (CHK + AC/FR/E full-form).
8. **Test-Reviewer gate (CHỈ khi vượt ngưỡng)** — **≥25 TC** HOẶC feature **≥5 error code** → spawn `test-reviewer` (lens QA: coverage CHK→TC, negative/boundary bỏ sót, expected đo được). BLOCKING → sửa, loop ≤2. Dưới ngưỡng → self-check đủ.

### Phase E — Approval + Write

9. **L1 plan preview**:
   > Em sẽ {tạo mới | cập nhật} test case cho `{feature}`:
   > - {N} TC (TC-{a}…TC-{b}) từ {CHK count} CHK: positive {p} / negative {n} / boundary {b}.
   > - Coverage: {C}/{CHK} CHK đã có TC.
   >
   > Apply? (Y / sửa)
10. **Set env trước Write**: `CLAUDE_SKILL_NAME=/test-cases` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `{N} test case từ {CHK} CHK`). Write testcase-index (L2 diff nếu update).

### Phase F — Resolve Open Questions + report

11. Collect OQs (own + inherited từ checklist/AC/spec) → loop → cascade → L2 diff → activity log.
12. **Output report:**
    ```
    ✅ Test cases: docs/{feature}/test/testcases/{feature}-testcase-index.md → {N} TC
       Coverage: {C}/{CHK} CHK | positive {p} / negative {n} / boundary {b} | Reviewed: {yes/no}

    Recommended next:
      - /playwright-gen {feature}   — sinh E2E Playwright từ test case (codegen)
      - /jira {feature}             — đẩy test case lên Jira/Xray nếu dùng
    ```

## Gotchas

- **Expected mơ hồ** — "kết quả đúng" không kiểm được. Ép: trạng thái cụ thể ("đơn = Chờ nhà hàng xác nhận"), wording exact (từ Error Matrix), số liệu.
- **Thiếu test data** — precondition không có dữ liệu cụ thể thì QA không chạy được; lấy từ test-strategy, thiếu → OQ.
- **Bỏ sót negative/boundary** — chỉ viết positive là thiếu; bám phân loại từ checklist.
- **Nhầm cấp với checklist** — TC có step/data/expected chi tiết; CHK chỉ 1 dòng. Đừng viết TC nông như checklist.
- **assert kỹ thuật** — không "API trả 200"; viết hành vi nghiệp vụ quan sát được (để `/playwright-gen` map sang selector sau).
- **Reuse TC-ID** — CẤM; đọc index lấy max+1.
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
- @../../../_templates/testcase-index.md
- @./references/example-testcase.md
- @../../agents/test-reviewer.md

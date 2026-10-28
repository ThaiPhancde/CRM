---
name: test-checklist
description: Dùng khi cần dựng checklist kiểm thử từ Acceptance Criteria (+ FR/BR/Error) — mỗi nghĩa vụ (AC/FR/E) phủ ≥1 mục checklist, kèm bảng Coverage truy vết. Cần có AC (us-*.md) hoặc SRS làm nguồn. Kích hoạt bằng `/test-checklist <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug>"
---

# /test-checklist — Test Checklist + Coverage

## Goal

Dựng **checklist kiểm thử** cho 1 feature từ **Acceptance Criteria** (+ FR/BR/Error trong SRS): mỗi **nghĩa vụ** (mỗi AC, mỗi FR, mỗi error `E-*`, mỗi business rule) được phủ bởi **≥1 mục checklist** (`CHK-{NNN}`). Output: `docs/{feature}/test/checklist/{feature}-checklist-index.md` — gồm `## Checklist` (mục kiểm, nhóm theo màn/khu vực), `## Coverage` (bảng truy vết nghĩa vụ→CHK, cạnh VERIFIES), `## Retired CHK-IDs`, frontmatter `next_chk_id`.

Lần chạy đầu, skill cũng **khởi tạo `docs/{feature}/test/test-strategy.md`** (intake gọn: môi trường / dữ liệu / thiết bị / ngôn ngữ + mục đích đợt test) — file này dùng CHUNG cho `/test-cases` (no-re-ask).

## Constraints

- **Nhóm B — cần nguồn thật.** Ưu tiên **AC** trong `userstories/us-*.md` (từ `/ac`); nếu chưa có AC nhưng có `srs/{feature}-spec.md` (FR/BR/E) → vẫn dựng được (nghĩa vụ = FR/E/BR) + cảnh báo "nên chạy `/ac` để checklist bám AC sát hơn". **Không có cả AC lẫn SRS → refuse + route** (`feature-bootstrap.md` nhóm B).
- **L1 approval** trước Write. **L2 diff** khi checklist-index / test-strategy đã tồn tại (update mode tự động).
- **Coverage bắt buộc** — mọi nghĩa vụ (AC/FR/E/BR liên quan) phải có ≥1 CHK trong bảng Coverage. Nghĩa vụ mồ côi (0 CHK) → tạo CHK hoặc note lý do (vd NFR đo bằng công cụ riêng).
- **Phủ 3 loại mỗi nghĩa vụ áp dụng** — positive (điều kiện đúng), negative (mỗi `E-*`), boundary/rule (mỗi BR + biên số liệu). Checklist không chỉ liệt kê happy path.
- **CHK-ID ổn định** — `CHK-{NNN}` 3-digit, cấp từ `next_chk_id` (frontmatter). Xóa mục → chuyển ID sang `## Retired CHK-IDs`, KHÔNG reuse (giữ trace lịch sử).
- **Checklist ≠ test case.** Mục checklist là **điều-cần-kiểm** ngắn gọn (1 dòng: "kiểm X khi Y → mong đợi Z"), KHÔNG có step chi tiết/test data (đó là `/test-cases`).
- **IT-BA framing** — mô tả kiểm bằng hành vi nghiệp vụ quan sát được, trích số liệu/wording THẬT từ AC/Error Matrix, KHÔNG bịa. Số liệu chưa có → OQ.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**.

## Inputs

```
/test-checklist <feature>          # dựng/cập nhật checklist từ AC (+ SRS)
/test-checklist                    # list feature có AC/SRS → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có AC (story): !`for d in docs/*/userstories/us-*.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | sort -u | tr '\n' ' '`
Feature có checklist: !`for d in docs/*/test/checklist/*-checklist-index.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`

## Approach

### Phase A — Readiness + resolve (silent)

1. **Resolve feature** từ arg/list.
2. **Readiness gate (nhóm B).** Không có `userstories/us-*.md` (AC) VÀ không có `srs/{feature}-spec.md` → refuse:
   ```
   Chưa thể chạy /test-checklist cho `{feature}` — thiếu nguồn (AC hoặc SRS).
   → Chạy /ac {feature} (hoặc /srs {feature}) trước, rồi quay lại /test-checklist.
   ```
3. **Update mode?** checklist-index tồn tại → Read full (no-re-ask, lấy `next_chk_id`, CHK đã có, giữ mục user chỉnh tay).

### Phase B — Test strategy intake (chỉ lần đầu / khi thiếu)

4. `test/test-strategy.md` chưa có → hỏi gọn 1 batch (durable): **môi trường** test (staging/prod-like), **dữ liệu** test (tài khoản mẫu, nhà hàng mẫu), **thiết bị/trình duyệt**, **ngôn ngữ**; + **mục đích đợt** (smoke/regression/feature). Có rồi → Read, KHÔNG hỏi lại. Thiếu ý → OQ, không chặn.

### Phase C — Gather nghĩa vụ + compose

5. Read nguồn: `userstories/us-*.md` (AC) → mỗi AC là 1 nghĩa vụ; `srs/{feature}-spec.md` (FR/BR/Error Matrix) → bổ sung nghĩa vụ FR/E/BR chưa nằm trong AC. Read `usecases/` nếu có (nhánh Extension → negative). KHÔNG hỏi lại cái đã đọc.
   > *Tăng tốc tùy chọn:* `kg coverage {feature}` cho biết FR/E nào chưa được test đụng tới. Thiếu KG → đọc trực tiếp (`kg-usage.md`).
6. **Sinh CHK** cho mỗi nghĩa vụ, nhóm theo màn/khu vực. Mỗi CHK 1 dòng: điều kiện + hành động + mong đợi (trích số liệu/wording thật). Phủ positive/negative/boundary.
7. **Compose `{feature}-checklist-index.md`** (theo `_templates/checklist-index.md`):
   - frontmatter `type: test-checklist-index`, `feature`, `status`, `updated`, `next_chk_id`, `links`.
   - `## Checklist` — nhóm `### {Khu vực/Màn}` → list `- [ ] CHK-{NNN}: {điều cần kiểm}`.
   - `## Coverage` — bảng `Nghĩa vụ (AC/FR/E/BR) | CHK phủ | Loại`. Mọi nghĩa vụ có ≥1 CHK.
   - `## Retired CHK-IDs` — (nếu có) ID đã bỏ + lý do.

### Phase D — Quality gate + (optional) review

8. Self-check (fail → in gap):
   - [ ] Mọi AC có ≥1 CHK; mọi `E-*` liên quan có ≥1 CHK **negative**; mọi BR có CHK biên.
   - [ ] CHK dùng số liệu/wording thật (không "kiểm hoạt động đúng").
   - [ ] Bảng Coverage không nghĩa vụ mồ côi (hoặc note lý do).
   - [ ] CHK-ID liên tục, `next_chk_id` cập nhật.
9. **Test-Reviewer gate (CHỈ khi vượt ngưỡng)** — **≥20 CHK** HOẶC feature có **≥5 error code** → spawn `test-reviewer` (Task tool, lens QA: coverage đủ chưa, negative/boundary có bị bỏ, CHK có testable). BLOCKING → sửa, loop ≤2. Dưới ngưỡng → self-check đủ. Task unavailable → report ghi `reviewer skipped`.

### Phase E — Approval + Write

10. **L1 plan preview** (prose BA-friendly):
    > Em sẽ {tạo mới | cập nhật} checklist cho `{feature}`:
    > - {N} mục kiểm (CHK) nhóm theo {K} khu vực; phủ {A} AC / {E} error / {B} rule.
    > - Coverage: {C}/{tổng} nghĩa vụ có mục kiểm{; mồ côi: …}.
    > - {lần đầu: + khởi tạo test-strategy}. Còn {Q} câu hỏi mở.
    >
    > Apply? (Y / sửa)
11. **Set env trước Write**: `CLAUDE_SKILL_NAME=/test-checklist` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `{N} CHK phủ {C} nghĩa vụ`). Write test-strategy (nếu mới) + checklist-index (L2 diff nếu update).

### Phase F — Resolve Open Questions (per `resolve-oqs.md`)

12. Collect own OQs (số liệu thiếu) + inherited từ AC/spec. Loop resolve → cascade scan checklist/coverage → L2 diff → activity log.

13. **Output report:**
    ```
    ✅ Checklist: docs/{feature}/test/checklist/{feature}-checklist-index.md → {N} CHK
       Coverage: {C}/{tổng} nghĩa vụ (AC {a} / FR {f} / E {e} / BR {b}) | Reviewed: {yes/no}

    Recommended next:
      - /test-cases {feature}   — chi tiết hóa CHK thành test case (step + data + expected)
    ```

## Gotchas

- **Checklist quá "happy"** — chỉ liệt kê đường thuận là thiếu 1 nửa. Mỗi error code phải có CHK negative.
- **CHK mơ hồ** — "kiểm đặt đơn OK" vô nghĩa. Viết "kiểm đặt đơn với tổng ≥30.000đ → đơn tạo trạng thái Chờ nhà hàng xác nhận" (trích số/wording thật).
- **Nhầm với test case** — CHK là điều-cần-kiểm 1 dòng; step/data/expected chi tiết là `/test-cases`. Đừng nhồi step vào checklist.
- **Nghĩa vụ mồ côi** — AC/error không có CHK là lỗ hổng test; hoặc phủ hoặc note lý do rõ ràng.
- **Reuse CHK-ID** — CẤM; ID bỏ chuyển sang Retired, ID mới lấy từ `next_chk_id`.
- **Thiếu số liệu** — nguồn (AC/spec) chưa có ngưỡng → OQ, KHÔNG bịa.
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
- @../../../_templates/test-strategy.md
- @../../../_templates/checklist-index.md
- @./references/example-checklist.md
- @../../agents/test-reviewer.md

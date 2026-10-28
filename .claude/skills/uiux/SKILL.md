---
name: uiux
description: Dùng khi cần review chất lượng UI/UX các màn hình của 1 feature — đủ trạng thái (loading/empty/error/success), flow không cụt, nhất quán, validation UX, a11y cơ bản. Đọc wireframe + userflow + AC. Kích hoạt bằng `/uiux <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
user-invocable: true
argument-hint: "<feature-slug> [--flow <flow-slug>]"
---

# /uiux — UI/UX Quality Review

## Goal

Review **chất lượng UI/UX** các màn hình của 1 feature, đối chiếu wireframe/screen (`ascii-wireframe/`, `html-wireframe/`) + `srs/{feature}-userflow.md` + AC (từ story) + Error Matrix. Bắt các lỗ hổng trải nghiệm:
- **Thiếu trạng thái** — mỗi màn có đủ default / loading / empty / error / success khi áp dụng?
- **Flow cụt / màn mồ côi** — mọi màn có lối vào + lối ra; không dead-end; mọi nhánh (thành công/lỗi) có màn tương ứng?
- **Nhất quán** — đặt tên nút/label, vị trí hành động chính, pattern lặp lại có đồng nhất giữa các màn?
- **Validation UX** — field bắt buộc/định dạng có phản hồi rõ; nút submit disable đúng lúc; wording lỗi khớp Error Matrix?
- **A11y cơ bản** — label cho input, thứ tự focus, không chỉ dựa màu để truyền lỗi, target đủ lớn (mức nghiệp vụ, không audit sâu kỹ thuật).

Output: `docs/{feature}/{feature}-uiux-review.md` — findings theo severity + checklist trạng thái per màn. **Review, không thiết kế lại** — đề xuất sửa, không tự vẽ wireframe (đó là `/wireframe-*`).

## Constraints

- **Cần nguồn màn hình.** Bắt buộc có wireframe (`ascii-wireframe/` HOẶC `html-wireframe/`) HOẶC `srs/{feature}-userflow.md`. Thiếu hết → **refuse + route `/user-flow` + `/wireframe-ascii`/`/wireframe-html`** (`feature-bootstrap.md` nhóm B).
- **L1 approval** trước khi ghi review. **L2 diff** nếu review đã tồn tại.
- **Findings theo severity** (`review-format.md`): BLOCKING (flow cụt / thiếu màn error của nhánh có thật / không có màn empty cho list chính), WARNING (thiếu loading/nhất quán/validation UX), SUGGESTION (a11y nhẹ, tinh chỉnh).
- **Bám nguồn, KHÔNG bịa yêu cầu.** Trạng thái/nhánh phải suy từ userflow + AC + Error Matrix thật; không "đáng lẽ nên có" nếu nghiệp vụ không đòi. Wording lỗi phải khớp Error Matrix (lệch → flag).
- **Không tự vẽ lại** — đề xuất "thêm màn empty cho danh sách đơn" chứ không sinh wireframe; route `/wireframe-*` để làm.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**.

## Inputs

```
/uiux <feature>                 # review toàn bộ màn của feature
/uiux <feature> --flow checkout # chỉ 1 flow
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có wireframe: !`for d in docs/*/ascii-wireframe docs/*/html-wireframe; do [ -d "$d" ] && basename $(dirname "$d"); done | sort -u | tr '\n' ' '`

## Approach

### Phase A — Readiness + gather

1. **Resolve feature.** Không có wireframe lẫn userflow → refuse + route.
2. **Read nguồn:** `srs/{feature}-userflow.md` (các flow + màn + nhánh), `ascii-wireframe/*` + `{feature}-wireframe-index.md` (màn + bảng mô tả element), `html-wireframe/*`, `userstories/us-*.md` (AC → trạng thái/nhánh mong đợi), `srs/{feature}-spec.md` Mục 5 (Error Matrix → màn lỗi + wording), `docs/design.md` nếu có (pattern/tokens để soát nhất quán). No-re-ask.

### Phase B — Review (5 trục)

3. Với mỗi màn, lập **checklist trạng thái**: default ✓, loading (nếu có tải), empty (nếu là list), error (nếu có nhánh lỗi), success. Thiếu trạng thái mà nghiệp vụ đòi → finding.
4. **Flow completeness:** đối chiếu userflow — mọi nhánh (happy/error/edge) có màn đích? Có màn nào không lối vào/ra (mồ côi/cụt)? Nhánh lỗi trong AC/Error Matrix có màn thể hiện?
5. **Nhất quán:** so tên nút/label/vị trí hành động chính giữa các màn; pattern (form, list, modal) đồng nhất?
6. **Validation UX:** field bắt buộc có đánh dấu; submit disable đúng lúc (vd tổng < tối thiểu); wording lỗi **khớp Error Matrix exact**.
7. **A11y cơ bản:** input có label; không truyền lỗi chỉ bằng màu; thứ tự thao tác hợp lý.

### Phase C — Quality gate + (optional) deep review

8. **UXUI-Reviewer gate (CHỈ khi vượt ngưỡng)** — feature **≥8 màn** HOẶC **≥3 flow** → spawn `uxui-reviewer` (Task tool) cho góc nhìn UX chuyên sâu; gộp findings (dedupe, escalate nếu trùng). Dưới ngưỡng → self-review đủ. Task unavailable → report ghi `reviewer skipped`.

### Phase D — Compose + approval + write

9. **`{feature}-uiux-review.md`** (theo `_templates/uiux-review.md`):
   - `## Checklist trạng thái` — bảng `Màn | default | loading | empty | error | success | Ghi chú`.
   - `## Findings` — nhóm severity, mỗi finding: mô tả + vị trí (màn) + đề xuất (+ route skill nếu cần sửa wireframe).
   - `## Flow gaps` — nhánh thiếu màn / màn mồ côi.
   - `## Verdict` — approve / revise / block (per `review-format.md`).
10. **L1 plan preview** → **Write** (env note `uiux review: {B} blocking, {n} màn`) → **Output report:**
    ```
    ✅ UI/UX review: docs/{feature}/{feature}-uiux-review.md
       Màn: {n} | Thiếu trạng thái: {t} | Flow gap: {g} | Blocking {B} · Warning {W} · Gợi ý {S} | Verdict: {v}

    Khắc phục: {đề xuất} → /wireframe-html {feature} (thêm màn/trạng thái thiếu)
    ```

## Gotchas

- **Review ≠ redesign** — đề xuất sửa, KHÔNG tự vẽ wireframe. Route `/wireframe-ascii`/`/wireframe-html`/`/prototype-html`.
- **Thiếu màn empty/error là lỗi phổ biến nhất** — list không có empty state, nhánh lỗi trong Error Matrix không có màn. Soát kỹ.
- **Bịa yêu cầu UX** — chỉ flag trạng thái/nhánh nghiệp vụ **thật sự đòi** (từ userflow/AC/Error), không "best practice chung chung".
- **Wording lỗi lệch** — màn báo lỗi phải trùng wording Error Matrix; lệch → flag.
- **1 màn = 1 trạng thái** (theo `ba-conventions.md` Mục 8) — nếu wireframe nhồi 2 state exclusive vào 1 khung → flag tách.
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
- @../../../_templates/uiux-review.md
- @./references/example-uiux.md
- @../../agents/uxui-reviewer.md

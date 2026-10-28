---
name: wireframe-ascii
description: Dùng khi cần vẽ wireframe ASCII lo-fi (đen trắng, monospace) cho các màn của 1 feature để duyệt nhanh cấu trúc trong chat. Cần có `srs/{feature}-userflow.md` (tự gọi `/user-flow` nếu chưa có). Kích hoạt bằng `/wireframe-ascii <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature> [--flow <flow-slug>]"
---

# /wireframe-ascii — ASCII Wireframe (lo-fi, chat-native)

## Goal

Vẽ **wireframe ASCII** (đen trắng, monospace) cho từng màn của 1 feature — bậc **lo-fi chat-native** trong thang fidelity: `/wireframe-ascii` (bậc NÀY) → `/wireframe-html` (lo-fi B&W layout-accurate) → `/prototype-html` (hi-fi tokens + JS). ASCII và HTML là **2 renderer ngang hàng** của cùng 1 screen; ASCII render được thẳng trong chat nên **duyệt cấu trúc nhanh** qua L3 iterate.

Output: 1 file/flow `docs/{feature}/ascii-wireframe/{flow-slug}.md` (**zero-frontmatter**, N screens/flow, mỗi screen 1 block `## Screen: {slug} — {tên}` gồm khung ASCII + **bảng mô tả 5 cột**) + `{feature}-wireframe-index.md` (screen-index master: metadata + designs map + Descriptions).

## Constraints

- **Cần `srs/{feature}-userflow.md` trước** (nguồn chia flow + danh sách màn + transitions). Chưa có/chưa duyệt → skill **tự gọi `/user-flow <feature>`** (Phase A), KHÔNG tự chia flow riêng.
- **L3 iterate (ASCII render trong chat)** — vẽ khung ASCII, in trong chat, loop refine tối đa 3 vòng (per `approval-gate.md` L3), rồi mới L1 → Write. Đây là điểm khác `/wireframe-html` (mermaid/HTML không render chat → đi thẳng L1).
- **Confirm device size TRƯỚC khi vẽ** (`ba-conventions.md` Mục 7) — AskUserQuestion Mobile 375 / Tablet 768 / Desktop 1024 / Responsive; đề xuất từ `userflow.md` frontmatter `primary_device`, KHÔNG tự chốt im lặng.
- **L1 approval** trước Write. **L2 diff** khi file flow/index đã tồn tại.
- **Bảng mô tả 5 cột** `# | Items | Control type | Data type | Description` — cột Description đủ sâu 6 lớp (`ba-conventions.md` Mục 6), rút số liệu/wording/mã ID THẬT từ `srs/{feature}-spec.md` → uc → brainstorm/URD/PRD. Thiếu nguồn nghiệp vụ → **hỏi user bổ sung** (từng field), KHÔNG bịa.
- **1 màn = 1 trạng thái, form không trải rộng** (`ba-conventions.md` Mục 8) — state loại trừ nhau → tách screen `{screen}-{state}`; form/auth căn giữa khung hẹp trong khung device.
- **KHÔNG emoji trong khung ASCII** (lệch viền). Dùng box-drawing `┌ ─ ┐ │ └ ┘ ▼ [ ]`.
- **Đọc lại ASCII đã có nếu HTML đã chạy trước** — nếu `html-wireframe/` đã tả screen đó, đọc làm nguồn thay vì suy lại (2 renderer ngang hàng, tránh lệch).
- **IT-BA framing**, **Vietnamese-first**, **doc sạch** (`ba-conventions.md` Mục 0 — file screen zero-frontmatter).

## Inputs

```
/wireframe-ascii <feature>                 # vẽ mọi flow của feature
/wireframe-ascii <feature> --flow checkout # chỉ 1 flow
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có userflow: !`for d in docs/*/srs/*-userflow.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Feature có ascii-wireframe: !`for d in docs/*/ascii-wireframe; do [ -d "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Userflow gate + device

1. **Resolve feature.** `srs/{feature}-userflow.md` chưa có/chưa `stage: flow-approved` → **tự gọi `/user-flow <feature>`** để chốt flow trước (HARD STOP của user-flow), rồi tiếp. Có rồi → Read (flow-slug, danh sách màn mỗi flow, transitions Mục 3.5).
2. **Confirm device** (AskUserQuestion) — đề xuất từ `primary_device`; user chốt. Chưa có `primary_device` trong userflow → ghi ngược vào frontmatter userflow (single-source).

### Phase B — Gather nguồn element

3. Cho mỗi màn trong flow: đọc nguồn nghiệp vụ theo ưu tiên `srs/{feature}-spec.md` (FR/BR/NFR/Error Matrix) → `usecases/uc-*.md` (branches) → brainstorm/URD/PRD. Screen đã có bên `html-wireframe/` → đọc bảng mô tả 5 cột đó làm nguồn (no-re-ask). Thiếu chi tiết validation → hỏi user bổ sung từng field.

### Phase C — Vẽ + L3 iterate (trong chat)

4. Vẽ khung **ASCII monospace** mỗi screen theo device width (mobile hẹp, desktop rộng; form căn giữa khung hẹp). In trong chat:
   ```
   [/wireframe-ascii] Phiên bản 1 — flow {flow-slug}:
   <khung ASCII các screen>
   Đồng ý / Sửa: <mô tả> / Hủy:
   ```
5. Loop tối đa 3 vòng theo feedback. Vòng 3 ép chốt.

### Phase D — Bảng mô tả + approval + write

6. Sau khi user "Đồng ý" khung: sinh **bảng mô tả 5 cột** cho mỗi screen (Description đủ 6 lớp, số liệu/wording thật). Screen có state loại trừ → tách `{screen}-{state}`.
7. **L1 plan preview** (prose BA-friendly): "Em sẽ {tạo/cập nhật} `ascii-wireframe/{flow-slug}.md` ({N} screen) + cập nhật `{feature}-wireframe-index.md` (device {…}). Apply?"
8. **Set env trước Write**: `CLAUDE_SKILL_NAME=/wireframe-ascii` + author + note (vd `{N} screen ASCII flow {flow-slug}`). Write file flow (zero-frontmatter, `## Screen:` blocks) + index (L2 diff nếu update). Format bảng cell `• `+`<br>`.

### Phase E — Report

9. **Output report:**
   ```
   ✅ ASCII wireframe: docs/{feature}/ascii-wireframe/{flow-slug}.md → {N} screen
      Device: {device} | Index cập nhật: {feature}-wireframe-index.md

   Recommended next:
     - /wireframe-html {feature}   — renderer HTML B&W layout-accurate (cùng screen)
     - /prototype-html {feature}   — prototype hi-fi clickable
     - /figma {feature}            — đưa lên Figma frame
   ```

## Gotchas

- **Cần userflow trước** — chưa có thì tự gọi `/user-flow`, KHÔNG tự chia flow.
- **L3 là điểm mạnh của ASCII** — render chat được → duyệt nhanh; đừng bỏ qua iterate đi thẳng Write.
- **Bảng Description nông = vô dụng** — phải đủ 6 lớp, số liệu/wording thật; thiếu nguồn → hỏi, không bịa.
- **Emoji trong khung ASCII lệch viền** — CẤM; dùng box-drawing.
- **State loại trừ nhồi 1 khung** — tách `{screen}-{state}` (Mục 8).
- **Form trải rộng desktop** — căn giữa khung hẹp (~380-460px cảm giác), không chạm 2 mép.
- **@author** — memory `user-identity`; file screen zero-frontmatter.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../../_templates/wireframe-index.md
- @./references/example-wireframe-ascii.md

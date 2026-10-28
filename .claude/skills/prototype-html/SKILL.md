---
name: prototype-html
description: Dùng khi cần prototype HTML hi-fi (màu, design tokens, click-through JS) cho các flow của 1 feature để demo stakeholder. Cần có ASCII screen (`/wireframe-ascii`) + `srs/{feature}-userflow.md`. Kích hoạt bằng `/prototype-html <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature> [--flow <flow-slug>]"
---

# /prototype-html — Hi-fi Clickable Prototype (self-contained)

## Goal

Sinh **1 file HTML prototype hi-fi tự-contained** `docs/{feature}/html-design/{feature}-prototype.html` — multi-screen **click-through** (JS điều hướng theo transitions của userflow), **màu + design tokens** đầy đủ, mục đích **demo stakeholder**. Bậc cao nhất trong thang fidelity: `/wireframe-ascii` (lo-fi chat) → `/wireframe-html` (lo-fi B&W) → `/prototype-html` (hi-fi — bậc NÀY).

Nguồn element: **ASCII screen** đã có (`ascii-wireframe/{flow-slug}.md` — bảng mô tả 5 cột) làm nguồn field/action/validation (KHÔNG suy lại); điều hướng lấy từ `srs/{feature}-userflow.md` Mục 3.5 (transitions). Reference lưu trong `{feature}-wireframe-index.md` cột `HTML prototype` dạng `{feature}-prototype.html#{slug}`.

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc ASCII screen trong `ascii-wireframe/{flow-slug}.md` + `srs/{feature}-userflow.md`. Thiếu → **refuse + route `/user-flow` + `/wireframe-ascii`** (`feature-bootstrap.md` nhóm B). KHÔNG tự bịa màn từ con số không.
- **Confirm device size TRƯỚC khi render** (`ba-conventions.md` Mục 7) — đề xuất từ `primary_device`, user chốt, KHÔNG tự đoán.
- **L1 approval** trước Write. **KHÔNG L3** (HTML không render trong chat — user mở browser review, gọi lại sửa).
- **Self-contained HTML** — inline CSS + JS, **KHÔNG CDN/external**; mở offline. Ảnh nhúng data-URI.
- **Điều hướng bám transitions userflow Mục 3.5** — mỗi nút/link đi màn nào theo bảng transitions, KHÔNG tự suy. Mỗi screen 1 `id="{slug}"`; JS show/hide theo click.
- **Element bám ASCII 5 cột** — field/nút/validation/error wording lấy từ bảng mô tả ASCII (số liệu/wording thật); state loại trừ → mỗi state 1 screen (Mục 8).
- **Design tokens** — 1 bảng token màu/spacing/typography ở đầu (CSS variables), dùng nhất quán. Prototype có màu (khác wireframe B&W) nhưng giữ hệ thống, không loè loẹt.
- **IT-BA framing**, **Vietnamese-first**, **doc sạch**.

## Inputs

```
/prototype-html <feature>                 # prototype mọi flow (1 file)
/prototype-html <feature> --flow checkout # chỉ 1 flow
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có ASCII screen: !`for d in docs/*/ascii-wireframe; do [ -d "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Readiness + device

1. **Resolve feature.** Thiếu `ascii-wireframe/*.md` hoặc `srs/{feature}-userflow.md` → refuse:
   ```
   Chưa thể chạy /prototype-html cho `{feature}` — thiếu {ASCII screen / userflow}.
   → Chạy /user-flow {feature} + /wireframe-ascii {feature} trước, rồi quay lại.
   ```
2. **Confirm device** (AskUserQuestion, đề xuất từ `primary_device`).

### Phase B — Gather

3. Read `ascii-wireframe/{flow-slug}.md` (bảng 5 cột → field/action/validation/error wording), `srs/{feature}-userflow.md` Mục 2 (màn) + Mục 3.5 (transitions → JS navigation), `srs/{feature}-spec.md` (bổ sung số liệu/error nếu ASCII thiếu). `docs/design.md` nếu có (tokens). No-re-ask.

### Phase C — Render + approval + write

4. Compose **1 HTML** self-contained:
   - `:root` design tokens (màu/spacing/font).
   - Mỗi screen `<section id="{slug}">` render element thật (`<input>`/`<button>`/`<a>`...) đúng device width; form căn giữa khung hẹp.
   - JS: click nút/link → theo transitions Mục 3.5 → show screen đích (hide còn lại). State loại trừ → screen riêng.
   - Thanh điều hướng nhỏ (screen list) để demo nhảy màn.
5. **L1 plan preview** (prose): "Em sẽ {tạo/cập nhật} `html-design/{feature}-prototype.html` ({N} screen click-through, device {…}, {T} transitions) + cập nhật cột HTML prototype trong index. Apply?"
6. **Set env trước Write**: `CLAUDE_SKILL_NAME=/prototype-html` + author + note. Write prototype + cập nhật `{feature}-wireframe-index.md` cột HTML prototype (L2 diff).

### Phase D — Report

7. **Output report:**
   ```
   ✅ Prototype: docs/{feature}/html-design/{feature}-prototype.html → {N} screen, {T} transitions
      Device: {device} | Double-click mở browser để demo click-through.

   Cần sửa? Gọi lại /prototype-html {feature} (tự vào update mode).
   Recommended next: /figma {feature} — đưa lên Figma frame.
   ```

## Gotchas

- **Thiếu ASCII → refuse** — prototype bịa màn từ con số không sẽ sai; route `/wireframe-ascii`.
- **Điều hướng tự suy** — nút đi đâu phải theo transitions userflow Mục 3.5, KHÔNG đoán.
- **Không self-contained** — CDN/link ngoài làm prototype không mở offline; inline tất.
- **Wording/số liệu bịa** — lấy từ bảng ASCII 5 cột / spec, thiếu → hỏi hoặc OQ.
- **Màu loè loẹt** — dùng design tokens nhất quán; prototype hi-fi ≠ tùy hứng màu.
- **State loại trừ 1 khung** — mỗi state 1 screen (Mục 8).
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @./references/example-prototype-html.md

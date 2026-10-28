---
name: figma
description: Dùng khi cần đưa wireframe/prototype của 1 feature lên Figma — sinh HTML import-ready + hướng dẫn import qua plugin, rồi ghi URL Figma frame vào wireframe-index. Cần có ASCII screen (`/wireframe-ascii`) hoặc HTML. Kích hoạt bằng `/figma <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature> [--flow <flow-slug>]"
---

# /figma — Đưa màn hình lên Figma (frame URL)

## Goal

Đưa các màn của 1 feature lên **Figma** rồi **ghi URL frame** vào `docs/{feature}/ascii-wireframe/{feature}-wireframe-index.md` cột `Figma` (**KHÔNG file local** — output là URL). Vì Figma là công cụ thiết kế bên ngoài (không tạo frame trực tiếp từ script được đáng tin), skill làm theo mô hình **chuẩn bị + import + ghi URL**:
1. Sinh **HTML import-ready** (clean, semantic, gần với `/prototype-html`) cho các screen từ nguồn wireframe.
2. Hướng dẫn user **import vào Figma** qua plugin (vd `html.to.design`) — hoặc dùng Figma MCP/API nếu workspace có.
3. User dán lại **URL frame Figma** → skill ghi vào wireframe-index cột Figma (per-screen).

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc ASCII screen (`ascii-wireframe/{flow-slug}.md`) HOẶC HTML (`html-design/` / `html-wireframe/`). Thiếu → **refuse + route `/user-flow` + `/wireframe-ascii`** (`feature-bootstrap.md` nhóm B).
- **Output là URL, KHÔNG file local Figma** — frame sống trên Figma; skill chỉ ghi URL vào `{feature}-wireframe-index.md` cột Figma. HTML import-ready là file **tạm** (`.figma-import/{flow-slug}.html`) để user import, không phải deliverable chính.
- **KHÔNG bịa URL Figma.** Skill KHÔNG tự chế link `figma.com/...`. URL phải do user cung cấp sau khi import thật (hoặc do Figma MCP/API trả về nếu có). Chưa có URL → ghi `— (chưa import)` trong index, KHÔNG điền link giả.
- **Cần Figma access ở runtime** — token/tài khoản Figma là của user. Skill nêu rõ bước import; nếu có **Figma MCP** thì tự động hóa, không thì hướng dẫn plugin thủ công.
- **L1 approval** trước khi ghi index. **L2 diff** cột Figma khi index đã có.
- **HTML import-ready bám nguồn** — element/wording từ ASCII 5 cột / HTML; KHÔNG suy lại nghiệp vụ. Self-contained.
- **IT-BA framing**, **Vietnamese-first**, **doc sạch**.

## Inputs

```
/figma <feature>                 # đưa mọi flow lên Figma
/figma <feature> --flow checkout # chỉ 1 flow
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có screen (ASCII/HTML): !`for d in docs/*/ascii-wireframe docs/*/html-design; do [ -d "$d" ] && basename $(dirname "$d"); done | sort -u | tr '\n' ' '`
Figma MCP có sẵn? !`echo "kiểm tra tool mcp figma nếu có; không thì import thủ công qua plugin"`

## Approach

### Phase A — Readiness + gather

1. **Resolve feature.** Thiếu ASCII/HTML screen → refuse + route `/wireframe-ascii`.
2. Read nguồn screen (ưu tiên `html-design/` nếu có → gần Figma nhất; else ASCII 5 cột) + `srs/{feature}-userflow.md` (danh sách màn + flow) + `{feature}-wireframe-index.md` (frame Figma đã có chưa — no-re-ask, chỉ bổ sung màn thiếu).

### Phase B — Sinh HTML import-ready

3. Compose HTML clean semantic cho mỗi screen (heading/section/label/input/button rõ ràng — plugin html.to.design map tốt sang layer Figma). Ghi tạm `docs/{feature}/.figma-import/{flow-slug}.html`. Self-contained.

### Phase C — Import

4. **Nếu có Figma MCP/API** (token của user): tạo frame per screen, lấy URL trả về.
5. **Không có** → in hướng dẫn:
   ```
   Để đưa lên Figma:
   1. Mở Figma → cài plugin "html.to.design".
   2. Import từng file trong docs/{feature}/.figma-import/{flow-slug}.html.
   3. Copy URL frame mỗi màn, dán lại đây (dạng: {screen-slug} = {url}).
   ```
   Chờ user dán URL. User bỏ qua → ghi `— (chưa import)` cho các screen.

### Phase D — Ghi index + report

6. **L1 plan preview**: "Em sẽ cập nhật `{feature}-wireframe-index.md` cột Figma cho {N} screen ({M} có URL, {K} chưa import). Apply?"
7. **Set env trước Write**: `CLAUDE_SKILL_NAME=/figma` + author + note (vd `Figma frame cho {M} screen`). Ghi URL vào cột Figma của index (L2 diff). Chỉ ghi URL thật user cung cấp.
8. **Output report:**
   ```
   ✅ Figma: {feature}-wireframe-index.md cột Figma cập nhật
      {M}/{N} screen có URL frame | {K} chưa import (HTML sẵn ở .figma-import/)

   Chưa import xong? Import các file .figma-import/*.html rồi chạy lại /figma dán URL.
   ```

## Gotchas

- **KHÔNG bịa link Figma** — link phải do import thật sinh ra; chưa có → `— (chưa import)`, tuyệt đối không chế `figma.com/file/xxx`.
- **Output là URL trong index, không file .fig local** — Figma frame sống trên cloud.
- **Thiếu screen → refuse** — cần ASCII/HTML trước; route `/wireframe-ascii` (hoặc `/prototype-html` cho HTML hi-fi).
- **HTML import tạm** — `.figma-import/*.html` để user import qua plugin; không phải deliverable, có thể xóa sau.
- **Figma access là của user** — skill không có token; nếu có Figma MCP thì tự động, không thì hướng dẫn plugin.
- **Element bịa** — bám ASCII 5 cột / HTML, không suy lại nghiệp vụ.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @./references/example-figma.md

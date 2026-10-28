---
name: export
description: Dùng khi cần đóng gói tài liệu BA thành 1 bản bàn giao — gom nhiều doc (theo feature hoặc phạm vi) thành package Markdown + HTML tự chứa (và PDF/DOCX nếu có pandoc). Kèm mục lục, trang bìa, danh mục nguồn. Kích hoạt bằng `/export [feature|scope] [--format md|html|pdf|docx]`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "[feature | all] [--format md|html|pdf|docx] [--include urd,brd,srs,...]"
---

# /export — Đóng gói tài liệu bàn giao

## Goal

Gom các tài liệu BA của 1 feature (hoặc toàn vault) thành **1 gói bàn giao** tại `docs/exports/{date}-{scope}{-feature}-package.{ext}`:
- **Trang bìa** (feature, ngày, phạm vi, người xuất) + **mục lục** (TOC) + **các doc theo thứ tự chuỗi** (URD → BRD → PRD → SRS → use case → story → test…) + **danh mục nguồn** (bảng path + status + updated).
- **md** luôn có (gộp 1 file, anchor TOC). **html** tự chứa (no CDN, in được, 1 chế độ sáng). **pdf/docx** qua pandoc **nếu có**; không có → xuất md/html + báo rõ cách cài, KHÔNG giả vờ đã tạo pdf.

## Constraints

- **Nhóm B — cần ≥1 doc để gói** (`feature-bootstrap.md`). Vault/feature rỗng → refuse thân thiện + route `/srs` (hoặc `/urd`). KHÔNG tự sinh nội dung, KHÔNG bịa doc.
- **KHÔNG chỉnh sửa nội dung nghiệp vụ** — export chỉ **gom + trình bày**. Giữ nguyên ID, wording, bảng. Không "tóm tắt lại" làm sai lệch.
- **Đánh dấu status trung thực** — doc `draft`/`stale` vẫn gói được nhưng phải **ghi rõ trạng thái** ở danh mục nguồn + cảnh báo trang bìa nếu có doc chưa `approved`. KHÔNG "làm đẹp" thành approved.
- **HTML tự chứa** — CSS inline, KHÔNG script/asset ngoài, KHÔNG CDN, ảnh nhúng data-URI hoặc note nếu không nhúng được. In được (print CSS). Một chế độ sáng (trắng/đen + xanh dương nhấn), KHÔNG dark mode.
- **pdf/docx cần pandoc** — kiểm `command -v pandoc`. Có → gọi. Không → dừng ở html + hướng dẫn cài, ghi `pdf: chưa tạo (thiếu pandoc)`. KHÔNG báo đã tạo file không tồn tại.
- **L1 TRƯỚC khi ghi** (`approval-gate.md`) — list doc sẽ gói + format + đường dẫn output.
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter output `type: export-package`.

## Inputs

```
/export {feature}                       # gói toàn bộ doc của 1 feature (md + html)
/export all                             # gói toàn vault theo feature
/export {feature} --format pdf          # thêm PDF (cần pandoc)
/export {feature} --include srs,test    # chỉ gói doc loại chỉ định
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature hiện có: !`ls -d docs/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null | grep -v '^_' | tr '\n' ' '`
pandoc: !`command -v pandoc >/dev/null 2>&1 && echo "có (pdf/docx OK)" || echo "KHÔNG (chỉ md/html)"`

## Approach

### Phase A — Chọn phạm vi + doc

1. **Resolve scope** (feature / all). Rỗng → refuse + route (nhóm C-ish read-broad).
2. **Liệt kê doc** trong scope theo thứ tự chuỗi BA (URD→BRD→PRD→SRS→flows/erd→usecase→story→ac→test→uat). `--include` lọc loại.
   > *Tăng tốc:* `kg facts {feature}` để biết doc/artifact hiện có; graph chỉ để **chọn file**, nội dung đọc từ prose (`kg-usage.md`). Thiếu KG → glob trực tiếp.
3. **Đọc status mỗi doc** (frontmatter) → phục vụ danh mục nguồn + cảnh báo.

### Phase B — Chọn format + kiểm công cụ

4. **Xác định format** (mặc định md + html). `pdf`/`docx` → kiểm `pandoc`; thiếu → thông báo + hạ về html.

### Phase C — Dựng package

5. **Trang bìa** (feature, ngày, phạm vi, số doc, người xuất, cảnh báo nếu có doc chưa approved) + **TOC** anchor.
6. **Ghép các doc** theo thứ tự, mỗi doc 1 `# {DocType}` + giữ nguyên nội dung (ID/bảng/wording). Chèn `---` phân cách + link về mục lục.
7. **Danh mục nguồn** (bảng: path · type · status · updated) ở cuối — minh bạch nguồn.
8. **Render:** md (gộp) → html (CSS inline, print-friendly) → pdf/docx (pandoc nếu có).

### Phase D — Approval + Write

9. **L1 plan preview** (prose BA):
   > Em sẽ đóng gói `{scope}` thành `docs/exports/{date}-{scope}-package.{md,html}`: {N} doc theo thứ tự {URD→…→test}. {K} doc chưa approved (ghi rõ trong gói). Format: md + html{ + pdf nếu pandoc}. Apply?
10. **Set env trước Write** (`CLAUDE_SKILL_NAME=/export` + author + note vd `export food-delivery: 6 doc → md+html`). Write các file output.

### Phase E — Report

11. **Report:**
    ```
    ✅ Export `{scope}`:
       docs/exports/{date}-{scope}-package.md   ({N} doc)
       docs/exports/{date}-{scope}-package.html (tự chứa, in được)
       pdf: {đã tạo | chưa tạo (thiếu pandoc — cài: ...)}
       Cảnh báo: {K} doc chưa approved (đã ghi trạng thái trong gói).
    ```

## Gotchas

- **Sửa nội dung khi gói** — CẤM; export chỉ gom + trình bày, giữ nguyên ID/wording.
- **Báo đã tạo pdf khi thiếu pandoc** — CẤM; dừng ở html + hướng dẫn cài.
- **HTML dùng CDN/script ngoài** — CẤM; phải tự chứa, CSS inline, in được.
- **Gói doc draft/stale mà không ghi trạng thái** — thiếu minh bạch; danh mục nguồn phải nêu.
- **Đặt file sai chỗ** — luôn `docs/exports/`, tên `{date}-{scope}{-feature}-package.{ext}`.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/export-package.md
- @./references/example-export.md

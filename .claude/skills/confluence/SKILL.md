---
name: confluence
description: Dùng khi cần xuất bản tài liệu BA (SRS/URD/BRD/PRD…) lên Confluence — publish thành page, cập nhật version có kiểm soát, hoặc xem drift (status). Markdown → storage format, sync-state ghi page-id + version, KHÔNG bịa URL. Kích hoạt bằng `/confluence <publish|status> [feature|doc]`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<publish|status> [feature | đường-dẫn-doc] [--dry-run] [--allow-draft]"
---

# /confluence — Xuất bản tài liệu ↔ Confluence

## Goal

Xuất bản tài liệu BA local lên **Confluence** an toàn:
- **publish** — mỗi doc (mặc định `srs/{feature}-spec.md`, mở rộng URD/BRD/PRD) → 1 Confluence page dưới `parent_page_id`, markdown → storage format, ghi `page_id`/`url`/`version` vào `sync-state.yaml` (`mappings.confluence`).
- **status** — in bảng drift (local vs remote version vs base), read-only.

Nội dung đẩy **1 chiều** (local là nguồn thật). Confluence là bản chiếu để stakeholder đọc/comment. Không kéo nội dung Confluence về đè local.

## Constraints

- **Nhóm B — cần ≥1 doc feature làm nguồn** (`feature-bootstrap.md`). Chưa có doc nào (thường `srs/{feature}-spec.md`) → **refuse + route `/srs {feature}`**. KHÔNG tự tạo nội dung.
- **External side-effect — L1 TRƯỚC mỗi lần publish** (`approval-gate.md` + `atlassian-sync.md`).
- **Hard gate** (`atlassian-sync.md` Mục 3): doc `status: stale` → REFUSE (route chạy lại skill sinh doc). `status: draft` → chặn trừ `--allow-draft` (bản nháp lên Confluence dễ gây hiểu nhầm là chính thức).
- **KHÔNG BỊA URL/page_id.** Thiếu `config.confluence.base_url` → **dry-run**: in title + space + parent + preview storage-body + `⧗ chưa publish (thiếu kết nối)`. `page_id`/`url` chỉ điền sau khi API thật trả về.
- **3-way version guard** — page đã có `page_id` và `remote_version` Confluence > base → CONFLICT (có người sửa trực tiếp trên Confluence): in cảnh báo, hỏi `giữ local / xem remote / hủy`. KHÔNG tự đè version.
- **Idempotent** — hash không đổi → skip, KHÔNG tạo version rác.
- **Markdown → storage format** (`atlassian-sync.md` Mục 6): giữ bảng/heading/code + ID (`FR-*`, `E-*`) dạng text; wikilink `[[docs/...]]` → link tương đối/text (không lộ cú pháp Obsidian). Ảnh chưa upload được → placeholder + note, KHÔNG bịa link.
- **KHÔNG lưu token.** **Vietnamese-first.**

## Inputs

```
/confluence status [feature]                 # bảng drift, read-only
/confluence publish [feature]                # publish spec (+ hỏi thêm URD/BRD/PRD)
/confluence publish docs/x/srs/x-spec.md     # publish 1 doc chỉ định
/confluence publish --dry-run                # in preview, KHÔNG gọi API
/confluence publish --allow-draft            # cho phép publish bản nháp
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Sync-state tồn tại: !`[ -f .claude/state/atlassian/sync-state.yaml ] && echo yes || echo "no (dry-run)"`
Confluence base_url: !`grep -A3 'confluence:' .claude/state/atlassian/sync-state.yaml 2>/dev/null | grep base_url | grep -q '""' && echo "trống → dry-run" || echo "có"`

## Approach

### Phase A — Resolve + readiness

1. **Resolve doc cần publish.** Arg là feature → mặc định `srs/{feature}-spec.md`; là path → dùng path đó. Thiếu doc → refuse + route `/srs` (nhóm B).
2. **Load sync-state** (`mappings.confluence`). Chưa có → khởi tạo skeleton + báo dry-run.
3. **Hard-gate status** mỗi doc: `stale` → refuse + route; `draft` → chặn trừ `--allow-draft`.

### Phase B — Diff version (mọi mode)

4. **Với mỗi doc:** so `base/{doc}.json` · local (hash) · remote (fetch Confluence version nếu có kết nối). Phân loại `NEW` / `UNCHANGED` / `LOCAL-AHEAD` / `CONFLICT`.
5. **mode=status** → in bảng drift rồi DỪNG:
   ```
   Doc                         | page_id | Local  | Remote v | Sync
   srs/food-delivery-spec.md   | 88410   | edited | v3       | LOCAL-AHEAD
   food-delivery-brd.md        | —       | draft  | —        | NEW
   ```

### Phase C — Convert + approval + publish

6. **Convert markdown → storage format** (bảng/heading/code/ID giữ nguyên). Title = H1 doc hoặc `{Feature} — {DocType}`. Preview body cho L1.
7. **L1 plan preview** (prose BA):
   > Em sẽ publish `{doc}` lên Confluence (space `{FD}`, dưới page cha `{id}`): {tạo mới | cập nhật v{n}→v{n+1}}. {C} doc có xung đột (Confluence đã sửa) sẽ hỏi riêng. Kết nối: {thật | dry-run}. Apply?
8. **CONFLICT** → cảnh báo remote đổi, hỏi `giữ local / xem remote / hủy`. KHÔNG auto-đè.
9. **Thực thi:**
   - Có kết nối → gọi API. Thành công → ghi `page_id`/`url`/`last_published`/`local_hash`/`remote_version` + cập nhật `base/{doc}.json`.
   - Dry-run → in title + space + parent + preview + `⧗ SẼ publish — chưa gọi API`. KHÔNG điền URL giả.
10. **Set env trước ghi** (`CLAUDE_SKILL_NAME=/confluence` + author + note). Hook ghi activity.log.

### Phase D — Report

11. **Report phân biệt đã-publish-thật vs dry-run:**
    ```
    ✅ Confluence sync `{feature}` (publish):
       Đã publish thật: spec → page 88410 (v3→v4)
       Dry-run: brd ⧗ (chưa kết nối)
       Conflict: prd — Confluence v2 sửa tay, giữ local sau khi bạn xác nhận
    → Cấu hình kết nối: .claude/state/atlassian/sync-state.yaml (config.confluence)
    ```

## Gotchas

- **Bịa URL `x.atlassian.net/wiki/...`** — CẤM. Chưa gọi API → URL rỗng + dry-run.
- **Publish đè khi ai đó đã sửa trên Confluence** — phải CONFLICT + hỏi, không nuốt.
- **Tạo version mới khi hash không đổi** — rác lịch sử; phải skip.
- **Publish bản nháp im lặng** — hard-gate chặn; draft dễ bị hiểu là chính thức.
- **Lộ cú pháp `[[...]]` Obsidian trên Confluence** — convert sang link/text.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/atlassian-sync.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @./references/example-confluence.md

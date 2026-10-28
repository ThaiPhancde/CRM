---
name: rtg
description: Dùng khi cần ma trận truy vết yêu cầu chính thức (RTM/Requirements Traceability Grid) để bàn giao/audit — mỗi requirement 1 hàng, cột UC/US/AC/test/status, xuất được. Kích hoạt bằng `/rtg` (toàn sản phẩm) hoặc `/rtg <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
argument-hint: "(empty = toàn sản phẩm) | <feature-slug>"
---

# /rtg — Requirements Traceability Grid (RTM)

## Goal

Sinh **ma trận truy vết yêu cầu chính thức** (Requirements Traceability Matrix) `docs/_shared/rtg.md` — **1 hàng / 1 yêu cầu** (BO/CAP/FR), các cột: **Source** (upstream: BRD/PRD), **Use case**, **User story**, **Acceptance criteria**, **Test (CHK/TC)**, **Screen**, **Priority**, **Status**. Đây là **tài liệu bàn giao/audit** — bảng phẳng, đầy đủ, xuất được (Confluence/Excel), chứng minh mọi yêu cầu được thiết kế + kiểm thử tới đâu.

`/rtg` là **artifact chính thức** (khác `/gap` = phân tích tìm lỗ hổng, và `/traceboard` = bảng HTML trực quan). RTM dùng khi bàn giao cho khách/QA/audit cần **chứng cứ truy vết đầy đủ**.

## Constraints

- **Project/feature-level (nhóm C khi toàn sản phẩm).** Vault rỗng → friendly message. Không có yêu cầu (FR) nào → "chưa có FR để lập RTM, chạy `/srs` trước".
- **L1 approval** trước Write. **L2 diff** nếu rtg.md đã tồn tại.
- **1 hàng = 1 yêu cầu, mọi yêu cầu đều có mặt** — kể cả yêu cầu chưa có UC/US/test (ô để trống + đánh dấu, KHÔNG bỏ khỏi bảng — RTM phải phơi bày cả chỗ chưa phủ).
- **Chỉ quan hệ thật** — điền ID **full-form** thật đọc được từ doc; KHÔNG bịa liên kết. Ô trống = chưa có (rõ ràng), không đoán.
- **Status per yêu cầu** — suy từ chuỗi: `draft` (mới FR) / `designed` (có UC/US) / `specified` (có AC) / `testable` (có CHK/TC) / `verified` (test pass — nếu có kết quả). Không có kết quả test → tối đa `testable`.
- **Read-only nội dung** — chỉ đọc doc + ghi RTM. Không sửa doc nghiệp vụ.
- **Xuất được** — bảng Markdown phẳng (render Confluence/GitHub, paste Excel được). Không nhồi prose dài trong ô.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first** (nhãn cột song ngữ nếu cần cho audit).

## Inputs

```
/rtg              # RTM toàn sản phẩm (mọi feature)
/rtg <feature>    # RTM 1 feature
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Có traceability (từ /gap)? !`[ -f docs/_shared/traceability.md ] && echo "có → dùng làm nguồn" || echo "chưa (nên chạy /gap để đối chiếu)"`
Features có FR: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Gather

1. **Phạm vi** (toàn sản phẩm / 1 feature). Thu mọi yêu cầu: BO (`brd`), CAP (`prd`), FR (`srs/spec` Mục 2). Với mỗi FR, thu ID liên kết: UC (`usecases/` Covers FR), US (`userstories/` Covers FR), AC (us-*), CHK/TC (`test/` Maps-to), Screen, Error.
   > *Tăng tốc:* dùng `docs/_shared/traceability.md` (từ `/gap`) nếu có — đã có sẵn quan hệ; hoặc `kg trace <feature>`. Thiếu → glob + grep ID trực tiếp (`kg-usage.md`).

### Phase B — Build ma trận + status

2. Mỗi FR → 1 hàng, điền các cột từ quan hệ thật (full-form ID). Ô không có liên kết → để trống + đánh dấu (vd `—` + note ở cột Status). Suy **Status** theo chuỗi phủ (draft→designed→specified→testable→verified).
3. Thêm hàng cho BO/CAP (upstream) nếu phạm vi cần chứng minh từ mục tiêu → yêu cầu.

### Phase C — Compose + approval + write

4. **`docs/_shared/rtg.md`** (theo `_templates/rtg.md`):
   - frontmatter `type: rtg`, scope, updated, links.
   - `## RTM` — bảng: `# | Requirement | Source | Use case | User story | AC | Test | Screen | Priority | Status`.
   - `## Chưa phủ` — tóm tắt hàng có ô trống ở tầng quan trọng (để audit thấy nhanh chỗ hở) — trỏ `/gap` để phân tích sâu.
   - `## Chú giải` — định nghĩa các Status.
5. **L1 plan preview** → **Write** (env note `RTM: {N} yêu cầu, {v} verified`). 
6. **Output report:**
   ```
   ✅ RTM: docs/_shared/rtg.md
      Yêu cầu: {N} | Status: designed {d} · specified {s} · testable {t} · verified {v} | Chưa phủ: {u}

   Bàn giao: RTM render Confluence/GitHub, paste Excel được.
   Phân tích lỗ hổng chi tiết: /gap | Bảng trực quan: /traceboard
   ```

## Gotchas

- **RTM phải phơi bày chỗ hở** — yêu cầu chưa có UC/test vẫn phải có hàng (ô trống + đánh dấu), KHÔNG lọc bỏ. Ẩn chỗ hở là làm sai mục đích audit.
- **Không bịa liên kết** — ô chỉ điền ID thật; không "chắc là US-005 lo cái này".
- **Status quá lạc quan** — không có kết quả test thì tối đa `testable`, KHÔNG đánh `verified` (verified cần bằng chứng test pass).
- **Short-form ID** — điền full-form (`FR-food-delivery-003`), không `FR-003` (mất trace khi bàn giao cross-feature).
- **Ô prose dài** — giữ ô ngắn (ID list); giải thích để `/gap`. RTM là bảng phẳng để xuất.
- **`/rtg` vs `/gap` vs `/traceboard`** — RTM = artifact bàn giao chính thức; gap = phân tích tìm lỗ hổng; traceboard = trực quan HTML. Chạy `/gap` trước để RTM + gap khớp số.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/rtg.md
- @./references/example-rtg.md

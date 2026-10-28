---
name: gap
description: Dùng khi cần soát lỗ hổng & truy vết cross-doc toàn vault — dựng chuỗi FR→UC→US→AC→CHK/TC (+ screen/error), bắt orphan (yêu cầu không có test/story), link gãy (ID trỏ tới nơi không tồn tại), chain stale. Read-only phân tích. Kích hoạt bằng `/gap` hoặc `/gap <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
argument-hint: "(empty = toàn vault) | <feature-slug>"
---

# /gap — Cross-doc Gap & Traceability Analysis

## Goal

Soát **độ phủ truy vết** toàn vault (hoặc 1 feature): dựng chuỗi **BO/CAP → FR → UC → US → AC → CHK → TC**, kèm liên kết Screen + Error, rồi phát hiện:
- **Orphan** — yêu cầu không có mắt xích tiếp (FR không UC/US, US không AC, AC không test, error không có case negative…).
- **Link gãy (broken ref)** — ID được trỏ tới nhưng **không tồn tại** ở nguồn (vd US trỏ `FR-food-delivery-099` mà spec không có).
- **Chain stale** — upstream sửa sau downstream (downstream có thể lỗi thời).
- **Coverage holes** — % phủ mỗi tầng.

Output (duy nhất khi ghi): `docs/_shared/traceability.md` — ma trận truy vết cross-doc + danh sách gap theo mức độ. **Đây là skill read-only về nội dung** (không sửa doc nghiệp vụ); chỉ ghi báo cáo traceability.

> Khác các "index" per-feature (usecase-index, story-index…) vốn là ma trận **trong 1 feature**. `/gap` là **cross-doc, cross-feature** — soát rìa nối giữa các doc.

## Constraints

- **Read-only nội dung.** KHÔNG sửa doc nghiệp vụ (FR/UC/US/AC/test). Chỉ **đọc** để phân tích + **ghi 1 báo cáo** `docs/_shared/traceability.md`. (Đây là ngoại lệ đọc-only trong `approval-gate.md`, nhưng **L1 vẫn bắt buộc** cho lần ghi traceability.md.)
- **L1 approval** trước khi ghi `traceability.md`. **L2 diff** nếu file đã tồn tại.
- **KHÔNG bịa liên kết.** Chỉ báo cáo quan hệ **thật** đọc được từ ID/links trong doc. Không suy diễn "chắc là liên quan". Nghi ngờ → liệt kê ở mục "cần người xác nhận".
- **Findings theo severity** (`review-format.md`): BLOCKING (orphan P0 / link gãy), WARNING (orphan P1 / chain stale), SUGGESTION (P2 / gộp trùng).
- **Nhóm C — read-only project-level.** Vault rỗng → friendly message ("Chưa có gì để soát — bắt đầu với `/brainstorm` hoặc `/srs`"), KHÔNG crash (`feature-bootstrap.md` nhóm C).
- **Không double-count** — 1 gap báo 1 lần ở severity cao nhất.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**.

## Inputs

```
/gap                    # soát toàn vault (mọi feature)
/gap <feature>          # chỉ 1 feature (chuỗi trong feature + rìa nối ra ngoài)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Features: !`ls -d docs/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null | grep -v '^_' | tr '\n' ' '`
Traceability cũ? !`[ -f docs/_shared/traceability.md ] && echo "có (update mode)" || echo "chưa"`

## Approach

### Phase A — Gather (đọc rộng)

1. **Xác định phạm vi** (toàn vault / 1 feature).
2. **Thu ID + links** từ mọi doc trong phạm vi: BO (`brd`), CAP (`prd`), FR/NFR/BR/E (`srs/spec`), UC (`usecases/`), US (`userstories/`), AC (inline `us-*`), CHK (`test/checklist`), TC (`test/testcases`), Screen (`ascii/html-wireframe`).
   > *Tăng tốc (khuyến nghị mạnh cho `/gap`):* `kg trace <feature>` dump toàn bộ edge (from|type|to|provenance) + broken refs; `kg coverage <feature>` anti-join tầng. Thiếu KG engine → glob + grep ID/links trực tiếp (flow cũ, `kg-usage.md`). **Kết luận nội dung LUÔN dựa prose đã Read, KHÔNG dựa mình facts** (contract kg-usage).

### Phase B — Build chuỗi + detect

3. **Dựng graph** quan hệ theo ID (COVERS/VERIFIES/REALIZES…). Với mỗi mắt xích, kiểm:
   - **Orphan**: node không có edge tiếp cần thiết (FR không UC/US; US không AC; AC không CHK/TC; error E-* không TC negative; screen không màn nào dùng).
   - **Broken ref**: mọi ID trỏ trong `links:`/body có tồn tại ở nguồn không? Không → broken.
   - **Stale**: so `updated` upstream vs downstream (upstream mới hơn → downstream nghi stale). (Có `staleness.log`/kg suspect thì dùng.)
   - **Coverage %**: mỗi tầng có bao nhiêu % node được phủ tầng dưới.

### Phase C — Compose report

4. **`docs/_shared/traceability.md`** (theo `_templates/traceability.md`):
   - `## Coverage` — bảng % phủ mỗi tầng (per feature + tổng).
   - `## Ma trận truy vết` — bảng `FR | UC | US | AC | CHK/TC | Screen | Error | Trạng thái` (mỗi FR 1 dòng, ô trống = gap).
   - `## Gaps` — nhóm theo severity (BLOCKING/WARNING/SUGGESTION), mỗi gap: mô tả + vị trí + đề xuất skill khắc phục (vd "FR-x không UC → `/usecase`").
   - `## Broken references` — ID trỏ tới nơi không tồn tại + file chứa.
   - `## Cần người xác nhận` — quan hệ mơ hồ.

### Phase D — Approval + Write + report

5. **L1 plan preview** (prose): "Em sẽ {tạo/cập nhật} `docs/_shared/traceability.md`: coverage {…}%, {B} blocking / {W} warning / {S} gợi ý, {K} link gãy. Apply?"
6. **Set env trước Write**: `CLAUDE_SKILL_NAME=/gap` + author + note (vd `traceability: {B} blocking, {K} broken`). Write (L2 diff nếu update).
7. **Output report:**
   ```
   ✅ Traceability: docs/_shared/traceability.md
      Coverage: FR→test {x}% | Orphan: {o} | Broken ref: {k} | Stale: {s}
      Blocking {B} · Warning {W} · Gợi ý {S}

   Khắc phục gợi ý:
     - {FR không UC} → /usecase {feature}
     - {AC không test} → /test-checklist {feature}
   Xem bảng trực quan: /traceboard | Ma trận bàn giao: /rtg
   ```

## Gotchas

- **Read-only** — nếu tìm thấy FR sai/thiếu, `/gap` KHÔNG tự sửa spec; chỉ báo gap + route skill sửa. Sửa nội dung là việc skill sở hữu doc đó.
- **Broken ref hay do short-form ID** — `FR-001` thay vì `FR-food-delivery-001` gây "feature-ma" + mất trace. Báo cả loại này.
- **Không bịa quan hệ** — chỉ báo edge thật; mơ hồ → "cần người xác nhận", không tự nối.
- **Facts ≠ nội dung** — dùng kg để CHỌN file/đếm; kết luận gap dựa prose Read (kg-usage contract).
- **Vault rỗng** — friendly message, không crash.
- **`/gap` vs `/traceboard` vs `/rtg`** — `/gap` là **phân tích** (tìm lỗ hổng, markdown); `/traceboard` là **bảng HTML trực quan** cùng dữ liệu; `/rtg` là **ma trận RTM chính thức** để bàn giao. 3 góc nhìn của cùng traceability.
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
- @../../rules/kg-usage.md
- @../../../_templates/traceability.md
- @./references/example-gap.md

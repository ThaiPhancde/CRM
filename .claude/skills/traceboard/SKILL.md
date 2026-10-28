---
name: traceboard
description: Dùng khi cần bảng HTML trực quan độ phủ truy vết toàn sản phẩm — mỗi feature hiện chuỗi FR→UC→US→AC→test xanh/đỏ + health score + orphan, mở bằng browser. Kích hoạt bằng `/traceboard` (đọc traceability của /gap hoặc tự quét vault).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
argument-hint: "(empty = toàn sản phẩm) | <feature-slug>"
---

# /traceboard — Visual Traceability Board (HTML)

## Goal

Sinh **1 file HTML tự-contained** `docs/_shared/traceboard.html` trực quan hóa **độ phủ truy vết** toàn sản phẩm: mỗi feature 1 hàng, mỗi tầng (FR → UC → US → AC → CHK/TC) 1 ô **xanh (đủ) / vàng (một phần) / đỏ (thiếu)**, kèm **health score** per feature + tổng, danh sách orphan/broken nổi bật. Mở bằng double-click browser — không cần công cụ.

`/traceboard` là **góc nhìn trực quan** của cùng dữ liệu `/gap` (markdown analysis). Dùng nguồn `docs/_shared/traceability.md` nếu có (khỏi quét lại); chưa có thì tự quét vault.

## Constraints

- **Project-level (nhóm C).** Không cần feature. Vault rỗng → sinh board rỗng + placeholder "chưa có feature", KHÔNG crash (`feature-bootstrap.md` nhóm C).
- **L1 approval** trước Write. **L2 diff không áp** cho HTML regen — file board là regenerated (giống dashboard); vẫn L1 mỗi lần ghi.
- **Self-contained HTML** — inline CSS + JS, **KHÔNG CDN/external**, mở offline được. Không màu-sắc-phụ-thuộc: trạng thái có cả **nhãn chữ** (đủ/một phần/thiếu) ngoài màu (a11y).
- **Nguồn ưu tiên `traceability.md`** — có → parse coverage/gap từ đó (nhất quán với `/gap`). Không có → quét vault (glob ID/links) trực tiếp; gợi ý chạy `/gap` trước để số liệu khớp.
- **KHÔNG bịa số** — coverage tính từ quan hệ thật; feature thiếu dữ liệu → ô đỏ + tooltip "chưa có", không đoán.
- **Read-only nội dung** — chỉ đọc doc + ghi 1 file board. Không sửa doc nghiệp vụ.
- **Doc/nhãn Vietnamese-first.**

## Inputs

```
/traceboard             # board toàn sản phẩm
/traceboard <feature>   # board chi tiết 1 feature (mỗi màn/UC 1 ô)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Có traceability (từ /gap)? !`[ -f docs/_shared/traceability.md ] && echo "có → dùng làm nguồn" || echo "chưa — sẽ tự quét vault (nên chạy /gap trước)"`
Features: !`ls -d docs/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null | grep -v '^_' | tr '\n' ' '`

## Approach

### Phase A — Gather

1. **Nguồn coverage.** `docs/_shared/traceability.md` có → parse bảng Coverage + Gaps + Broken refs. Không có → quét vault: mỗi feature đếm FR/UC/US/AC/CHK/TC + rìa nối (glob + grep ID).
   > *Tăng tốc:* `kg counts` / `kg coverage <feature>` cho số phủ nhanh. Thiếu KG → quét trực tiếp (`kg-usage.md`).

### Phase B — Tính trạng thái + health

2. Mỗi feature × tầng → trạng thái: **đủ** (mọi node tầng trên có node tầng dưới), **một phần** (>0 nhưng chưa hết), **thiếu** (tầng trên có, tầng dưới trống). **Health score** = trung bình % phủ các tầng (0-100). Đếm orphan/broken per feature.

### Phase C — Render HTML (self-contained)

3. Compose `docs/_shared/traceboard.html` từ `_templates/traceboard.html` (skeleton) + data nhúng inline:
   - Header: tên sản phẩm + ngày + health tổng.
   - Bảng lưới: hàng = feature, cột = FR/UC/US/AC/Test; ô có màu + nhãn chữ + số (vd "5/8"); tooltip liệt kê node thiếu.
   - Panel bên: top orphan + broken refs (từ traceability).
   - Legend: xanh=đủ / vàng=một phần / đỏ=thiếu (kèm chữ).
   - Toàn bộ CSS/JS inline; không script ngoài.
4. **KHÔNG tự bịa** — ô thiếu dữ liệu → đỏ + "chưa có", không đoán con số.

### Phase D — Approval + Write + report

5. **L1 plan preview** (prose): "Em sẽ {tạo/cập nhật} `docs/_shared/traceboard.html`: {F} feature, health tổng {h}%, {o} orphan, {k} broken. Apply?"
6. **Set env trước Write**: `CLAUDE_SKILL_NAME=/traceboard` + author + note (vd `traceboard: {F} feature, health {h}%`). Write.
7. **Output report:**
   ```
   ✅ Traceability board: docs/_shared/traceboard.html
      Feature: {F} | Health tổng: {h}% | Orphan: {o} | Broken: {k}
      Double-click mở browser để xem lưới phủ.

   Nguồn số: {traceability.md | quét vault}. {Nếu quét: chạy /gap trước để số khớp + có gap chi tiết.}
   ```

## Gotchas

- **Self-contained bắt buộc** — không CDN/link ngoài; mở offline. Ảnh/asset nhúng data-URI nếu có.
- **A11y — không chỉ màu** — trạng thái phải có nhãn chữ + số, không để người mù màu chỉ thấy ô xám.
- **Số lệch `/gap`** — nếu quét vault trực tiếp (chưa chạy `/gap`), số có thể khác báo cáo gap; nêu rõ nguồn + gợi ý chạy `/gap`.
- **Board là regenerated** — mỗi lần chạy ghi đè; không sửa tay HTML (mất khi regen). Sửa dữ liệu (doc) rồi chạy lại.
- **Vault rỗng** — board rỗng + placeholder, không crash.
- **`/traceboard` vs `/gap` vs `/rtg`** — board = trực quan HTML; gap = phân tích markdown + tìm lỗ hổng; rtg = ma trận RTM chính thức để bàn giao.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/traceboard.html
- @./references/example-traceboard.md

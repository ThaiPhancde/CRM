---
name: roadmap
description: Dùng khi cần dựng lộ trình sản phẩm — ưu tiên các feature (RICE-lite) rồi xếp vào Now/Next/Later (hoặc theo quý) + bản đồ phụ thuộc. Đọc Feature Map từ `docs/_product/prd.md`. Kích hoạt bằng `/roadmap` hoặc `/roadmap --format quarters`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "(empty = Now/Next/Later) | --format quarters"
---

# /roadmap — Product Roadmap (RICE-lite + Now/Next/Later)

## Goal

Dựng **lộ trình sản phẩm** (project-level, singleton) tại `docs/_product/roadmap.md` — ưu tiên các feature bằng **RICE-lite** (Reach / Impact / Confidence / Effort) rồi xếp vào **horizon** (Now / Next / Later — mặc định, hoặc theo **quý**) kèm **Dependency Map** (feature nào chặn feature nào). Nguồn feature: **Feature Map của `docs/_product/prd.md`** (đọc 1 chiều).

Roadmap trả lời "**làm gì trước, gì sau, và vì sao**" — ưu tiên minh bạch qua điểm số, không cảm tính.

## Constraints

- **Project-level (nhóm C).** Không cần feature.
- **Nguồn = Feature Map của `docs/_product/prd.md`.** Chưa có PRD sản phẩm → **friendly message + route `/prd`** (nhóm C không refuse cứng, nhưng roadmap cần Feature Map làm nguồn feature): "Chưa có `docs/_product/prd.md` — chạy `/prd` để lập Feature Map trước, rồi `/roadmap` ưu tiên." Có thể vẫn dựng roadmap từ danh sách feature user cung cấp thẳng nếu user muốn.
- **Đọc 1 chiều từ Feature Map** — roadmap KHÔNG sửa PRD. PRD đổi → chạy lại `/roadmap` để đồng bộ (roadmap KHÔNG tự nhận OQ cascade từ PRD — xem `resolve-oqs.md`).
- **Singleton** — 1 `docs/_product/roadmap.md`. Đã có → update mode (Read full, L2 diff).
- **L1 approval** trước Write. **L2 diff** khi update.
- **RICE-lite minh bạch** — mỗi feature có Reach/Impact/Confidence/Effort (thang gợi ý bên dưới) → **Score = (Reach × Impact × Confidence) / Effort**. Điểm chưa chắc → dùng thang thô + đánh dấu "ước lượng", KHÔNG bịa độ chính xác giả.
- **Horizon rõ ràng** — Now (đang/sắp làm), Next (kế tiếp), Later (chưa lên lịch). Hoặc `--format quarters` (Q1/Q2/…). Xếp horizon dựa **điểm RICE + phụ thuộc**, không tùy hứng.
- **Dependency Map** — feature A chặn B thì B không thể ở horizon sớm hơn A; roadmap phải nhất quán với phụ thuộc.
- **Doc sạch — KHÔNG meta-text** (`ba-conventions.md` Mục 0). Frontmatter `type: roadmap` / `status` / `updated` / `format` / `links`. **Vietnamese-first**.
- **KHÔNG feature-detail** — roadmap chỉ ưu tiên + xếp lịch cấp feature, KHÔNG mô tả flow.

## RICE-lite — thang gợi ý (business-level, không cần số tuyệt đối)

| Yếu tố | Nghĩa | Thang gợi ý |
|---|---|---|
| **Reach** | Bao nhiêu người dùng/lần dùng bị ảnh hưởng mỗi kỳ | 1 (ít) · 2 · 3 · 5 · 8 (rất nhiều) |
| **Impact** | Tác động lên mục tiêu/người dùng | 0.5 (nhẹ) · 1 · 2 · 3 (rất lớn) |
| **Confidence** | Độ chắc chắn về ước lượng | 50% · 80% · 100% |
| **Effort** | Công sức (person-week ước lượng) | số ≥ 0.5 |

> Score = (Reach × Impact × Confidence) / Effort. Cao hơn = ưu tiên hơn. Thang là **gợi ý team**, user chỉnh được — mục đích là **so sánh tương đối** minh bạch, không phải con số tuyệt đối.

## Inputs

```
/roadmap                      # RICE-lite + Now/Next/Later (mặc định)
/roadmap --format quarters    # xếp theo quý thay vì Now/Next/Later
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
PRD sản phẩm (nguồn Feature Map)? !`[ -f docs/_product/prd.md ] && echo "có" || echo "chưa — cần /prd"`
Roadmap? !`[ -f docs/_product/roadmap.md ] && echo "docs/_product/roadmap.md (update mode)" || echo "chưa — tạo mới"`

## Approach

### Phase A — Readiness + resolve (silent)

1. **Nguồn Feature Map.** `docs/_product/prd.md` tồn tại → Read, trích bảng Feature Map (feature slug, theme, ưu tiên P0/P1/P2, mô tả). Không có → friendly message route `/prd` (hoặc nhận danh sách feature user dán thẳng nếu user chọn dựng nhanh).
2. **Update mode?** `roadmap.md` tồn tại → Read full (no-re-ask): giữ điểm RICE user đã chỉnh, chỉ cập nhật feature mới/đổi.
3. **Format** từ arg (`--format quarters`) hoặc frontmatter roadmap cũ; mặc định Now/Next/Later.

### Phase B — Score + sequence

4. **Chấm RICE-lite** mỗi feature (thang gợi ý). Ưu tiên P0/P1/P2 của Feature Map là đầu vào Impact/Confidence, KHÔNG thay thế điểm. Điểm chưa chắc → hỏi user 1 batch gọn (Reach/Impact/Effort ước lượng) hoặc để thang thô + đánh dấu.
5. **Detect phụ thuộc** — feature nào cần feature khác trước (vd "thanh toán" cần "đặt món"; "đánh giá" cần "giao đơn"). Dựng Dependency Map. **Ràng buộc**: B phụ thuộc A → B không ở horizon sớm hơn A.
6. **Xếp horizon** theo điểm RICE giảm dần + tôn trọng phụ thuộc: top → Now, kế → Next, còn lại → Later (hoặc map vào quý nếu `--format quarters`).

### Phase C — Compose

7. **`docs/_product/roadmap.md`** theo `_templates/roadmap.md`:
   - **Prioritization (RICE-lite)** — bảng: `Feature | Theme | Reach | Impact | Confidence | Effort | Score | Ưu tiên`.
   - **Horizons** — Now / Next / Later (hoặc Q1/Q2/…): mỗi horizon list feature + lý do 1 dòng (điểm cao / là nền cho feature khác / chờ phụ thuộc).
   - **Dependency Map** — bảng hoặc list: `A → B` (A chặn B) + rationale. (Có thể gợi ý dùng `/d2-architect` hoặc mermaid nếu phụ thuộc phức tạp — nhưng roadmap giữ dạng bảng/list, KHÔNG tự vẽ diagram.)
   - **Legend** — giải thích horizon Now/Next/Later + thang RICE (chú giải người-đọc-cần, được phép per `ba-conventions.md` Mục 0).

### Phase D — Quality gate + (optional) review

8. Self-check (fail → in gap):
   - [ ] Mọi feature trong Feature Map (P0/P1) đều có điểm RICE + horizon.
   - [ ] Horizon nhất quán với Dependency Map (không feature nào đứng trước thứ nó phụ thuộc).
   - [ ] Score tính đúng công thức; điểm ước lượng được đánh dấu.
   - [ ] Now không quá tải (số feature Now hợp lý với năng lực — nếu user cho biết).
9. **Product-Reviewer gate (CHỈ khi vượt ngưỡng)** — **≥10 feature** HOẶC có **vòng phụ thuộc/nghi ngờ thứ tự** → spawn `product-reviewer` (lens PM: sequencing/dependency/over-commit). BLOCKING → sửa, loop ≤2. Dưới ngưỡng → self-check đủ.

### Phase E — Approval + Write

10. **L1 plan preview** (prose BA-friendly):
    > Em sẽ {tạo mới | cập nhật} `docs/_product/roadmap.md` (format {Now/Next/Later | quarters}):
    > - Chấm RICE-lite {F} feature; Now {n1} · Next {n2} · Later {n3}.
    > - {D} quan hệ phụ thuộc; top ưu tiên: {feature list}.
    >
    > Apply? (Y / sửa)
11. **Set env trước Write**: `CLAUDE_SKILL_NAME=/roadmap` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `roadmap: {F} feature, Now {n1}`). Write (L2 diff nếu update).

12. **Output report:**
    ```
    ✅ Product roadmap: docs/_product/roadmap.md ({format})
       Now {n1} · Next {n2} · Later {n3} | Phụ thuộc: {D} | Top: {feature}

    Recommended next:
      - /brainstorm <feature Now>   — bắt đầu chi tiết hóa feature ưu tiên cao nhất
      - /prd                        — cập nhật Feature Map nếu ưu tiên đổi (rồi chạy lại /roadmap)
    ```

## Gotchas

- **Thiếu PRD → thiếu nguồn** — roadmap cần Feature Map; chưa có `/prd` thì route `/prd` (hoặc nhận list feature user dán thẳng cho bản nháp nhanh).
- **Đọc 1 chiều** — roadmap KHÔNG sửa PRD. Ưu tiên đổi ở roadmap không tự ghi ngược Feature Map; muốn đồng bộ → sửa `/prd` rồi chạy lại `/roadmap`.
- **Horizon phạm phụ thuộc** — đừng để feature phụ thuộc nằm ở Now trong khi thứ nó cần ở Later. Self-check bước 8 bắt lỗi này.
- **RICE giả chính xác** — thang là tương đối; điểm ước lượng phải đánh dấu, KHÔNG trưng con số như thể đo đạc thật.
- **Now quá tải** — nhồi hết P0 vào Now là red flag; hỏi năng lực team nếu có, hoặc cảnh báo.
- **Update mode** — giữ điểm RICE user đã chỉnh tay (no-re-ask), chỉ thêm feature mới; L2 diff.
- **@author** — memory `user-identity`; frontmatter KHÔNG owner/feature.

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
- @../../../_templates/roadmap.md
- @./references/example-roadmap.md
- @../../agents/product-reviewer.md

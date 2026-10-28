---
name: discover
description: Dùng khi cần khám phá 1 ý tưởng SẢN PHẨM (chưa có feature) — làm rõ vấn đề, người dùng mục tiêu, giá trị, bối cảnh thị trường, mục tiêu và rủi ro trước khi viết PRD sản phẩm. Kích hoạt bằng `/discover <mô tả ý tưởng sản phẩm>` hoặc `/discover @<file>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
argument-hint: "<mô tả ý tưởng sản phẩm> | @<file> | (empty để phỏng vấn)"
---

# /discover — Product Discovery (khám phá sản phẩm)

## Goal

Biến 1 **ý tưởng sản phẩm thô** thành **product discovery brief** có cấu trúc: làm rõ **vấn đề & cơ hội**, **người dùng mục tiêu + jobs-to-be-done**, **giá trị đề xuất**, **bối cảnh thị trường/giải pháp thay thế** (mức nghiệp vụ, KHÔNG kỹ thuật), **mục tiêu + tín hiệu thành công**, **các mảng tính năng ứng viên (themes)**, và **rủi ro/ẩn số**. Output duy nhất: `docs/_product/discovery.md` (singleton cấp sản phẩm). Đây là **cửa vào cấp sản phẩm** của toàn bộ BA-KIT — chạy TRƯỚC `/prd` (và trước mọi feature).

> `/discover` khác `/brainstorm`: `/discover` ở **tầng sản phẩm** (chưa có feature — khám phá "sản phẩm này giải vấn đề gì cho ai"); `/brainstorm` ở **tầng feature** (đào sâu 1 tính năng cụ thể: luồng, số liệu, wording).

## Constraints

- **Project-level (nhóm C).** Trạng thái "chưa có feature nào" là **hợp lệ** — đây là greenfield exploration, KHÔNG refuse, KHÔNG cần feature slug (xem `feature-bootstrap.md` nhóm C).
- **L1 approval** trước Write. **L2 diff** khi `docs/_product/discovery.md` đã tồn tại (update mode tự động — bồi đắp discovery, không viết đè mù).
- **Singleton** — 1 sản phẩm = 1 `docs/_product/discovery.md`. KHÔNG tạo nhiều bản.
- **Phỏng vấn theo phần, hỏi từng phần một** — KHÔNG dồn batch 10 câu. Wait reply giữa các phần. User `skip` phần bất kỳ → `<!-- TBD -->` + open question.
- **Product/business framing — KHÔNG technical, KHÔNG feature-detail.** ĐƯỢC hỏi: vấn đề gì, ai đau, giá trị gì, đối thủ/thay thế hiện tại, mục tiêu kinh doanh, tín hiệu thành công. CẤM hỏi: schema/endpoint/framework (như mọi BA skill), VÀ CẤM đào sâu luồng/validation/wording 1 tính năng (đó là việc `/brainstorm` + `/prd-epic` sau này). Tính năng ở đây chỉ nêu **tên mảng (theme)**, không mô tả chi tiết.
- **Push cho cụ thể** — "ai dùng" phải ra segment cụ thể (không "mọi người"); "thành công" phải ra tín hiệu đo được (không "sản phẩm tốt"). Vague → re-ask 1 lần → vẫn vague → TBD + OQ. **KHÔNG bịa** số liệu thị trường/mục tiêu.
- **No-re-ask** — quét idea seed + câu trả lời trước + discovery.md có sẵn (update mode) → chỉ hỏi phần thiếu.
- **Doc sạch — KHÔNG meta-text** (`ba-conventions.md` Mục 0). **Vietnamese-first** (auto-detect từ idea).
- **KHÔNG nhảy thẳng PRD** — discovery là checkpoint riêng; sau khi chốt mới route `/prd`.
- **Keyword-detection** (`keyword-detection.md`) khi input là notes/@file thô → trích tín hiệu (vấn đề, user, mục tiêu) + confidence, show preview trước khi tổng hợp.

## Inputs

```
/discover                                  # interactive: hỏi ý tưởng sản phẩm
/discover <mô tả ý tưởng sản phẩm>          # ý tưởng inline
/discover @<file>                          # ý tưởng từ file (brief, market notes, pitch deck text)
```

Examples:
```
/discover app đặt & giao đồ ăn cho người bận rộn ở thành phố
/discover @notes/product-idea.md
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Đã có discovery? !`[ -f docs/_product/discovery.md ] && echo "docs/_product/discovery.md (update mode)" || echo "chưa — tạo mới"`
Đã có PRD sản phẩm? !`[ -f docs/_product/prd.md ] && echo "có" || echo "chưa"`

## Approach

### Phase A — Resolve source (silent)

1. **Resolve idea source:** no arg → hỏi "Ý tưởng sản phẩm là gì? (mô tả hoặc `@file`)". Arg `@file` → Read (notes/brief; áp keyword-detection trích tín hiệu). Else → arg as text.
2. **Update mode:** `docs/_product/discovery.md` tồn tại → Read full trước phỏng vấn (no-re-ask), chỉ hỏi phần còn TBD/thiếu.
3. **Detect language** từ idea.

### Phase B — Interview (6 phần, one-at-a-time)

> Mỗi phần: 1 message, 2-4 câu hỏi, wait reply. Push cho cụ thể. Product/business level.

**Phần 1 — Vấn đề & cơ hội**
1. Sản phẩm này là gì (1-2 câu)? Giải quyết **vấn đề/pain** cụ thể nào?
2. Ai đang chịu vấn đề đó? Hiện họ xoay xở ra sao (workaround)?
3. Why now — vì sao thời điểm này (thay đổi thị trường, hành vi, công nghệ, quy định)?

**Phần 2 — Người dùng mục tiêu & jobs-to-be-done**
1. Các **segment người dùng** chính (mô tả cụ thể, không "mọi người")?
2. Với mỗi segment: **jobs-to-be-done** (họ muốn "thuê" sản phẩm để hoàn thành việc gì)?
3. Pains lớn nhất + gains mong đợi của họ?

**Phần 3 — Bối cảnh thị trường & giải pháp thay thế** (business-level)
1. Hiện có **giải pháp/đối thủ/cách thay thế** nào? Điểm yếu của chúng?
2. **Điểm khác biệt** giả định của sản phẩm (why us)?
3. Có ràng buộc thị trường/khu vực/quy định đáng chú ý không?

**Phần 4 — Giá trị & mục tiêu**
1. **Value proposition** 1 câu (cho segment chính)?
2. **Mục tiêu kinh doanh** (doanh thu, tăng trưởng, giữ chân, thị phần…) — định tính OK ở giai đoạn này?
3. **Tín hiệu thành công** đo được (bắc bao nhiêu, dùng lại bao nhiêu…) — số nào chưa có thì đánh OQ, KHÔNG bịa.

**Phần 5 — Mảng tính năng (themes) & phạm vi**
1. Các **mảng tính năng ứng viên** (theme cấp cao — vd "đặt món", "thanh toán", "giao vận", "đánh giá") — chỉ tên mảng, KHÔNG mô tả chi tiết flow.
2. Mảng nào là **cốt lõi (P0)** cho phiên bản đầu?
3. Điều gì **ngoài phạm vi** (non-goals) rõ ràng ở giai đoạn này?

**Phần 6 — Rủi ro & ẩn số**
1. Top 3 **rủi ro** (thị trường/adoption/khả thi-nghiệp vụ/vendor/compliance/timeline)? Khả năng + hậu quả?
2. Giả định lớn nào **chưa được kiểm chứng** (riskiest assumption)?
3. Còn ẩn số/câu hỏi mở nào → liệt kê thành open questions?

### Phase C — Synthesize + Quality gate

4. **Tổng hợp** câu trả lời → dựng các section theo `_templates/discovery.md`:
   Pitch 1 câu · Vấn đề & cơ hội · Segment + JTBD · Bối cảnh & khác biệt · Value proposition · Mục tiêu + tín hiệu thành công · Themes (bảng: theme · mô tả 1 dòng · ưu tiên gợi ý) · Non-goals · Rủi ro (Khả năng/Hậu quả/Cách giảm) · Assumptions cần kiểm chứng · Open Questions (ID `OQ-N`).
5. **Quality checklist** (fail → in gap + đề xuất hỏi thêm):
   - [ ] Segment cụ thể (không "mọi người") + JTBD rõ.
   - [ ] Value proposition 1 câu súc tích.
   - [ ] Tín hiệu thành công đo được (hoặc OQ nếu chưa có số).
   - [ ] Themes là **mảng cấp cao** (không sa vào flow/validation chi tiết).
   - [ ] Rủi ro dùng framing sản phẩm (market/adoption/vendor/compliance/timeline).
   - [ ] Riskiest assumption được nêu rõ.
   - [ ] Open questions có ID `OQ-N`.

### Phase D — Approval + Write

6. **L1 plan preview** (prose BA-friendly, `ba-conventions.md` Mục 5):
   > Em sẽ {tạo mới | cập nhật} `docs/_product/discovery.md`:
   > - Pitch: "{1 câu}"; {N} segment + JTBD; value proposition; {M} theme ({P0 count} cốt lõi).
   > - Mục tiêu + {K} tín hiệu thành công; {R} rủi ro; {A} giả định cần kiểm chứng.
   > - Còn {Q} câu hỏi mở.
   >
   > Apply? (Y / sửa)
7. **Set env trước Write**: `CLAUDE_SKILL_NAME=/discover` + `CLAUDE_CHANGELOG_AUTHOR={@author}` + `CLAUDE_CHANGELOG_NOTE` (vd `discovery brief: {N} segment, {M} theme`). Write `docs/_product/discovery.md` (tạo `docs/_product/` nếu chưa có).

### Phase E — Resolve Open Questions (per `resolve-oqs.md`)

8. `/discover` là gốc cấp sản phẩm → chỉ own OQs (không inherit). Collect → prompt Y/skip/ids → loop 1-by-1 → cascade scan (Segment/Value/Themes/Risks/Assumptions nếu OQ tác động) → L2 diff → activity log qua hook.

9. **Output report:**
   ```
   ✅ Product discovery: docs/_product/discovery.md
      Segments: {N} | Themes: {M} ({P0} cốt lõi) | Rủi ro: {R} | OQ: resolved {r}/{n}, hold {m}

   Recommended next:
     - /prd      — dựng PRD sản phẩm (pitch/users/goals/Feature Map) từ discovery này
     - /discover — bổ sung/khám phá thêm (update mode)
   ```

## Gotchas

- **Sa vào feature-detail** — user bắt đầu kể luồng/validation 1 tính năng → kéo lại tầng sản phẩm ("mình ghi nhận mảng này, chi tiết flow để `/brainstorm` sau"). Discovery chỉ nêu **tên theme**.
- **"Mọi người" là red flag** — ép ra segment cụ thể; không có segment thì sản phẩm chưa rõ ai dùng.
- **Bịa số thị trường** — TAM/SAM/tăng trưởng chưa có nguồn → đánh OQ, KHÔNG chế số.
- **Nhảy thẳng PRD** — discovery là checkpoint; chốt xong mới `/prd`.
- **Update mode viết đè** — discovery.md đã có → Read full, chỉ bồi đắp phần thiếu (no-re-ask), L2 diff.
- **@author** — memory `user-identity` (`ba-conventions.md` Mục 1), KHÔNG owner trong frontmatter.
- **@file thô (pitch deck/notes)** — áp keyword-detection, show preview confidence trước khi tổng hợp; low-confidence → hỏi xác nhận.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/keyword-detection.md
- @../../../_templates/discovery.md
- @./references/example-discovery.md

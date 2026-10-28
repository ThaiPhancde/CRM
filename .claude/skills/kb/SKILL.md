---
name: kb
description: Dùng khi cần soạn bài Cơ sở tri thức (Knowledge Base) — bài how-to/troubleshooting sâu cho CSKH/support agent theo cấu trúc Symptom → Cause → Resolution → Related, bám SRS/Error Matrix. KHÔNG bịa cách xử lý. Kích hoạt bằng `/kb <feature | chủ đề | all>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature | chủ đề sự cố | all>"
---

# /kb — Bài Cơ sở tri thức (Knowledge Base)

## Goal

Soạn **bài KB** tại `docs/kb/{slug}.md` (1 file/bài) + cập nhật `docs/kb/kb-index.md` (master metadata): bài **how-to / troubleshooting sâu** cho **CSKH / support agent** (chi tiết hơn FAQ), theo cấu trúc:
- **Symptom** (biểu hiện người dùng gặp — thường gắn `E-*` wording exact).
- **Cause** (nguyên nhân nghiệp vụ — bám BR/FR, KHÔNG suy diễn kỹ thuật).
- **Resolution** (các bước xử lý, theo vai: user tự làm / CSKH thao tác / escalate).
- **Related** (bài KB / FAQ / FR liên quan).

## Constraints

- **Nhóm B — cần nguồn thật** (`feature-bootstrap.md`): `srs/{feature}-spec.md` (Error Matrix + BR + FR), tốt hơn có user guide + FAQ. Thiếu → **refuse + route `/srs`** (rồi `/faq`). KHÔNG tự bịa bài.
- **KHÔNG BỊA cách xử lý** — Resolution bám BR/FR/Error Matrix + quy trình thật. Bước CSKH (hoàn tiền, hủy đơn) theo BR (vd hoàn 3–5 ngày, chỉ hủy khi Chờ xác nhận). Chưa có quy trình (vd OQ-2 giao thất bại) → ghi rõ "quy trình đang chốt (OQ-2)", KHÔNG chế bước.
- **Symptom = ngôn ngữ người dùng thật** (wording lỗi exact từ `E-*`), Cause/Resolution có thể chuyên hơn (dành support) nhưng **KHÔNG kỹ thuật DB/endpoint** — nghiệp vụ.
- **1 bài = 1 sự cố/tác vụ** — slug rõ (`order-stuck-preparing`, `refund-not-received`). Không gộp nhiều sự cố 1 bài.
- **kb-index là nguồn metadata** (`naming-conventions.md`) — bảng bài (slug/tiêu đề/feature/loại/status/updated). Bài `{slug}.md` slim frontmatter.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **Reviewer gate** khi lớn (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Bài type `kb-article`, index type `kb-index`.

## Inputs

```
/kb food-delivery                 # sinh bộ bài KB cho các sự cố chính của feature
/kb "đơn kẹt ở Đang chuẩn bị"     # 1 bài cho 1 sự cố cụ thể
/kb all                           # rà toàn vault, đề xuất bài KB còn thiếu
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
KB index: !`[ -f docs/kb/kb-index.md ] && echo "có" || echo "chưa có"`
Bài KB hiện có: !`ls docs/kb/*.md 2>/dev/null | grep -v kb-index | xargs -n1 basename 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve scope** (feature / chủ đề / all). Thiếu spec → refuse + route `/srs` (nhóm B). Chủ đề cụ thể → 1 bài; feature → bộ bài cho các sự cố chính; all → rà + đề xuất bài thiếu.
2. **Update mode?** kb-index tồn tại → Read (no-re-ask), giữ bài cũ còn đúng, chỉ thêm/sửa bài cần.
3. **Gather nguồn:** Error Matrix (symptom + wording) · BR (điều kiện/ngưỡng cho Resolution) · FR/use case (luồng) · FAQ (`docs/faq/`) + user guide nếu có (Related).
   > *Tăng tốc:* `kg facts {feature}` liệt kê E/BR/FR; nội dung đọc prose (`kg-usage.md`).

### Phase B — Dựng bài

4. **Chọn sự cố/tác vụ đáng có bài** — ưu tiên `E-*` user hay gặp + tác vụ CSKH hay xử lý (hủy/hoàn/khiếu nại). 1 sự cố = 1 bài, slug rõ.
5. **Mỗi bài:** Symptom (wording exact) → Cause (BR/FR) → Resolution (bước theo vai, bám quy trình thật) → Related (FR/FAQ/bài khác). Quy trình chưa chốt → nêu OQ, không chế.
6. **Cập nhật kb-index** (bảng bài + metadata).

### Phase C — Quality gate

7. **Self-check:** Symptom bám `E-*` (wording exact); Cause/Resolution bám BR/FR (không kỹ thuật, không chế); 1 bài 1 sự cố; slug rõ; index khớp danh sách bài; quy trình thiếu được đánh OQ.
8. **Handover-Reviewer gate (CHỈ khi ≥8 bài HOẶC feature nhạy cảm payment/auth)** — spawn `handover-reviewer` (Task, lens support lead: Resolution có bám quy trình/BR không, có bịa bước không, Symptom đúng wording không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write

9. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} {N} bài KB trong `docs/kb/` + cập nhật `kb-index.md`: {list slug + sự cố}. Mỗi bài Symptom→Cause→Resolution→Related, bám {E}/{BR}. {K} bài có bước chờ quy trình (OQ). Apply?
10. **Set env trước Write** (`CLAUDE_SKILL_NAME=/kb` + author + note vd `KB: {N} bài`). Write bài + index.

### Phase E — Resolve OQ + report

11. **resolve-oqs Phase E** — inherited từ SRS (quy trình thiếu, vd OQ-2). L2 diff nếu cập nhật.
12. **Report:**
    ```
    ✅ KB `{scope}`: {N} bài trong docs/kb/ (index: kb-index.md)
       {list slug} | Nguồn: {E} error · {BR} rule | Reviewed: {y/n}
    Tiếp: /faq {feature} (Q&A ngắn) · /confluence publish (đăng KB) · /export
    ```

## Gotchas

- **Bịa bước xử lý** — CẤM; Resolution bám BR/FR/quy trình thật. Quy trình chưa chốt → OQ, không chế.
- **Kỹ thuật hóa** ("restart service", "query DB") — SAI; KB nghiệp vụ, theo vai người xử lý.
- **Gộp nhiều sự cố 1 bài** — khó tra; 1 bài 1 sự cố, slug rõ.
- **Symptom sai wording** — trích exact từ Error Matrix.
- **Quên cập nhật kb-index** — index là nguồn metadata, phải khớp danh sách bài.
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
- @../../rules/agent-conventions.md
- @../../rules/kg-usage.md
- @../../../_templates/kb-article.md
- @./references/example-kb.md
- @../../agents/handover-reviewer.md

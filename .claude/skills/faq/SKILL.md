---
name: faq
description: Dùng khi cần soạn FAQ (câu hỏi thường gặp) cho end-user hoặc CSKH — sinh cặp Q&A bám Error Matrix (wording exact), Business Rules và luồng nghiệp vụ của feature. KHÔNG bịa câu trả lời. Kích hoạt bằng `/faq <feature | all>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature | all>"
---

# /faq — Câu hỏi thường gặp (FAQ)

## Goal

Soạn **FAQ** tại `docs/faq/{feature}-faq.md` (theo feature) hoặc `docs/faq/faq.md` (toàn sản phẩm): các **cặp Q&A ngắn** cho **end-user / CSKH**, nhóm theo chủ đề. Mỗi câu trả lời **bám nguồn thật**:
- Từ **Error Matrix** (`E-*`): mỗi lỗi user hay gặp → "Vì sao tôi thấy '{wording}'?" + cách xử lý.
- Từ **Business Rules** (`BR-*`): ngưỡng/điều kiện nghiệp vụ ("Đơn tối thiểu bao nhiêu?", "Bao lâu được hoàn tiền?").
- Từ **luồng chính** (FR/use case): thao tác thường gặp ("Làm sao hủy đơn?").

## Constraints

- **Nhóm B — cần nguồn thật** (`feature-bootstrap.md`): `srs/{feature}-spec.md` (Error Matrix + BR + FR). Thiếu → **refuse + route `/srs {feature}`**. KHÔNG tự bịa Q&A.
- **KHÔNG BỊA câu trả lời** — mỗi answer trace về `E-*`/`BR-*`/`FR-*`. Wording lỗi trích **exact** từ Error Matrix. Số/ngưỡng trích từ BR. Thiếu dữ liệu (vd timeout OQ-1) → **KHÔNG chế**, hoặc bỏ câu đó, hoặc ghi "đang cập nhật" + đánh dấu.
- **Ngôn ngữ end-user** — câu hỏi như user thật hỏi ("Sao tôi không đặt được đơn?"), trả lời thân thiện, KHÔNG ID nội bộ (`FR-*`/`E-*`) trong body FAQ (ID chỉ để trace, có thể để ở comment/cột nguồn ẩn hoặc frontmatter links). CẤM thuật ngữ kỹ thuật (endpoint/DB).
- **Nhóm theo chủ đề** (Đặt hàng · Thanh toán · Giao hàng · Hoàn/hủy · Đánh giá…) — dễ tra.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **Reviewer gate** khi lớn (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: faq` + `scope` + `links` (trace về spec).

## Inputs

```
/faq food-delivery          # FAQ cho 1 feature (từ Error Matrix + BR + FR)
/faq all                    # FAQ toàn sản phẩm (gộp nhiều feature theo chủ đề)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
FAQ đã có: !`ls docs/faq/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve scope.** Thiếu spec → refuse + route `/srs` (nhóm B). Update mode? FAQ tồn tại → Read full (no-re-ask), giữ Q&A cũ còn đúng.
2. **Gather nguồn:** Error Matrix (điều kiện + wording exact + hệ quả) · Business Rules (ngưỡng) · FR chính (thao tác) · user guide nếu có (`docs/userguide/`). Số chưa chốt (OQ) → đánh dấu, không chế.
   > *Tăng tốc:* `kg facts {feature}` liệt kê E/BR/FR; nội dung đọc prose (`kg-usage.md`).

### Phase B — Sinh Q&A

3. **Mỗi `E-*` user-facing → 1 Q&A** ("Vì sao tôi thấy '{wording exact}'?" → giải thích điều kiện + cách xử lý theo hệ quả).
4. **Mỗi `BR-*` có ngưỡng → 1 Q&A** ("Đơn tối thiểu bao nhiêu?" → "{ngưỡng từ BR}").
5. **Thao tác chính (FR/use case) → Q&A how-to ngắn** ("Làm sao hủy đơn?" → điều kiện BR + các bước).
6. **Nhóm theo chủ đề**, sắp câu hay gặp lên trên.

### Phase C — Quality gate

7. **Self-check:** mọi answer có nguồn (E/BR/FR) thật; wording lỗi exact; không lộ ID/thuật ngữ kỹ thuật trong body; không có câu bịa; số chưa chốt được đánh dấu, không chế.
8. **Handover-Reviewer gate (CHỈ khi ≥20 Q&A HOẶC feature nhạy cảm payment/auth)** — spawn `handover-reviewer` (Task, lens support lead: answer có bám nguồn không, wording lỗi đúng không, có câu bịa/mâu thuẫn spec không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write

9. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `docs/faq/{scope}-faq.md`: {N} câu hỏi trong {T} chủ đề, bám {E} lỗi (wording exact) + {B} business rule + {F} thao tác. {K} câu chờ số liệu (OQ). Apply?
10. **Set env trước Write** (`CLAUDE_SKILL_NAME=/faq` + author + note vd `FAQ: {N} câu / {T} chủ đề`). Write.

### Phase E — Report

11. **Report:**
    ```
    ✅ FAQ `{scope}`: docs/faq/{scope}-faq.md
       {N} câu / {T} chủ đề | Nguồn: {E} error · {B} BR · {F} FR | Reviewed: {y/n}
    Tiếp: /kb {feature} (bài troubleshooting sâu) · /confluence publish · /export
    ```

## Gotchas

- **Bịa câu trả lời** — CẤM; mỗi answer bám `E-*`/`BR-*`/`FR-*`. Thiếu số → đánh dấu, không chế.
- **Sai wording lỗi** — trích exact từ Error Matrix (user tra đúng câu họ thấy).
- **Lộ ID nội bộ/thuật ngữ kỹ thuật trong body** — FAQ là end-user; ID để trace ở links/comment.
- **FAQ mâu thuẫn spec** — nếu spec đổi, chạy lại (update mode) để đồng bộ.
- **Sai chỗ** — `docs/faq/`.
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
- @../../../_templates/faq.md
- @./references/example-faq.md
- @../../agents/handover-reviewer.md

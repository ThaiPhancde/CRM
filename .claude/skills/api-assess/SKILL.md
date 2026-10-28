---
name: api-assess
description: Dùng khi cần đánh giá build-vs-buy hoặc chọn nhà cung cấp API cho một nhu cầu tích hợp (cổng thanh toán, SMS, map…) — scorecard nghiệp vụ (chi phí, độ phủ, tin cậy, chất lượng doc, tuân thủ, khóa nhà cung cấp) + khuyến nghị. Kích hoạt bằng `/api-assess <feature | nhu cầu tích hợp>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature> | <nhu cầu tích hợp + các ứng viên>"
---

# /api-assess — Đánh giá build-vs-buy / chọn nhà cung cấp

## Goal

Viết **scorecard đánh giá** tại `docs/{feature}/integration/api-assess.md`: nên **tự xây hay mua/tích hợp** dịch vụ ngoài, và nếu mua thì **chọn nhà cung cấp nào**. Đây là bước **[0] có điều kiện** của họ tích hợp — chỉ chạy khi chưa chốt vendor. So sánh ứng viên trên tiêu chí **nghiệp vụ**:
- **Chi phí** (phí giao dịch/tháng, phí ẩn), **Độ phủ** (đúng nhu cầu nghiệp vụ chưa), **Độ tin cậy/SLA**, **Chất lượng tài liệu & sandbox**, **Tuân thủ** (PCI/PDPA/pháp lý), **Khóa nhà cung cấp** (lock-in, khó thay), **Thời gian tích hợp**.
- Kết quả: bảng điểm + **khuyến nghị** + rủi ro + điều kiện tiên quyết.

## Constraints

- **Nhóm B — cần biết nhu cầu tích hợp** (`feature-bootstrap.md`): thường từ SRS Mục 7 External Interfaces (vd "Cổng thanh toán"). Chưa có feature/nhu cầu → **refuse + route `/srs {feature}`** (khai báo external interface trước). KHÔNG tự bịa nhu cầu.
- **Tiêu chí NGHIỆP VỤ, không kỹ thuật sâu** (`api-integration.md` + `ba-conventions.md`): so sánh giá trị/chi phí/tin cậy/tuân thủ — KHÔNG bàn SDK/thư viện/kiến trúc code. IT-BA giúp ra **quyết định mua**, không code.
- **KHÔNG bịa số** — phí/SLA/giới hạn lấy từ **trang giá/doc chính thức của vendor** (ghi nguồn). Chưa có → OQ, không chế. So sánh "táo với táo".
- **Không thiên vị** — nêu điểm yếu của cả lựa chọn được khuyến nghị. Khuyến nghị kèm **điều kiện** (vd "chọn A nếu ưu tiên chi phí; B nếu ưu tiên phủ quốc tế").
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **Reviewer gate** khi ≥3 ứng viên / feature nhạy cảm (payment) — spawn `api-reviewer`.
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-assess`.

## Inputs

```
/api-assess food-delivery                          # đánh giá tích hợp từ External Interfaces của SRS
/api-assess "cổng thanh toán: VNPay vs Momo vs Stripe"   # so sánh ứng viên cụ thể
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có SRS (External Interfaces): !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Integration đã có: !`for d in docs/*/integration/; do [ -d "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather nhu cầu

1. **Resolve feature + nhu cầu tích hợp.** Thiếu feature/nhu cầu → refuse + route `/srs`. Đọc SRS Mục 7 (External Interfaces) + FR/NFR/BR liên quan (vd FR-thanh-toán, NFR bảo mật, BR ngưỡng).
2. **Xác định ứng viên** (từ arg hoặc hỏi user). Không rõ → hỏi 2-3 ứng viên phổ biến cho loại dịch vụ đó.

### Phase B — Thu thập tiêu chí (từ nguồn thật)

3. **Điền scorecard** mỗi ứng viên trên các tiêu chí nghiệp vụ. Số liệu (phí/SLA/giới hạn/tuân thủ) trích từ trang giá/doc chính thức + ghi nguồn. Thiếu → OQ.

### Phase C — Chấm điểm + khuyến nghị + gate

4. **Chấm điểm có trọng số** (trọng số theo ưu tiên nghiệp vụ của feature — hỏi user nếu chưa rõ). Nêu điểm mạnh/yếu từng ứng viên.
5. **Khuyến nghị kèm điều kiện** + rủi ro + điều kiện tiên quyết (hợp đồng, KYC, sandbox).
6. **api-reviewer gate (khi ≥3 ứng viên HOẶC payment/auth)** — spawn Task (lens: tiêu chí có nghiệp vụ không, số có nguồn không, có thiên vị không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write

7. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `integration/api-assess.md`: so sánh {N} nhà cung cấp cho {nhu cầu} trên {tiêu chí}, khuyến nghị {X} (điều kiện …). {Q} câu hỏi mở (phí/SLA chưa rõ). Apply?
8. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-assess` + author + note). Write.

### Phase E — Resolve OQ + report

9. **resolve-oqs Phase E** — OQ về số liệu/hợp đồng. L2 diff nếu cập nhật.
10. **Report:**
    ```
    ✅ API assess: docs/{feature}/integration/api-assess.md
       {N} ứng viên · khuyến nghị: {X} | OQ: {r}/{n}
    Tiếp: /api-doc {feature} (tóm tắt contract vendor đã chọn)
    ```

## Gotchas

- **Bịa phí/SLA** — CẤM; lấy từ trang giá/doc chính thức + ghi nguồn; thiếu → OQ.
- **So sánh không đồng nhất** — cùng đơn vị, cùng gói, "táo với táo".
- **Bàn kỹ thuật code/SDK** — sai vai; đây là quyết định mua nghiệp vụ.
- **Thiên vị 1 vendor** — nêu cả điểm yếu; khuyến nghị có điều kiện.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/api-integration.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../rules/agent-conventions.md
- @../../rules/kg-usage.md
- @../../../_templates/api-assess.md
- @./references/example-api-assess.md
- @../../agents/api-reviewer.md

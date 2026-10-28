---
name: api-design
description: Dùng khi cần thiết kế Integration Blueprint cho một tích hợp — orchestration (gọi API nào khi nào), state-map (trạng thái ta ↔ họ), source-of-truth, webhook vs polling, retry/timeout, reconciliation (đối soát), degraded-UX (fallback khi vendor chết). Là keystone của họ tích hợp. Kích hoạt bằng `/api-design <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature>"
---

# /api-design — Integration Blueprint (orchestrator tích hợp)

## Goal

Viết **Integration Blueprint** tại `docs/{feature}/integration/api-design.md` — **keystone** của tích hợp, đặc tả HÀNH VI tích hợp ở mức nghiệp vụ theo **7 trụ cột** (`api-integration.md` Mục 3):
1. **Orchestration** — gọi operation nào, khi nào, thứ tự trong luồng nghiệp vụ.
2. **State mapping** — trạng thái nghiệp vụ ta ↔ trạng thái/mã của vendor.
3. **Source of truth** — ai là chân lý cho từng dữ liệu.
4. **Webhook vs polling** — nhận kết quả bất đồng bộ kiểu nào; cả hai → ưu tiên + chống trùng.
5. **Retry & timeout** — gọi lại khi nào/mấy lần/backoff; timeout bao lâu = thất bại (chưa chốt → OQ).
6. **Reconciliation** — đối soát khi ta & họ lệch.
7. **Degraded UX** — vendor chậm/chết thì user thấy gì + fallback nghiệp vụ.

Là **orchestrator** của họ: sau blueprint, điều phối `/api-map` (field mapping) → `/api-checklist` → `/api-test` → `/api-readiness`.

## Constraints

- **Nhóm B — cần contract + luồng nghiệp vụ** (`feature-bootstrap.md`): `integration/api-summary.md` (từ `/api-doc`) + SRS (FR/Error Matrix/BR — luồng + lỗi + ngưỡng). Thiếu summary → refuse + route `/api-doc`; thiếu SRS → route `/srs`.
- **Đặc tả HÀNH VI, không code** (`api-integration.md`): quyết orchestration/state/retry/reconcile ở mức nghiệp vụ. KHÔNG chọn SDK/thư viện/thiết kế schema DB nội bộ.
- **State-map bám trạng thái THẬT** — trạng thái ta lấy từ SRS/`/state`; trạng thái vendor lấy từ `api-summary`. KHÔNG bịa trạng thái. Số/timeout chưa chốt → OQ (vd OQ-1 timeout thanh toán).
- **Idempotency & an toàn tiền/đơn bắt buộc** (`api-integration.md` Mục 4) — thao tác tạo giao dịch idempotent; webhook `in` chịu được nhận trùng/tới trễ; "API 200" ≠ "nghiệp vụ xong".
- **Degraded-UX bám Error Matrix** — vendor lỗi → wording exact user thấy (vd E-food-delivery-004 "Thanh toán không thành công, vui lòng thử lại hoặc chọn COD.") + fallback (COD).
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **api-reviewer gate** khi phức tạp (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-design`.

## Inputs

```
/api-design food-delivery       # dựng blueprint từ api-summary + SRS
/api-design food-delivery       # chạy lại → update (L2 diff)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có api-summary: !`for d in docs/*/integration/api-summary*.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | sort -u | tr '\n' ' '`
Feature có SRS: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
api-design đã có: !`ls docs/*/integration/api-design.md 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature.** Thiếu api-summary → refuse + route `/api-doc`; thiếu SRS → route `/srs`. Update mode? design tồn tại → Read full (no-re-ask).
2. **Gather:** operation + error semantics + webhook (api-summary) · luồng FR + Error Matrix (wording) + BR (ngưỡng) + trạng thái entity (SRS/`/state`).
   > *Tăng tốc:* `kg facts {feature}` liệt kê FR/entity/OQ; nội dung đọc prose (`kg-usage.md`).

### Phase B — Dựng blueprint (7 trụ cột)

3. **Orchestration** — vẽ trình tự gọi trong luồng (vd: tạo đơn → gọi tạo giao dịch → chờ webhook → cập nhật đơn). Có thể route `/sequence` để vẽ mermaid.
4. **State-map** bảng: trạng thái ta ↔ vendor ↔ hành động. **Source-of-truth** bảng: dữ liệu ↔ chủ.
5. **Webhook vs polling** + **retry/timeout** (timeout chưa chốt → OQ) + **reconciliation** (job đối soát, xử lý mồ côi) + **degraded-UX** (wording E-* + fallback).

### Phase C — Quality gate

6. **Self-check:** mọi operation cần có trong orchestration; state-map phủ trạng thái; source-of-truth rõ; webhook idempotent; có reconciliation + degraded-UX; số chưa chốt → OQ (không bịa).
7. **api-reviewer gate (khi ≥5 call HOẶC payment/auth HOẶC có webhook)** — spawn Task (lens tích hợp: orchestration đủ chưa, state-map kín chưa, idempotency/reconciliation có chưa, degraded-UX bám Error Matrix chưa). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write

8. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `integration/api-design.md`: {N} call orchestration, state-map {ta↔vendor}, {webhook/polling}, retry+timeout, reconciliation, degraded-UX (fallback COD). {Q} OQ (timeout…). Apply?
9. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-design` + author + note). Write.

### Phase E — Resolve OQ + orchestration menu

10. **resolve-oqs Phase E** — inherited từ SRS (OQ-1 timeout, OQ-2 giao thất bại). L2 diff.
11. **Menu điều phối:**
    ```
    ✅ Integration Blueprint: docs/{feature}/integration/api-design.md
       {N} call · state-map {M} cặp · webhook {y/n} · reconciliation {y/n} | OQ: {r}/{n}
    Tiếp: /api-map (field mapping 3 tầng) → /api-checklist → /api-test → /api-readiness
    Sơ đồ (tùy chọn): /sequence (trình tự gọi) · /state (trạng thái giao dịch)
    ```

## Gotchas

- **Bịa trạng thái/mã vendor** — lấy từ api-summary (nguồn thật); thiếu → OQ.
- **Quên degraded-UX/reconciliation** — vendor chết mà nghiệp vụ kẹt, hoặc ta/họ lệch không ai rà = bug tiền thật.
- **Coi API 200 = xong** — phải chờ trạng thái cuối/webhook.
- **Webhook không chống trùng/tới trễ** — nhận 2 lần trừ tiền 2 lần.
- **Chọn SDK/schema DB** — sai vai; đây là hành vi tích hợp nghiệp vụ.
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
- @../../../_templates/api-design.md
- @./references/example-api-design.md
- @../../agents/api-reviewer.md

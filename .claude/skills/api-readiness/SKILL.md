---
name: api-readiness
description: Dùng khi cần dựng go-live gate cho một tích hợp trước khi lên production — checklist cutover, feature flag, monitoring/alert, rollback, SLA & deprecation, secret production + bảng go/no-go quyết định phát hành. Kích hoạt bằng `/api-readiness <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature>"
---

# /api-readiness — Go-live gate tích hợp

## Goal

Viết **go-live gate** tại `docs/{feature}/integration/api-readiness.md` — điều kiện để đưa tích hợp lên production an toàn:
- **Cutover plan** — chuyển sandbox → production, thời điểm, ai làm, thứ tự.
- **Feature flag** — bật/tắt tích hợp, rollout từng phần.
- **Monitoring & alert** — theo dõi gì (tỉ lệ lỗi, thời gian phản hồi, webhook trễ), ngưỡng cảnh báo.
- **Rollback plan** — quay lui thế nào nếu lỗi (fallback nghiệp vụ, tắt flag).
- **SLA & deprecation** — cam kết vendor, xử lý khi vendor đổi/ngừng API.
- **Secret production** — key production sẵn sàng ở env, đã test.
- **Bảng Go / No-Go** — từng hạng mục ✅/❌ + quyết định cuối + người duyệt.

## Constraints

- **Nhóm B — cần bộ tích hợp** (`feature-bootstrap.md`): `integration/api-design.md` + `test/api/api-checklist.md` (tốt nhất có `api-tests.md`). Thiếu design → refuse + route `/api-design`.
- **Go/No-Go bám bằng chứng thật** — mỗi hạng mục ✅ phải có căn cứ (test pass, monitoring đã dựng, rollback đã thử). KHÔNG tick ✅ khống. Còn `.bru.todo` chưa chạy / OQ mở quan trọng → không được No-blocker.
- **Rollback + degraded-UX bắt buộc** — phải có đường lui (bám degraded-UX của api-design, vd fallback COD). Không có rollback → No-Go.
- **Secret production tách sandbox** (`api-integration.md` Mục 6) — kiểm đã trỏ env production + key production sẵn sàng, KHÔNG còn sandbox. KHÔNG in secret.
- **KHÔNG bịa trạng thái sẵn sàng** — hạng mục chưa xong → ❌ + việc cần làm, trung thực. Đây là gate an toàn tiền/đơn.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **api-reviewer gate** khi payment/auth (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-readiness`.

## Inputs

```
/api-readiness food-delivery      # go-live gate từ api-design + checklist + tests
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có api-design: !`for d in docs/*/integration/api-design.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Feature có api-tests: !`for d in docs/*/test/api/api-tests.md; do [ -f "$d" ] && basename $(dirname $(dirname $(dirname "$d"))); done | tr '\n' ' '`
api-readiness đã có: !`ls docs/*/integration/api-readiness.md 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather bằng chứng
1. **Resolve feature.** Thiếu api-design → refuse + route `/api-design`. Update mode? readiness tồn tại → Read full.
2. **Gather bằng chứng:** degraded-UX + reconciliation + retry (api-design) · trạng thái test (api-checklist/api-tests — bao nhiêu chạy được / `.bru.todo`) · OQ còn mở (SRS/design) · secret/env.

### Phase B — Dựng gate
3. **Điền 6 hạng mục** (cutover/flag/monitoring/rollback/SLA-deprecation/secret) — mỗi cái nêu trạng thái + căn cứ + việc còn thiếu.
4. **Bảng Go/No-Go** — từng hạng mục ✅/❌, liệt kê blocker (test todo, OQ tiền/đơn, chưa có rollback) → quyết định + người duyệt.

### Phase C — Quality gate
5. **Self-check:** không tick ✅ khống; blocker (todo test/OQ quan trọng/thiếu rollback) phản ánh đúng; secret production tách sandbox; degraded-UX có đường lui.
6. **api-reviewer gate (khi payment/auth)** — spawn Task (lens: ✅ có bằng chứng không, rollback/degraded có không, blocker có bị giấu không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write
7. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `integration/api-readiness.md`: 6 hạng mục go-live + bảng Go/No-Go. Hiện {G} ✅ / {N} ❌ (blocker: {…}). Kết luận: {Go/No-Go}. Apply?
8. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-readiness` + author + note). Write.

### Phase E — Resolve OQ + report
9. **resolve-oqs Phase E** — OQ chặn go-live (vd OQ-1 timeout chưa chốt). L2 diff.
10. **Report:**
    ```
    ✅ API readiness: docs/{feature}/integration/api-readiness.md
       Go/No-Go: {kết luận} | ✅ {G} · ❌ {N} (blocker: {list})
    {Nếu No-Go}: cần {việc} trước khi phát hành.
    Bàn giao: /release (ghi chú phát hành) · /export (đóng gói bộ tích hợp)
    ```

## Gotchas

- **Tick ✅ khống** — gate mất ý nghĩa; mỗi ✅ cần bằng chứng thật.
- **Bỏ qua .bru.todo / OQ tiền-đơn** — đó là blocker thật, phải No-Go tới khi xử lý.
- **Không có rollback/degraded-UX** — No-Go; tích hợp tiền không được thiếu đường lui.
- **Còn trỏ sandbox / in secret** — kiểm env production, không lộ key.
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
- @../../../_templates/api-readiness.md
- @./references/example-api-readiness.md
- @../../agents/api-reviewer.md

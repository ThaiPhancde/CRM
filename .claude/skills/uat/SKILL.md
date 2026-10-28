---
name: uat
description: Dùng khi cần lập kế hoạch & kịch bản UAT (nghiệm thu người dùng) cho 1 feature — dịch AC/test-case kỹ thuật thành kịch bản người dùng nghiệp vụ tự chạy, kèm entry/exit criteria, bảng sign-off, defect log. Kích hoạt bằng `/uat <feature>`. Kế thừa SRS + user story + AC + test-case.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<feature>"
---

# /uat — Kế hoạch & kịch bản UAT (nghiệm thu)

## Goal

Viết **UAT plan** tại `docs/{feature}/uat/{feature}-uat-plan.md` cho **người dùng nghiệp vụ** (không phải QA kỹ thuật) chạy nghiệm thu:
- **Scope & mục tiêu** UAT (feature nào, ai nghiệm thu, môi trường).
- **Entry / Exit criteria** (điều kiện bắt đầu / điều kiện coi là PASS để go-live).
- **Kịch bản UAT** (`UAT-NNN`) — mỗi kịch bản: bối cảnh nghiệp vụ + các bước người dùng làm + **kết quả mong đợi** (ngôn ngữ nghiệp vụ, KHÔNG selector/endpoint) + cột PASS/FAIL/ghi chú. Truy vết ngược về `AC-*` / `FR-*` / `E-*`.
- **Bảng sign-off** (người nghiệm thu ký) + **defect log** (lỗi phát hiện khi UAT).

## Constraints

- **Nhóm B — cần nguồn thật** (`feature-bootstrap.md`): tối thiểu `srs/{feature}-spec.md`; tốt nhất có `userstories/us-*.md` (AC inline) + `test/testcases/`. Thiếu hết → **refuse + route `/srs` → `/userstory` → `/ac`**. KHÔNG tự bịa kịch bản.
- **Dịch sang ngôn ngữ nghiệp vụ** — UAT cho người dùng cuối/BA nghiệm thu, KHÔNG cho dev/QA. Bước phải là hành động thật ("mở menu, chọn 2 món, bấm Đặt đơn"), kết quả là điều **người dùng thấy** ("hiện thông báo 'Đơn tối thiểu 30.000đ', nút Đặt đơn mờ"). CẤM selector/API/DB.
- **Bám nguồn — KHÔNG bịa** — mỗi kịch bản trace về AC/FR/E cụ thể. Wording lỗi lấy **exact** từ Error Matrix (`E-*`). Số/ngưỡng lấy từ BR. Thiếu → OQ, không chế.
- **Phủ happy + error + edge** — mỗi FR chính có ≥1 kịch bản happy; mỗi `E-*` quan trọng có 1 kịch bản negative. Coverage phải map được về AC/FR.
- **ID `UAT-NNN`** (scope trong file, không prefix feature — như AC/US theo `naming-conventions.md`). Liên tục, không reuse.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **Reviewer gate** khi lớn (xem Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: uat-plan`.

## Inputs

```
/uat food-delivery          # lập UAT plan từ SRS + story + AC + test-case
/uat food-delivery          # chạy lại → update mode (L2 diff, giữ UAT-ID cũ)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Feature có story/AC: !`for d in docs/*/userstories/*-story-index.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
UAT plan đã có: !`for d in docs/*/uat/*-uat-plan.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve feature.** Thiếu SRS + story → refuse + route (nhóm B). Update mode? plan tồn tại → Read full (no-re-ask), lấy max `UAT-NNN`.
2. **Gather nguồn:** FR + Error Matrix (wording exact) + BR (SRS) · AC inline (`us-*.md`) · test-case (`test/testcases/`) nếu có.
   > *Tăng tốc:* `kg coverage {feature}` để không bỏ sót FR/AC chưa có kịch bản; kết luận nội dung dựa prose Read (`kg-usage.md`).

### Phase B — Dựng kịch bản

3. **Mỗi AC/FR chính → 1 kịch bản happy UAT** (bối cảnh + bước nghiệp vụ + kết quả mong đợi). Gộp AC cùng flow cho gọn.
4. **Mỗi `E-*` quan trọng → 1 kịch bản negative** (dựng điều kiện lỗi + kết quả = wording exact từ Error Matrix).
5. **Entry/Exit criteria** (entry: build sẵn, data mẫu, tài khoản test; exit: X% kịch bản PASS, 0 lỗi blocking). Bảng sign-off + defect log rỗng.

### Phase C — Quality gate

6. **Self-check:** mọi FR chính có kịch bản happy; `E-*` quan trọng có negative; bước là nghiệp vụ (không kỹ thuật); kết quả mong đợi cụ thể; ID liên tục; wording lỗi exact.
7. **Handover-Reviewer gate (CHỈ khi ≥12 kịch bản HOẶC feature nhạy cảm payment/auth)** — spawn `handover-reviewer` (Task, lens release/UAT: coverage AC→UAT đủ chưa, bước có nghiệp vụ không, exit criteria đo được). Sub-agent **trả proposed findings, KHÔNG tự Write** (`approval-gate.md`). BLOCKING → sửa, loop ≤2. Dưới ngưỡng → self-check đủ.

### Phase D — Approval + Write

8. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `uat/{feature}-uat-plan.md`: {N} kịch bản ({H} happy + {E} negative) phủ {FR/AC list}, entry/exit criteria, bảng sign-off, defect log. Còn {Q} câu hỏi mở. Apply?
9. **Set env trước Write** (`CLAUDE_SKILL_NAME=/uat` + author + note vd `UAT: {N} kịch bản`). Write plan.

### Phase E — Resolve OQ + report

10. **resolve-oqs Phase E** — inherited từ SRS (số/ngưỡng thiếu ảnh hưởng kịch bản). L2 diff nếu cập nhật.
11. **Report:**
    ```
    ✅ UAT plan: docs/{feature}/uat/{feature}-uat-plan.md
       {N} kịch bản ({H} happy · {E} negative) | Coverage AC/FR: {c} | Reviewed: {y/n}
    Tiếp: /export {feature} (đóng gói bàn giao) · /release (ghi chú phát hành khi go-live)
    ```

## Gotchas

- **Bước kỹ thuật** ("gọi API POST /orders", "kiểm bảng orders") — SAI; UAT là người dùng nghiệp vụ. Viết hành động thật + điều người dùng thấy.
- **Bịa kết quả mong đợi** — phải bám AC/FR/Error Matrix (wording exact).
- **Bỏ sót negative** — mỗi `E-*` quan trọng cần 1 kịch bản; UAT chỉ happy là thiếu.
- **Exit criteria mơ hồ** ("test xong") — phải đo được (% PASS, 0 blocking).
- **Sai chỗ file** — `docs/{feature}/uat/{feature}-uat-plan.md`.
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
- @../../../_templates/uat-plan.md
- @./references/example-uat.md
- @../../agents/handover-reviewer.md

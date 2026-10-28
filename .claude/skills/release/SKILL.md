---
name: release
description: Dùng khi cần soạn ghi chú phát hành (release notes) cho 1 phiên bản — tổng hợp tính năng mới (từ user story done), sửa lỗi (từ CR), lỗi đã biết (OQ/gap), hướng dẫn nâng cấp. Hai đối tượng: nội bộ / khách hàng. Kích hoạt bằng `/release <version> [feature|all]`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
user-invocable: true
argument-hint: "<version vd 1.0.0> [feature | all] [--audience internal|customer]"
---

# /release — Ghi chú phát hành (release notes)

## Goal

Soạn **release notes** tại `docs/releases/{version}-release-notes.md` (project-level) tổng hợp những gì có trong 1 phiên bản:
- **Highlights** — tính năng/capability mới (từ user story `status: done` + PRD capabilities).
- **Fixes** — sửa lỗi/thay đổi (từ Change Request `docs/cr/CR-*.md` + activity.log).
- **Known issues** — lỗi/hạn chế đã biết (OQ chưa resolve + gap từ `/gap`).
- **Upgrade notes** — bước nâng cấp / breaking change / data migration nếu có.
- **2 phiên bản audience:** `internal` (chi tiết ID, trace) hoặc `customer` (ngôn ngữ thân thiện, ẩn ID nội bộ).

## Constraints

- **Nguồn thật, KHÔNG bịa** — chỉ liệt kê tính năng có **US done thật** / CR có thật / OQ có thật. KHÔNG "chế" tính năng chưa làm, KHÔNG phóng đại. Không có gì done → nói rõ "chưa có mục nào cho version này".
- **Nhóm B/C-lai** (`feature-bootstrap.md`): cần ≥1 nguồn (story-index / CR / activity.log). Vault rỗng → refuse thân thiện + route `/userstory`. KHÔNG tự sinh.
- **Trace nội bộ, ẩn khi customer** — bản `internal` giữ `US-*`/`CR-*`/`FR-*`; bản `customer` dịch sang lợi ích người dùng, KHÔNG lộ ID/nội bộ. Cùng 1 nguồn, 2 cách trình bày, KHÔNG mâu thuẫn nội dung.
- **Known issues trung thực** — OQ/gap chưa xử lý phải nêu (đặc biệt cái ảnh hưởng người dùng, vd OQ-2 giao thất bại). KHÔNG giấu để "trông ổn".
- **version = semver** (`1.0.0`). Ngày phát hành + trạng thái (draft/released). ID không dùng lại.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update. **Reviewer gate** khi lớn (Phase C).
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: release-notes` + `version` + `audience`.

## Inputs

```
/release 1.0.0                          # release notes toàn vault, bản internal (mặc định)
/release 1.0.0 food-delivery            # chỉ 1 feature
/release 1.1.0 --audience customer      # bản khách hàng (ngôn ngữ thân thiện)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Story done gần đây: !`grep -rl 'status:.*done' docs/*/userstories/*-story-index.md 2>/dev/null | xargs -n1 dirname 2>/dev/null | xargs -n1 dirname 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' '`
CR có: !`ls docs/cr/CR-*.md 2>/dev/null | wc -l | tr -d ' '` record
Release notes đã có: !`ls docs/releases/*-release-notes.md 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather

1. **Resolve version + scope + audience.** Version tồn tại → update mode (Read full, no-re-ask). Rỗng nguồn → refuse + route (nhóm C-lai).
2. **Gather:**
   - **Highlights:** story `status: done` (từ lần release trước tới nay) + capabilities PRD tương ứng.
   - **Fixes:** `docs/cr/CR-*.md` trong khoảng + activity.log (sự kiện fix/update).
   - **Known issues:** OQ chưa `[x]` trong SRS/spec + gap từ `docs/_shared/traceability.md` (nếu có `/gap`).
   > *Tăng tốc:* `kg counts` / `kg facts` chọn story done + OQ; nội dung đọc prose (`kg-usage.md`).

### Phase B — Compose (theo audience)

3. **Highlights** — mỗi tính năng 1 dòng lợi ích. Internal: kèm `US-*`/`CAP-*`. Customer: chỉ lợi ích.
4. **Fixes** — từ CR. Internal: `CR-*` + mô tả kỹ. Customer: "đã sửa lỗi ...".
5. **Known issues** — OQ/gap ảnh hưởng người dùng, kèm workaround nếu có.
6. **Upgrade notes** — breaking/migration nếu phát hiện từ CR; không có → "không có thay đổi phá vỡ".

### Phase C — Quality gate

7. **Self-check:** mọi highlight có nguồn (US done/CR) thật; customer-mode không lộ ID nội bộ; known issues không giấu; version/ngày đúng.
8. **Handover-Reviewer gate (CHỈ khi ≥15 mục HOẶC release lớn/nhạy cảm)** — spawn `handover-reviewer` (Task, lens release manager: highlight có nguồn không, known-issues đủ trung thực, customer-mode có lộ nội bộ không). Trả proposed findings, KHÔNG tự Write. BLOCKING → sửa ≤2.

### Phase D — Approval + Write

9. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `docs/releases/{version}-release-notes.md` (bản {audience}): {H} highlight (từ US done), {F} fix (từ CR), {K} known issue (OQ/gap). Apply?
10. **Set env trước Write** (`CLAUDE_SKILL_NAME=/release` + author + note vd `release {version}: {H} highlight`). Write.

### Phase E — Report

11. **Report:**
    ```
    ✅ Release notes {version} (bản {audience}): docs/releases/{version}-release-notes.md
       Highlights {H} · Fixes {F} · Known issues {K}
    Tiếp: /export all (đóng gói) · /confluence publish (đăng cho stakeholder) · /faq (Q&A cho known issues)
    ```

## Gotchas

- **Bịa tính năng chưa done** — CẤM; chỉ US `done` thật + CR thật.
- **Giấu known issues** — thiếu trung thực; OQ/gap ảnh hưởng người dùng phải nêu.
- **Customer-mode lộ `FR-*`/`US-*`/tên nội bộ** — dịch sang lợi ích, ẩn ID.
- **Sai version/ngày** — semver + ngày phát hành thật.
- **Đặt sai chỗ** — `docs/releases/{version}-release-notes.md`.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../rules/agent-conventions.md
- @../../rules/kg-usage.md
- @../../../_templates/release-notes.md
- @./references/example-release.md
- @../../agents/handover-reviewer.md

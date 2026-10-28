---
name: userstory
description: Dùng khi cần chẻ FR (từ SRS) thành user story theo chuẩn INVEST (As a… I want… so that…) + story index. Cần có `srs/{feature}-spec.md` (FR) làm nguồn. Kích hoạt bằng `/userstory <feature>`. Acceptance Criteria chi tiết do `/ac` điền sau.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> [--fr FR-{feature}-NNN]"
---

# /userstory — FR → User Stories (INVEST) + Index

## Goal

Chẻ **Functional Requirements** (từ `srs/{feature}-spec.md`) thành **user story** theo chuẩn **INVEST**: mỗi story 1 file `docs/{feature}/userstories/us-{NNN}.md` (zero-frontmatter, prose "As a… I want… so that…" + context + linked requirements + AC placeholder + refs). Đồng thời build/cập nhật **1 index** `{feature}-story-index.md` = single source of metadata + status + jira-key cho mọi story của feature.

Story là **đơn vị giao việc** cho dev/sprint — đủ nhỏ để làm trong 1 sprint, đủ độc lập để test riêng. **Acceptance Criteria chi tiết (Gherkin) do `/ac` điền** vào chính us-{NNN}.md sau; `/userstory` chỉ đặt sẵn heading AC + seed điều kiện chính (không bịa số liệu).

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc `srs/{feature}-spec.md` (FR). Thiếu → **refuse tường minh + route `/srs`** (câu chuẩn `feature-bootstrap.md` nhóm B), KHÔNG tự tạo feature, KHÔNG bịa story từ con số không.
- **L1 approval** trước Write. **L2 diff** khi update story/index đã tồn tại.
- **KHÔNG L3 iterate** — story là text, đi thẳng L1 → Write.
- **1 story = INVEST** — **I**ndependent (ít phụ thuộc), **N**egotiable (không phải hợp đồng cứng), **V**aluable (có giá trị cho persona), **E**stimable (ước lượng được), **S**mall (vừa 1 sprint), **T**estable (kiểm được qua AC). Story quá lớn (epic) → chẻ nhỏ + note quan hệ.
- **us file zero-frontmatter** — metadata/status/priority/jira-key sống ở `{feature}-story-index.md`, KHÔNG nhét frontmatter vào us-{NNN}.md.
- **ID `US-{NNN}`** 3-digit zero-pad, scope per-feature qua path (không prefix feature trong ID). Không reuse ID khi xóa — increment max+1. Đọc index trước để biết next ID.
- **Persona thật** — lấy từ `{feature}-urd.md` (personas) / `{feature}-prd.md` (user types) / UC Primary Actor. Thiếu → suy từ FR + đánh OQ, KHÔNG chế persona generic "user" nếu feature có nhiều vai.
- **Mọi FR phải map ≥1 story** (coverage) — story-index cột "Covers FR" phủ hết FR trong spec. FR mồ côi → tạo story hoặc note lý do (vd FR thuần backend không có story UI).
- **Linked Requirements đầy đủ** — mỗi story trỏ FR/BR/Error/Screen/UC liên quan bằng ID full-form (`FR-{feature}-NNN`, KHÔNG short-form).
- **IT-BA framing** — story mô tả **giá trị nghiệp vụ** cho persona, KHÔNG mô tả giải pháp kỹ thuật ("As a dev I want a Redis cache" là sai).
- **Doc sạch — KHÔNG meta-text** (`ba-conventions.md` Mục 0).
- **Vietnamese-first**. "As a / I want / so that" giữ dạng chuẩn hoặc dịch "Là… tôi muốn… để…" nhất quán trong 1 feature (auto-detect ngôn ngữ input).

## Inputs

```
/userstory <feature>                      # chẻ toàn bộ FR chưa có story thành story
/userstory <feature> --fr FR-food-delivery-003   # chỉ story cho 1 FR cụ thể
/userstory                                # list feature có spec → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Features có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Features có story-index: !`for d in docs/*/userstories/*-story-index.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Readiness gate + resolve (silent)

1. **Resolve feature** từ arg (slug) hoặc list.
2. **Readiness gate (nhóm B).** `srs/{feature}-spec.md` KHÔNG tồn tại → refuse:
   ```
   Chưa thể chạy /userstory cho `{feature}` — thiếu srs/{feature}-spec.md (nguồn FR).
   Feature hiện có: {list}.
   → Chạy /srs {feature} trước để tạo FR, rồi quay lại /userstory.
   ```
   (Muốn khám phá nghiệp vụ trước SRS → dùng `/usecase` discovery mode.)
3. **Detect existing index** `{feature}-story-index.md` → có thì Read full (no-re-ask): biết story đã có, next US-ID, FR nào đã map.

### Phase B — Gather source

4. Read `srs/{feature}-spec.md` — FR (Mục 2), BR (Mục 4), Error Matrix (Mục 5), NFR nếu liên quan. Read `{feature}-urd.md`/`{feature}-prd.md` (persona/user types). Read `usecases/{feature}-usecase-index.md` nếu có (UC↔FR để nhóm story theo UC + gắn UC ref). Read `ascii-wireframe/`/`html-wireframe/` index (screen refs). KHÔNG hỏi lại cái file đã nói.
   > *Tăng tốc tùy chọn:* `kg coverage {feature}` cho biết FR nào chưa có story (anti-join). Thiếu KG engine → đọc trực tiếp spec (`kg-usage.md`).

### Phase C — Derive stories

5. **Nhóm FR thành story.** Nguyên tắc: 1 story = 1 mẩu giá trị cho 1 persona, làm gọn 1 sprint. 1 FR có thể sinh 1 story; nhiều FR nhỏ cùng goal có thể gộp 1 story; 1 FR lớn (epic) chẻ nhiều story + note quan hệ. Ưu tiên nhóm theo UC nếu có usecase-index.
6. **Gán persona** cho mỗi story (từ URD/PRD/UC actor).
7. **Assign US-ID** tuần tự từ next ID trong index. **Priority** kế thừa FR/CAP priority (P0/P1/P2).

### Phase D — Compose

8. **Mỗi `us-{NNN}.md`** (zero-frontmatter, xem `_templates/user-story.md` + `references/example-userstory.md`):
   ```markdown
   # US-{NNN}: {tiêu đề ngắn}

   **Là** {persona}
   **tôi muốn** {khả năng mong muốn}
   **để** {giá trị nghiệp vụ đạt được}.

   ## Context
   {1-3 câu bối cảnh: khi nào persona cần điều này, ràng buộc nghiệp vụ}

   ## Linked Requirements
   - FR: [[../srs/{feature}-spec.md#FR-{feature}-NNN|FR-{feature}-NNN]], ...
   - BR: BR-{feature}-NNN, ...
   - Use case: [[../usecases/uc-{slug}.md|UC-{slug}]] (nếu có)

   ## Acceptance Criteria
   > Do `/ac` điền chi tiết (Gherkin). Điều kiện chính đã biết:
   - {seed điều kiện — không bịa số liệu}

   ## UI references
   - Screens: {screen-slug}, ... ([[../ascii-wireframe/{feature}-wireframe-index.md|index]])

   ## Error references
   - E-{feature}-NNN: {wording ngắn} (từ Error Matrix)

   ## Dependencies
   - {US-NNN khác / điều kiện} (— nếu độc lập)

   ## Open Questions
   - OQ-{id}: {…} (— nếu không có)
   ```
9. **`{feature}-story-index.md`** (theo `_templates/story-index.md`) — bảng Stories: `# | ID | Title | Persona | Covers FR | Screens | Priority | Status | Jira key | Updated`. Frontmatter chuẩn (`type: userstory-index`, feature, status, updated, links). Status story mặc định `draft`.

### Phase E — INVEST quality gate

10. Self-check mỗi story (fail → sửa hoặc note):
    - [ ] Có đủ **Là / tôi muốn / để** — vế "để" là **giá trị nghiệp vụ**, không lặp lại "tôi muốn".
    - [ ] **Small** — làm gọn 1 sprint; epic → đã chẻ.
    - [ ] **Independent** — dependency tối thiểu, đã note ở mục Dependencies nếu có.
    - [ ] **Testable** — có điều kiện chấp nhận rõ để `/ac` viết được AC (không mơ hồ "hoạt động tốt").
    - [ ] **Valuable** — persona thật + giá trị thật (không phải task kỹ thuật).
    - [ ] **Coverage** — mọi FR trong spec đã map ≥1 story (FR mồ côi đã xử lý/note).
11. **Story-Reviewer gate (CHỈ khi vượt ngưỡng)** — nếu batch **≥6 story** HOẶC feature có **≥2 persona** HOẶC có story phụ thuộc chéo → spawn `story-reviewer` (Task tool, `subagent_type: story-reviewer`), truyền story vừa soạn + FR nguồn. Nhận findings (INVEST + coverage). BLOCKING → sửa, loop tối đa 2 vòng. Dưới ngưỡng → self-check bước 10 đủ, SKIP. Task tool không khả dụng → report ghi `reviewer skipped (Task unavailable)`.

### Phase F — Approval + Write

12. **L1 plan preview** — prose BA-friendly:
    > Em sẽ {tạo mới | cập nhật} user story cho `{feature}`:
    > - {N} story (US-{a}…US-{b}) từ {FR count} FR, {persona list}.
    > - Coverage: {C}/{FR} FR đã có story{; FR mồ côi: …}.
    > - AC để `/ac` điền chi tiết sau.
    >
    > Apply? (Y / sửa)
13. **Set env trước Write**: `CLAUDE_SKILL_NAME=/userstory` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `{N} user stories từ {FR} FR`). Write us files + index (L2 diff nếu update).

### Phase G — Resolve Open Questions (per `resolve-oqs.md`)

14. Collect OQs: own (story) + inherited từ `srs/{feature}-spec.md` (upstream chain của `/userstory` = spec). Prompt Y/skip/ids → loop → cascade scan (story + index + update ngược spec nếu OQ inherited) → L2 diff → activity log.

15. **Output report:**
    ```
    ✅ User stories: docs/{feature}/userstories/ → {N} story + index
       Coverage: {C}/{FR} FR | Personas: {list} | Reviewed: {yes/no}
       OQ: resolved {R}/{N}, còn hold {M}

    Recommended next:
      - /ac {feature}     — viết Acceptance Criteria (Gherkin) cho từng story
      - /jira {feature}   — đẩy story lên Jira (sau khi có AC)
    ```

## Gotchas

- **Thiếu spec → refuse, KHÔNG bịa.** Story sinh từ con số không là bịa nghiệp vụ. Route `/srs`. Muốn elicit trước → `/usecase` discovery.
- **Vế "để" lười** — "để tôi có thể đăng nhập" khi story đã là "tôi muốn đăng nhập" là lặp. Vế "để" phải nói **vì sao** (giá trị): "để truy cập lịch sử đơn hàng của mình".
- **Story = task kỹ thuật** — "As a dev I want to add index to DB" KHÔNG phải user story. Đó là task; story phải có persona nghiệp vụ + giá trị.
- **Epic ngụy trang story** — "quản lý toàn bộ đơn hàng" quá lớn. Chẻ: xem đơn, hủy đơn, theo dõi đơn… mỗi cái 1 story.
- **AC không thuộc /userstory** — chỉ đặt heading + seed. Chi tiết Gherkin là việc `/ac`. Đừng viết AC đầy đủ ở đây (tránh 2 skill ghi đè nhau).
- **Coverage sót FR** — FR thuần hệ thống (audit log, cron) có thể không có story UI; ghi rõ lý do trong report thay vì lờ đi.
- **ID reuse** — luôn đọc index lấy max ID + 1; xóa story không giải phóng ID.
- **@author** — memory `user-identity`, KHÔNG frontmatter (us zero-frontmatter).

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
- @../../../_templates/user-story.md
- @../../../_templates/story-index.md
- @./references/example-userstory.md
- @../../agents/story-reviewer.md

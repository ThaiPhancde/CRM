---
name: ac
description: Dùng khi cần viết Acceptance Criteria (Gherkin Given/When/Then) kiểm thử được cho user story — trích từ FR/BR/Error đã link. Cần có `userstories/us-*.md` (từ /userstory) làm nguồn. Ghi AC inline vào chính file story. Kích hoạt bằng `/ac <feature> [--us US-NNN]`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
user-invocable: true
argument-hint: "<feature-slug> [--us US-NNN]"
---

# /ac — Acceptance Criteria (Gherkin) cho User Story

## Goal

Viết **Acceptance Criteria kiểm thử được** cho từng user story, dạng **Gherkin Given/When/Then**, đánh ID `AC-{NNN}` (scope trong file story). AC ghi **inline vào chính `docs/{feature}/userstories/us-{NNN}.md`** (mục Acceptance Criteria) — KHÔNG file riêng. Nguồn AC: FR/BR/Error/Screen đã link trong story + spec Mục 5 Error Matrix.

AC là **hợp đồng nghiệm thu** giữa BA/PO và dev/QA: story "xong" khi mọi AC pass. Mỗi AC phải **cụ thể + kiểm được** — số liệu thật, wording exact, 1 điều kiện rõ ràng.

## Constraints

- **Nhóm B — cần nguồn thật.** Bắt buộc `userstories/us-*.md` (story từ `/userstory`). Thiếu → **refuse + route `/userstory`** (câu chuẩn `feature-bootstrap.md` nhóm B), KHÔNG tự tạo story.
- **Ghi inline, KHÔNG file riêng.** AC sống trong mục `## Acceptance Criteria` của us-{NNN}.md. `/ac` **luôn ở update mode** (story đã tồn tại) → **L2 diff bắt buộc** cho mỗi story sửa.
- **L1 approval** liệt kê story nào sẽ được thêm/sửa AC trước khi vào loop L2 diff.
- **Gherkin chuẩn** — mỗi AC: `**AC-{NNN}**` + block:
  ```
  Given {tiền đề nghiệp vụ}
  When {hành động}
  Then {kết quả kiểm được}
  ```
  `And`/`But` nối thêm dòng khi cần. Nhiều biến thể của 1 kịch bản → dùng Scenario Outline / bảng Examples (chỉ khi thật sự nhiều case data-driven).
- **Testable — cấm mơ hồ.** Mỗi Then phải **quan sát/đo được**: trạng thái cụ thể, wording exact của message, số liệu (≤3s, sau 5 lần fail…). CẤM "hệ thống hoạt động đúng", "hiển thị phù hợp". Số liệu chưa có trong nguồn → đánh OQ, KHÔNG bịa.
- **Phủ đủ 3 loại** cho mỗi story (loại nào áp dụng):
  1. **Happy path** — điều kiện hợp lệ → thành công (bám Main Success Scenario của UC / FR).
  2. **Negative/Error** — mỗi `E-{feature}-NNN` liên quan → 1 AC lỗi (điều kiện gây lỗi + wording message exact + hệ quả).
  3. **Business rule / boundary** — mỗi BR liên quan + biên số liệu (min/max, hết hạn, quota).
- **Trace ngược nguồn** — AC dựa FR/BR/E nào thì ghi rõ (comment cuối AC hoặc gộp ở mục "AC ↔ nguồn"). Không AC nào "trên trời" không có nguồn.
- **IT-BA framing** — AC mô tả hành vi nghiệp vụ quan sát được, KHÔNG assert kỹ thuật ("DB row inserted", "API trả 200"). Dùng "đơn hàng chuyển trạng thái Đã xác nhận", "hiện thông báo '…'".
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first** (Given/When/Then giữ nguyên keyword hoặc "Giả sử/Khi/Thì" nhất quán trong feature).

## Inputs

```
/ac <feature>                 # viết AC cho mọi story chưa có (hoặc bổ sung)
/ac <feature> --us US-003     # chỉ story US-003
/ac                           # list feature có story → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Features có story: !`for d in docs/*/userstories/*-story-index.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Readiness gate + resolve (silent)

1. **Resolve feature** từ arg/list.
2. **Readiness gate (nhóm B).** Không có `userstories/us-*.md` → refuse:
   ```
   Chưa thể chạy /ac cho `{feature}` — thiếu userstories/us-*.md.
   Feature hiện có story: {list}.
   → Chạy /userstory {feature} trước để tạo story, rồi quay lại /ac.
   ```
3. **Scan story.** Read `{feature}-story-index.md` + các `us-{NNN}.md` (target: tất cả, hoặc chỉ `--us`). Với mỗi story: đọc mục Acceptance Criteria đã có (no-re-ask — chỉ bổ sung/hoàn thiện, KHÔNG viết lại cái đã đúng) + Linked Requirements.

### Phase B — Gather source per story

4. Với mỗi story, gom nguồn để viết AC:
   - **FR** đã link → Read `srs/{feature}-spec.md` Mục 2 lấy hành vi chi tiết + số liệu.
   - **Error Matrix** (Mục 5) → mỗi `E-*` link tới story: điều kiện lỗi + wording exact + hệ quả (vd tăng fail counter).
   - **BR** (Mục 4) → rule + ngưỡng để viết AC biên.
   - **UC** (nếu story link UC) → Main Success Scenario + Extensions cho happy/negative.
   - **Screen** refs → trạng thái màn để Then mô tả kết quả nhìn thấy.
   Thiếu số liệu/wording trong nguồn → OQ (KHÔNG bịa).

### Phase C — Compose AC per story

5. **Sinh AC** theo phủ 3 loại (Phase B nguồn). Đánh ID `AC-{NNN}` tuần tự trong story (đọc AC cũ lấy max+1). Format inline vào mục `## Acceptance Criteria` của us-{NNN}.md:
   ```markdown
   ## Acceptance Criteria

   **AC-001** — Happy path (FR-{feature}-003)
   Given khách đã đăng nhập và giỏ hàng có ≥1 món còn bán
   When khách bấm "Đặt đơn"
   Then đơn được tạo ở trạng thái "Chờ nhà hàng xác nhận"
   And khách thấy màn theo dõi đơn với mã đơn

   **AC-002** — Món hết hàng (E-{feature}-002)
   Given giỏ hàng có 1 món vừa hết hàng
   When khách bấm "Đặt đơn"
   Then hiện thông báo "Món {tên} đã hết, vui lòng cập nhật giỏ hàng"
   And đơn KHÔNG được tạo

   **AC-003** — Giới hạn giá trị đơn tối thiểu (BR-{feature}-001)
   Given tổng đơn < 30.000đ
   When khách bấm "Đặt đơn"
   Then nút "Đặt đơn" bị vô hiệu + hiện "Đơn tối thiểu 30.000đ"
   ```
6. **Cập nhật story-index** — cột status story `draft → in-review` (đã có AC, sẵn sàng review) nếu phù hợp; cột AC count nếu index có track.

### Phase D — Testability quality gate

7. Self-check mỗi AC (fail → sửa):
   - [ ] Given/When/Then đủ 3 vế, mỗi vế 1 điều rõ ràng.
   - [ ] **Then quan sát/đo được** — trạng thái cụ thể / wording exact / số liệu. Không "hoạt động đúng".
   - [ ] Mỗi **E-*** liên quan có ≥1 AC negative; wording khớp Error Matrix.
   - [ ] Mỗi **BR** liên quan có AC (kể cả biên min/max).
   - [ ] Không AC nào thiếu nguồn (FR/BR/E/UC).
   - [ ] Số liệu chưa có nguồn → đánh OQ, KHÔNG bịa.
8. **Story-Reviewer gate (CHỈ khi vượt ngưỡng)** — story có **≥5 AC** HOẶC **≥3 error case** → spawn `story-reviewer` (Task tool, focus AC testability + coverage E-*/BR). BLOCKING → sửa, loop ≤2 vòng. Dưới ngưỡng → self-check đủ. Task tool không có → report ghi `reviewer skipped`.

### Phase E — Approval + Write

9. **L1 plan preview**:
   > Em sẽ thêm/hoàn thiện Acceptance Criteria cho `{feature}`:
   > - {N} story: {US-list} — tổng {A} AC (happy {h}, lỗi {e}, rule {r}).
   > - Bám {FR count} FR + {E count} error + {BR count} rule.
   > - {P} câu hỏi mở (thiếu số liệu/wording).
   >
   > Apply? (Y / sửa)
10. **Loop L2 diff per story** — mỗi us-{NNN}.md là file đã tồn tại → show unified diff mục Acceptance Criteria trước khi ghi. Set env trước mỗi Edit: `CLAUDE_SKILL_NAME=/ac` + `CLAUDE_CHANGELOG_AUTHOR` + `CLAUDE_CHANGELOG_NOTE` (vd `AC cho US-003..US-006, {A} criteria`). Update index (L2 diff).

### Phase F — Resolve Open Questions (per `resolve-oqs.md`)

11. Collect OQs: own (AC thiếu số liệu/wording) + inherited từ story + `srs/{feature}-spec.md`. Prompt Y/skip/ids → loop → cascade scan (AC + story + update ngược spec nếu cần số liệu) → L2 diff → activity log.

12. **Output report:**
    ```
    ✅ Acceptance Criteria: docs/{feature}/userstories/ → {A} AC trên {N} story
       Phủ: happy {h} / lỗi {e} / rule {r} | Reviewed: {yes/no}
       OQ: resolved {R}/{N}, còn hold {M}

    Recommended next:
      - /test-checklist {feature}  — chuyển AC thành checklist kiểm thử
      - /jira {feature}            — đẩy story+AC lên Jira
      - /review {feature}          — QA review AC testability
    ```

## Gotchas

- **Then mơ hồ = AC vô dụng** — "hệ thống xử lý đúng" không test được. Ép cụ thể: trạng thái nào, message gì (exact), số liệu bao nhiêu. Đây là lỗi phổ biến nhất.
- **Bịa số liệu/wording** — nguồn (spec) chưa có ngưỡng/thông báo → đánh OQ, đề xuất bổ sung Error Matrix/BR qua `/srs`. KHÔNG tự chế "sau 5 lần" nếu spec không nói.
- **Bỏ sót negative** — chỉ viết happy path là thiếu 1 nửa. Mỗi error code liên quan phải có AC lỗi.
- **AC assert kỹ thuật** — "API trả 200", "row inserted" sai altitude. Viết theo hành vi nghiệp vụ quan sát được.
- **Ghi đè AC user đã sửa tay** — Read story trước, no-re-ask: chỉ bổ sung AC thiếu, giữ AC user đã chỉnh; L2 diff cho user thấy rõ thay đổi.
- **AC quá nhiều/1 story** — >8 AC/story thường là story quá lớn (epic) → gợi ý quay lại `/userstory` chẻ nhỏ.
- **/ac luôn L2** — file story đã tồn tại; KHÔNG dùng L1-create. Diff phải show mục Acceptance Criteria trước/sau.
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
- @./references/example-ac.md
- @../../agents/story-reviewer.md

---
name: usecase
description: Dùng khi cần viết use case fully-dressed (Cockburn) cho 1 feature — mô tả nghiệp vụ theo góc actor (goal + main success scenario + extensions). 2 mode tự chọn - chưa có SRS thì discovery (tự tạo feature + phỏng vấn), có SRS thì trích FR. Kích hoạt bằng `/usecase <feature | mô tả nghiệp vụ>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug> | <mô tả nghiệp vụ> | (empty để chọn feature)"
---

# /usecase — Fully-dressed Use Case (Cockburn) + Index

## Goal

Viết use case theo phong cách **fully-dressed Cockburn** cho 1 feature: mỗi use case là 1 file `docs/{feature}/usecases/uc-{slug}.md` (zero-frontmatter) mô tả **1 user goal (sea-level)** — actor muốn đạt gì, các bước thành công (Main Success Scenario), và các nhánh rẽ/lỗi (Extensions). Đồng thời build/cập nhật **1 file index** `docs/{feature}/usecases/{feature}-usecase-index.md` = ma trận truy vết per-feature (UC↔FR↔Screen↔Error↔OQ) + CRUD matrix + Actors + Relationships.

**Use case = business black-box.** Mở UC là đọc *prose nghiệp vụ theo góc người dùng*, KHÔNG đọc technical detail. Sequence/State (call component, internal state) KHÔNG embed vào UC — chúng thuộc `srs/{feature}-flows.md` / `srs/{feature}-states.md`.

## 2 mode (skill tự chọn, không cần flag)

| `srs/{feature}-spec.md` | Mode | Hành vi |
|---|---|---|
| **Chưa có** | **Discovery (nhóm A — điểm vào)** | Use case là kỹ thuật **elicitation** — BA thường viết UC TRƯỚC SRS để khám phá nghiệp vụ. Derive slug + tạo feature + phỏng vấn actor/goal/main success/nhánh lỗi/guarantees. UC draft, cột FR trống (đánh `TBD`), số nghiệp vụ chưa rõ → đánh OQ, KHÔNG bịa. Route `/srs` sau đó để hình thức hóa FR. |
| **Có** | **Downstream** | Trích FR/BR/Error từ spec, điền traceability **đầy đủ** (Covers FR, Errors E-*, screens). Không hỏi lại cái spec đã có (no-re-ask). |

> KHÔNG refuse khi thiếu SRS — đó là chặn nhầm luồng elicitation chuẩn của nghề BA (xem `feature-bootstrap.md`).

## Constraints

- **L1 approval** trước mọi Write (kể cả khi chỉ tạo 1 file) — bao gồm confirm feature slug ở discovery mode (skill auto-derive, user override được).
- **L2 diff** khi update file đã tồn tại (uc cũ hoặc index) — update mode tự động khi file có sẵn, không cần flag.
- **KHÔNG L3 iterate** — UC là prose text, đi thẳng L1 → Write. User review từ file rồi gọi lại skill nếu cần sửa (skill tự vào update mode).
- **1 UC = 1 user goal sea-level.** KHÔNG gộp nhiều goal vào 1 UC; KHÔNG viết UC mức "fish/clam" (login-substep) thành UC riêng nếu nó chỉ là bước của goal lớn — để dạng Extension hoặc `<<include>>`.
- **uc file zero-frontmatter** — metadata/lifecycle/traceability sống ở `{feature}-usecase-index.md`, KHÔNG nhét frontmatter vào uc-{slug}.md.
- **Fully-dressed Cockburn structure** (bắt buộc đủ heading, phần không áp dụng thì ghi "—"): Scope · Level · Primary Actor · (Stakeholders & Interests — optional) · Trigger · Preconditions · Minimal Guarantee · Success Guarantee · Main Success Scenario (numbered) · Extensions (`{step}{letter}`) · Related Requirements.
- **Extensions đánh số theo bước** — `3a`, `3b`, `6a` (a, b, ... là các nhánh rẽ tại bước 3, 6). Mỗi extension: điều kiện + cách xử lý, có thể dẫn tới error code E-* (downstream mode) hoặc `TBD` (discovery).
- **KHÔNG embed diagram vào UC** — nếu user yêu cầu "vẽ sequence/flow vào UC", refuse + giải thích abstraction level + route `/sequence` (flows.md) hoặc `/activity`.
- **IT-BA framing** (`ba-conventions.md` Mục 3) — Main Success Scenario mô tả bằng **action verb nghiệp vụ** ("hệ thống kiểm tra tồn kho", "gửi email xác nhận"), CẤM technical (function name, endpoint, schema, JWT, SDK).
- **CRUD matrix đối chiếu ERD** — entity đặt tên CamelCase khớp `srs/{feature}-erd.md` nếu có. Không có ERD → suy entity nghiệp vụ từ UC, ghi OQ để xác nhận sau.
- **Doc sạch — KHÔNG meta-text** (`ba-conventions.md` Mục 0): uc/index chỉ chứa nội dung nghiệp vụ thật + legend người-đọc-cần. KHÔNG chèn "công thức viết UC", "chạy /skill-x để fill".
- **Vietnamese-first** (auto-detect từ input). Muốn tiếng Anh → nói "viết bằng tiếng Anh".
- **OQ canonical** — discovery mode UC có OQ riêng của use case (số nghiệp vụ chưa rõ); downstream mode OQ canonical ở `srs/{feature}-spec.md`, index chỉ trỏ ref `spec.md#OQ-N`.

## Inputs

```
/usecase                            # chọn feature từ list (hoặc mô tả feature mới)
/usecase <feature-slug>             # feature đã có → downstream nếu có spec, discovery nếu chưa
/usecase <mô tả nghiệp vụ mới>      # feature chưa có → discovery: derive slug + phỏng vấn + tạo feature
/usecase <feature> --uc <slug>      # chỉ viết/cập nhật 1 use case cụ thể
```

Examples:
```
/usecase food-delivery                      # đã có spec → trích FR, viết đủ UC + index
/usecase khách đặt món, nhà hàng chuẩn bị, shipper giao   # feature mới → discovery
/usecase payment --uc make-payment          # chỉ UC thanh toán
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Features có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Features có usecase-index: !`for d in docs/*/usecases/*-usecase-index.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Resolve feature + mode (silent)

1. **Resolve feature.**
   - Arg là slug khớp `docs/{arg}/` → dùng feature đó.
   - Arg là mô tả nghiệp vụ (prose, nhiều từ) mà chưa có folder khớp → **discovery mode (nhóm A)**: derive feature slug (main domain noun phrase, kebab-case ASCII ≤50 ký tự, theo `naming-conventions.md`). Slug-lạ 1 từ mơ hồ → hỏi "feature mới hay gõ nhầm?" (câu chuẩn `feature-bootstrap.md`).
   - No arg → list feature hiện có + hỏi chọn / mô tả feature mới.
2. **Chọn mode.** `srs/{feature}-spec.md` tồn tại → **downstream**; không → **discovery**.
3. **Detect existing index** `usecases/{feature}-usecase-index.md`:
   - Có → update mode: Read full trước khi làm (no-re-ask), gom UC đã có để không trùng slug + biết cần thêm/sửa UC nào.
   - Không → tạo mới.

### Phase B — Gather source

**Downstream mode (có spec):**
4. Read `srs/{feature}-spec.md` — lấy FR (Mục 2), BR (Mục 4), Error Matrix (Mục 5), OQ. Read `srs/{feature}-erd.md` nếu có (entity cho CRUD matrix). Read `ascii-wireframe/{feature}-wireframe-index.md` / `html-wireframe/...` nếu có (screen refs). Read `{feature}-urd.md`/`{feature}-prd.md` nếu có (actor/persona, goal). KHÔNG hỏi lại cái các file này đã nói.
   > *Tăng tốc tùy chọn:* nếu workspace có KG engine, `kg coverage {feature}` cho biết FR nào chưa có UC (anti-join). Thiếu engine → đọc trực tiếp spec (xem `kg-usage.md`, KG-ERROR → flow đọc thẳng).

**Discovery mode (chưa có spec) — phỏng vấn ĐÚNG PHẠM VI use case cần** (1 batch, business language, `ba-conventions.md` Mục 3):
4. Hỏi gom:
   - **Primary actor** + goal của họ (sea-level: 1 mục tiêu nghiệp vụ hoàn chỉnh trong 1 lần dùng).
   - **Main success scenario** — các bước từ trigger tới khi actor đạt goal (user làm gì → hệ thống làm gì → kết quả actor thấy).
   - **Nhánh rẽ + lỗi** tại từng bước (validate fail, hết hàng, thanh toán lỗi, hủy giữa chừng...).
   - **Guarantees** — điều hệ thống đảm bảo khi thành công (Success Guarantee) và khi thất bại/bỏ dở (Minimal Guarantee).
   - **Actor phụ / secondary** (dịch vụ ngoài, hệ thống khác) — chỉ tên + vai trò nghiệp vụ.
   Số nghiệp vụ chưa rõ (thời hạn, ngưỡng, quota) → **đánh OQ**, KHÔNG bịa. Vague → re-ask 1 lần, vẫn vague → `TBD` + OQ.

### Phase C — Derive UC set + slugs

5. **Xác định danh sách UC.** Mỗi user goal sea-level = 1 UC. Nguồn:
   - Downstream: gom FR theo goal (nhiều FR có thể phục vụ 1 UC); đối chiếu actor trong URD/PRD.
   - Discovery: từ các goal đã phỏng vấn.
6. **Derive uc-slug** cho mỗi UC (verb-object kebab-case, ≤30 ký tự): `place-order`, `make-payment`, `cancel-order`. Collision với slug đã có trong index → reuse (update) hoặc suffix.
7. **Detect relationships** — `<<include>>` (UC luôn cần UC con để hoàn thành, vd checkout include payment), `<<extend>>` (UC bổ sung khi điều kiện xảy ra, base vẫn đủ nếu không), generalization. Ghi vào bảng Relationships của index.

### Phase D — Compose

8. **Mỗi `uc-{slug}.md`** (zero-frontmatter) theo cấu trúc Cockburn (xem `_templates/usecase.md` + `references/example-usecase.md`):
   ```markdown
   # UC-{slug}: {Tên use case}

   **Scope**: {feature / hệ thống}
   **Level**: user-goal (sea) | subfunction (fish) | summary (kite)
   **Primary Actor**: {actor}
   **Stakeholders & Interests**: {actor → mối quan tâm} (optional — bỏ nếu không thêm giá trị)
   **Trigger**: {sự kiện khởi động UC}
   **Preconditions**: {điều kiện phải đúng trước khi bắt đầu}
   **Minimal Guarantee**: {đảm bảo tối thiểu kể cả khi thất bại — vd không mất tiền, ghi log}
   **Success Guarantee**: {trạng thái nghiệp vụ khi thành công}

   ## Main Success Scenario
   1. {Actor} {hành động} …
   2. Hệ thống {hành động nghiệp vụ} …
   ...

   ## Extensions
   - **3a.** {điều kiện tại bước 3}: {cách xử lý} → {E-{feature}-NNN | TBD}
   - **6a.** {điều kiện tại bước 6}: {cách xử lý}

   ## Related Requirements
   - FR: FR-{feature}-NNN, ... (downstream — else TBD)
   - BR: BR-{feature}-NNN, ...
   - Errors: E-{feature}-NNN (từ Extensions)
   ```
9. **`{feature}-usecase-index.md`** (theo `_templates/usecase-index.md`) — điền:
   - Bảng **Use cases** (ma trận truy vết): `# | Slug | Level | Status | Actor primary | Covers FR | Screens | Errors | OQ ref | Priority | Updated`.
   - Bảng **CRUD matrix**: UC × Entity (C/R/U/D), entity CamelCase khớp ERD.
   - Bảng **Actors**: primary/secondary/system + mô tả + nguồn.
   - **Diagram**: nếu `{feature}-usecase-diagram.svg` đã có (output `/usecase-diagram`) → nhúng `<img>`; chưa có → để placeholder + note gợi ý chạy `/usecase-diagram`.
   - Bảng **Relationships**: include/extend/generalization.

### Phase E — Quality gate (self-check trước L1)

10. Skill tự soát checklist (fail → in gap + đề xuất hỏi thêm / bổ sung trước proceed; user "proceed anyway" được):
    - [ ] Mỗi UC là **1 user goal sea-level** (không phải substep rời).
    - [ ] Main Success Scenario có bước từ **trigger → success guarantee**, mỗi bước là action nghiệp vụ (không technical).
    - [ ] Mỗi nhánh rẽ/lỗi đã phỏng vấn/đọc được có **Extension tương ứng** (không bỏ sót error path).
    - [ ] Downstream: mỗi FR liên quan đã map vào **Covers FR** của ≥1 UC (không FR mồ côi); Extensions trỏ đúng **E-*** trong Error Matrix.
    - [ ] Discovery: số nghiệp vụ chưa rõ đã đánh **OQ** (không bịa ngưỡng/thời hạn).
    - [ ] CRUD matrix: mỗi UC có ≥1 entity tương tác; entity khớp ERD (hoặc OQ nếu chưa có ERD).
    - [ ] include/extend đúng ngữ nghĩa (include = luôn cần; extend = có điều kiện, base vẫn đủ).

### Phase F — Approval + Write

11. **L1 plan preview** — prose BA-friendly (`ba-conventions.md` Mục 5), KHÔNG bảng dev:
    > Em sẽ {tạo mới | cập nhật} use case cho `{feature}`:
    > - {N} use case: {liệt kê tên goal} (mode: {discovery/downstream})
    > - Index: ma trận truy vết {N} UC × {FR count} FR, CRUD {M} entity, {K} actor, {R} quan hệ include/extend.
    > - Số nghiệp vụ đã chốt: {…}; còn {P} câu hỏi mở.
    >
    > Apply? (Y / sửa / override-feature `<slug>`)
12. **Set env trước mỗi Write** (hook ghi activity.log): `CLAUDE_SKILL_NAME=/usecase` + `CLAUDE_CHANGELOG_AUTHOR={@author}` + `CLAUDE_CHANGELOG_NOTE` (≤80 ký tự, vd `{N} use cases + index, {mode} mode`). Hook append `docs/_shared/activity.log`.
13. **Write** uc files + index. Discovery mode: tạo `docs/{feature}/usecases/` khi Write. Update mode: L2 diff cho file đã có.

### Phase G — Resolve Open Questions (Phase E per `resolve-oqs.md`)

14. Collect OQs: **own** (UC discovery mode) + **inherited** (downstream: từ `srs/{feature}-spec.md` còn `[ ]`). Prompt Y/skip/ids → loop 1-by-1 → cascade scan (uc/index sections liên quan) → L2 diff per impacted → activity log qua hook. Downstream: OQ resolved cũng update ngược `spec.md`.

15. **Output report:**
    ```
    ✅ Use cases: docs/{feature}/usecases/ → {N} UC + index
       Mode: {discovery|downstream} | Traceability: {C}/{FR} FR covered | Actors: {K} | Relationships: {R}
       OQ: resolved {R}/{N}, còn hold {M}

    Recommended next:
      - /usecase-diagram {feature}   — vẽ use case diagram (visual scope) từ index này
      - /srs {feature}               — hình thức hóa FR (discovery mode) / bổ sung FR
      - /userstory {feature}         — chẻ UC/FR thành user story
    ```

## Gotchas

- **Discovery vs downstream** — skill tự chọn theo có/không `spec.md`. Discovery không refuse (elicitation chuẩn), nhưng cột FR để `TBD` + OQ, phải route `/srs` sau để hình thức hóa.
- **UC không phải flow** — nếu Main Success Scenario đang mô tả "FE gọi BE, BE query DB" là sai altitude. Viết lại theo action nghiệp vụ. Chi tiết call component thuộc `/sequence` (flows.md).
- **Level chọn sai** — login/verify-otp thường là **subfunction (fish)** phục vụ 1 goal lớn, KHÔNG tách UC sea-level riêng trừ khi nó thực sự là 1 goal độc lập user tới hệ thống chỉ để làm.
- **Extension trỏ E-* sai/thiếu** (downstream) — mỗi nhánh lỗi phải map đúng error code trong `spec.md` Mục 5; không có code phù hợp → đánh OQ, đề xuất bổ sung Error Matrix qua `/srs`.
- **CRUD matrix bịa entity** — chỉ liệt kê entity có trong ERD; thiếu ERD → suy nghiệp vụ + OQ, KHÔNG tự chế tên bảng.
- **Trùng slug khi update** — Read index trước, match slug; mô tả sửa 1 UC cũ → update mode (L2 diff) chứ KHÔNG tạo uc trùng nội dung slug mới.
- **@author cho activity log** — resolve từ memory `user-identity` (`ba-conventions.md` Mục 1), KHÔNG vào frontmatter (uc zero-frontmatter; index frontmatter không có owner).
- **Yêu cầu "vẽ diagram vào UC"** — refuse, giải thích abstraction level (UC = business black-box), route `/usecase-diagram` (scope) hoặc `/sequence`/`/activity` (chi tiết flow).

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/usecase.md
- @../../../_templates/usecase-index.md
- @./references/example-usecase.md

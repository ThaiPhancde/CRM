---
name: userguide
description: Dùng khi cần viết hướng dẫn sử dụng/cẩm nang vận hành cho admin/CSKH từ các tài liệu BA đã có. Kích hoạt bằng `/userguide` hoặc `/userguide <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
disable-model-invocation: true
argument-hint: "(empty = toàn sản phẩm) | <feature> [feature2 ...]"
---

# /userguide — Cẩm nang vận hành (BA docs → hướng dẫn sử dụng)

> **KHÔNG dùng `context: fork`.** Skill có **HARD STOP report-first** (GĐ1 in mục lục ra chat → DỪNG → chờ user "tiếp/ok" mới viết cẩm nang) — cần user trả lời trong chat. Fork = không có kênh trả lời → HARD STOP bị auto-skip, skill tự nhảy sang GĐ2 viết không chờ user duyệt mục lục (cùng root cause bug CR-20260612-001, pattern report-first giống `/cr`). Chạy ở main conversation. Phân tích nặng vẫn delegate cho `@manual-reviewer` qua Task tool.

## Goal

Sinh **cẩm nang sử dụng / vận hành cho người vận hành sản phẩm** (admin, CSKH, nội bộ) — tài liệu dạy CÁCH DÙNG phần mềm sau khi đã build xong. Skill **đọc ngược toàn bộ BA docs đã có** trong `docs/` (PRD, SRS, use case, screens, Error Matrix, definitions) rồi dựng cẩm nang toàn sản phẩm theo **xương sống Diátaxis**, qua 2 giai đoạn có chốt người ở giữa:

1. **Giai đoạn 1 — Dựng mục lục.** Quét mọi feature trong `docs/` → phân loại nguồn → cluster nội dung → đề xuất **mục lục cẩm nang** (các trang × loại Diátaxis × nguồn). Tự áp quality checklist → **spawn `@manual-reviewer`** review độ phủ + phân loại + task-based → chỉnh lại → **in mục lục ra chat** + **HARD STOP** đợi user duyệt + trả lời câu hỏi audience/scope. KHÔNG ghi file outline.
2. **Giai đoạn 2 — Viết chi tiết.** Chỉ chạy sau khi user `tiếp`. Gap-driven: viết từng trang vào `{ug-dir}/pages/` + `{ug-index}` master → render `{ug-html}` (cửa vào, double-click mở browser) + `{ug-data}`.

Bản chất: từ "đã có đặc tả nghiệp vụ" → "cẩm nang người vận hành đọc để làm việc". Nội dung **truy được về BA docs** — không bịa.

## Skill này khác gì các skill khác

| Skill | Hướng | Người đọc cuối | Khác biệt |
|-------|-------|----------------|-----------|
| `/reverse-doc` | Reverse → brainstorm | BA / team | Tái lập *nghiệp vụ* từ nguồn cũ rời rạc |
| `/srs` | Forward → spec | Dev / QA | Đặc tả *kỹ thuật* (FR/NFR/Error) |
| `/export` | Đóng gói | Stakeholder | Render doc *có sẵn* ra PDF/DOCX/HTML |
| **`/userguide`** | **Forward → hướng dẫn** | **Người vận hành sản phẩm** | **Dạy CÁCH DÙNG** phần mềm đã build |

Khoảng trống đã xác nhận: skill documentation hiện có trên GitHub đều là developer-doc; chưa ai làm cẩm nang người vận hành. Skill này không đọc/copy output của `/reverse-doc` — nó đọc trực tiếp BA docs đã chốt (`docs/{feature}/`).

## Constraints

- **2 giai đoạn, HARD STOP ở giữa.** GĐ1 dựng mục lục → in ra chat → DỪNG. GĐ2 (viết cẩm nang) CHỈ chạy sau khi user confirm (`tiếp`/`ok`/`Y`). KHÔNG tự nhảy thẳng sang viết. (Pattern report-first giống `/cr` — khớp memory `feedback_cr_report_first`.)
- **KHÔNG ghi file outline RIÊNG ở GĐ1.** Mục lục GĐ1 chỉ in ra chat (bảng terse, 1 dòng/trang, delta-review gộp cột Ghi chú) — KHÔNG tạo `_outline.md` trung gian. Ngay khi user gõ `tiếp` (đầu GĐ2, Pha C.6), skill Write `{ug-index}` (artifact chính thức luôn có kế hoạch tạo) với outline đã duyệt + mọi trang `status: pending` — đây là state artifact chống mất outline nếu turn bị ngắt giữa GĐ2, KHÔNG phải file trung gian mới. Viết outline gọn: ít chữ nhất mà vẫn đủ nắm.
- **@manual-reviewer gate (Pha C)** — BẮT BUỘC spawn agent review mục lục TRƯỚC HARD STOP. Skill nhận findings → chỉnh outline (bổ sung trang thiếu, đổi tiêu đề về task-based, tách trang trộn loại) → mới đưa user duyệt. Loop tối đa 2 vòng nếu còn BLOCKING. User vẫn là người chốt cuối ở HARD STOP.
- **Xương sống Diátaxis, KHÔNG để lộ thuật ngữ Diátaxis trong output.** 6 trụ map sang tiếng người vận hành: Tổng quan/Khái niệm (Explanation) · Bắt đầu nhanh (Tutorial) · Hướng dẫn theo tác vụ (How-to) · Tra cứu (Reference) · Xử lý sự cố · FAQ+Thuật ngữ. Output dùng tên tiếng Việt thân thiện; loại Diátaxis chỉ ghi nội bộ trong `{ug-index}` + outline để audit.
- **Không trộn loại trong 1 trang.** Tutorial = 1 đường duy nhất, không nhồi option. Reference = bảng khô, không kể chuyện. How-to = task-based các bước. Explanation = nơi duy nhất được kể bối cảnh.
- **Tiêu đề How-to bắt đầu bằng ĐỘNG TỪ** — "Khóa tài khoản người dùng", KHÔNG "Màn hình quản lý". Đặt điều kiện TRƯỚC hành động ("Để xuất file, chọn..." không "Chọn... để xuất").
- **Every Page Is Page One** — mỗi trang TỰ ĐỨNG VỮNG: có context tối thiểu + liên kết sang trang liên quan, KHÔNG giả định đã đọc trang trước (người dùng đáp xuống từ search/link).
- **Audience = người vận hành (admin/CSKH/nội bộ).** Được dùng thuật ngữ hệ thống nhiều hơn end-user phổ thông, nhưng VẪN task-based. KHÔNG dump schema/endpoint/tên function vô nghĩa. Ngôi thứ hai "bạn", thì hiện tại, active voice, front-load thông tin quan trọng.
- **KHÔNG bịa** — nguồn không có wording/limit/lỗi cụ thể → `<!-- TBD -->` + Open Question, tuyệt đối không tự chế giá trị (giới hạn, thông báo lỗi, ngưỡng).
- **Truy nguồn** — mỗi trang ghi nguồn suy ra (feature + file) trong file index. Trang nào nguồn rỗng → thành OQ, không viết trang bịa.
- **Output gọn: 1 file mở + 1 folder bundle** dưới `docs/userguide/` (project-level, 1 folder cho cả sản phẩm như `_shared`/`_product`). Top-level CHỈ lộ file `.html` để user dễ mở; mọi file phụ gom vào folder bundle cùng tên:
  - **File mở (cửa vào):** `{ug-html}` = `userguide.html` (toàn SP) hoặc `{feature}-userguide.html` (lọc feature). Self-contained, docs-style **light-only** (không dark mode).
  - **Folder bundle:** `{ug-dir}` = `userguide/` hoặc `{feature}-userguide/` chứa `index.md` (`{ug-index}`, master metadata) · `data.js` (`{ug-data}`, nội dung nhúng) · `pages/{slug}.md` (các trang, zero-frontmatter, Every Page Is Page One) · `images/{slug}.png`.
  - Resolve scope ở Pha A. KHÔNG dùng tên trần `preview.html`/`index.md` ở top-level.
- **Hình minh họa "cả hai"** — có wireframe/ASCII sẵn (`ascii-wireframe/` gộp theo flow, `html-wireframe/`, `srs/{feature}-userflow.md`) → nhúng/link làm minh họa. Chỗ cần ảnh thật → placeholder `![...](images/...)` + bảng callout (1)(2)(3). Tối đa 1–3 callout/ảnh.
- **L1 plan preview** (BA-facing prose) trước batch Write trang. **L2 diff** khi file đã tồn tại (update mode tự động).
- **KHÔNG tự tạo Artifact** lên claude.ai — output là file local `{ug-html}` (khớp memory `feedback_no_artifact_default`).
- **Đa ngôn ngữ — HỎI, không mặc định cứng.** Pha C.4 hỏi ngôn ngữ viết (gợi ý theo ngữ cảnh nguồn/seed, user chọn "Other" cho ngôn ngữ bất kỳ). Viết TOÀN BỘ cẩm nang (trang + tiêu đề nav + UI label khi cần) bằng ngôn ngữ đã chốt. Ghi `lang` vào index frontmatter. Typography khi viết tiếng Việt: "Mục N" không dùng §; `→` chỉ trong flow/bảng.
- **Frontmatter** cho file index (type `userguide-index`): `type` · `scope` (`product` khi toàn sản phẩm, `feature:{slug}` khi lọc 1 feature) · `audience` · `lang` (ngôn ngữ đã chốt ở Pha C.4) · `status` · `updated` · `links`. KHÔNG có `owner`/`created`/`changelog` (đã diet 2026-07-12 — demo cũ còn là di sản, không thêm mới). Trang section = zero frontmatter (metadata sống ở file index).

## Inputs

```
/userguide                  # toàn sản phẩm: quét mọi feature trong docs/
/userguide payment          # chỉ gen 1 feature
/userguide payment auth     # tập con feature (list tên, cách nhau bởi dấu cách)
/userguide tiếp             # (sau HARD STOP) → vào GĐ2 viết chi tiết
```

Muốn đổi hành vi mặc định, nói bằng lời:
- Viết bằng tiếng Anh → nói "viết bằng tiếng Anh" (default `vi`, auto-detect từ nguồn).
- Chạy lại khi đã có cẩm nang → gọi lại `/userguide` như cũ, skill tự nhận file đã tồn tại và vào update mode (L2 diff per file), không cần flag riêng.

- **Không arg** = toàn sản phẩm. **Arg là tên feature** (1 hoặc nhiều, cách nhau bởi dấu cách) = lọc tập con. KHÔNG dùng flag `--feature`/`--features` — gõ tên trực tiếp.
- Skill nhận diện: token khớp folder `docs/{token}/` tồn tại → coi là feature; `tiếp`/`apply` → vào GĐ2. Token không khớp feature nào → cảnh báo + liệt kê feature có sẵn, không tự đoán.
- Output LUÔN ở `docs/userguide/` (project-level). Lọc 1 feature = cẩm nang chỉ chứa các trang của feature đó (không lẫn sang feature khác).

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Workspace features: !`ls -d docs/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^_" | grep -vE "blockers|changes|decisions|exports|impacts|inbox|meetings|redoc|guides|images|userguide" | tr '\n' ' '`
Đã có userguide: !`ls docs/userguide/*userguide-index.md 2>/dev/null && echo "(có — sẽ update mode)" || echo "(chưa có — tạo mới)"`
Shared definitions: !`ls docs/_shared/definitions.md 2>/dev/null && echo "có (nguồn Glossary)" || echo "chưa có"`

---

## Runtime flow (skill chạy thế nào)

```
/userguide [args]
        │
        ▼
[Pha A] Quét feature folders (Glob docs/{f}/**) → inventory nguồn mỗi feature:
        srs/{feature}-spec.md (FR/NFR/Error) · usecases/ · ascii-wireframe/ · prd/brd · definitions
        │
        ▼
[Pha B] Cluster → dựng MỤC LỤC cẩm nang (6 trụ × feature). Gán loại Diátaxis +
        nguồn + thứ tự. Tự áp quality checklist (task-based, không trộn loại).
        │
        ▼
[Pha C] ⟳ Spawn @manual-reviewer → review độ phủ + phân loại + tiêu đề task-based.
        Skill nhận findings → chỉnh outline. Loop ≤2 vòng nếu còn BLOCKING.
        │
        ▼
[Pha C.5] In mục lục (terse) + câu hỏi audience/scope ra CHAT. KHÔNG ghi file.
        │
        ▼
  ╔════════════════════ HARD STOP ════════════════════╗
  ║ IN mục lục (bảng terse, delta-review gộp cột Ghi    ║
  ║ chú) + câu hỏi ra CHAT. KHÔNG ghi file outline —    ║
  ║ mục lục chỉ sống trong chat. "Trả lời + gõ `tiếp`". ║
  ║ DỪNG. User confirm → viết luôn cẩm nang.            ║
  ╚════════════════════════════════════════════════════╝
        │ user `tiếp` (+ answers)
        ▼
[Pha C.6] Write NGAY {ug-index} với outline đã duyệt (mọi trang status: pending) —
          state artifact chống mất outline nếu turn bị ngắt giữa Pha D. KHÔNG phải
          file outline riêng — đây chính là {ug-index} sẽ dùng tới cuối, chỉ ghi sớm.
        │
        ▼
[Pha D] Per-section gap-driven: viết từng trang từ nguồn theo khung Diátaxis.
        Resolve {{feature}} trong template. Nhúng ASCII/wireframe / placeholder ảnh + callout.
        Nguồn thiếu → TBD+OQ. Sau mỗi trang: update dòng trong {ug-index} → status: written.
        │
        ▼
[Pha D.5] Ảnh minh họa — HỎI user chọn 1 trong 3: (A) auto-chụp Playwright (cần nguồn+quyền)
        · (B) user tự chụp → giữ placeholder + brief chi tiết · (C) dùng wireframe/ASCII sẵn có.
        │
        ▼
[Pha E] L1 plan preview (prose) → Write per-section (nếu chưa) → update {ug-index} (env note → activity.log).
        │
        ▼
[Pha F] Render {ug-html} (cửa vào, từ _templates/userguide-preview.html) + {ug-dir}/data.js.
        │
        ▼
[Pha G] Gom Open Questions (TBD trong các trang) → hỏi Y/skip/ids → ghi vào index + final report.
```

## Approach (chi tiết từng pha)

### Pha A — Quét nguồn

1. Resolve scope: no arg = mọi feature trong Context; arg là tên feature (1+ token, cách nhau dấu cách) = tập con. Token không khớp `docs/{token}/` → cảnh báo + liệt kê feature có sẵn, KHÔNG tự đoán. Confirm scope ngầm ở outline (Pha C.5), không hỏi sớm.
2. Với mỗi feature, **Glob `docs/{feature}/**/*.md`** + phân loại nguồn theo cách dùng:
   - `prd.md` / `brd.md` → Tổng quan + Bắt đầu nhanh (mục tiêu, persona, capability).
   - `usecases/uc-*.md` → Hướng dẫn theo tác vụ (1 UC ≈ 1 trang how-to).
   - `ascii-wireframe/*.md` (gộp theo flow), `html-wireframe/`, `srs/{feature}-userflow.md` → ảnh minh họa + bảng thao tác.
   - `srs/{feature}-spec.md` Mục FR/NFR/Business Rules → Tra cứu (settings/giới hạn).
   - `srs/{feature}-spec.md` Error Matrix (`E-{feature}-NNN`) → Xử lý sự cố.
   - `docs/_shared/definitions.md` → Thuật ngữ.
3. In **bảng inventory** (chat): `feature | nguồn có | nguồn thiếu`. Feature thiếu hẳn nguồn → đánh dấu (cẩm nang phần đó sẽ mỏng/OQ).

### Pha A.5 — Hỏi phạm vi cẩm nang: viết luồng gì + gộp hay tách (BẮT BUỘC, trước khi dựng mục lục)

> Đừng mặc định "viết hết mọi luồng của feature". Hỏi rõ user muốn cẩm nang này phủ luồng nào, và ghi vào đâu.

3.1. **Tự dò danh sách luồng** từ nguồn (không bắt user tự liệt kê): đọc `srs/{feature}-userflow.md` (nguồn chia flow chuẩn — mỗi flow-slug + screens), fallback `usecases/` (mỗi UC ≈ 1 luồng) hoặc mô tả user cung cấp. Không có nguồn nào → hỏi user mô tả luồng cơ bản (các bước chính).

3.2. **In danh sách luồng dò được + HỎI user confirm** (AskUserQuestion hoặc chat): "Cẩm nang nên phủ những luồng này — đủ chưa, thêm/bớt luồng nào?" User chỉnh → chốt danh sách luồng sẽ viết. **KHÔNG tự quyết** phủ hết.

3.3. **Hỏi GỘP hay TÁCH** (nếu `docs/userguide/` đã có cẩm nang trước): (a) **cập nhật vào cẩm nang gốc** (thêm trang vào bundle + index đã có) hay (b) **tách riêng** (bundle `{feature}-userguide/` mới, file `.html` mới). Đề xuất mặc định: cùng feature/scope → cập nhật gốc; feature khác hẳn → tách riêng. User quyết.

3.4. Ghi 3 kết quả (danh sách luồng chốt · gộp/tách · scope) làm nền cho Pha B dựng mục lục — chỉ dựng trang cho luồng đã chốt, không lan man.

### Pha B — Dựng mục lục

4. **Cluster nội dung → 6 trụ** (xem bảng map trong Constraints). Mỗi trang gán: tiêu đề (task-based cho how-to), loại Diátaxis (nội bộ), feature/nguồn, 1 dòng mục đích.
5. **Thứ tự theo hành trình người vận hành:** Tổng quan → Bắt đầu nhanh → Hướng dẫn theo tác vụ (gom theo feature/area) → Tra cứu → Xử lý sự cố → FAQ → Thuật ngữ.
6. **Tự áp quality checklist** trước review: mỗi how-to tiêu đề động từ? không trộn loại? đủ 6 trụ với feature có nguồn? trang nào nguồn rỗng → OQ thay vì bịa?

### Pha C — @manual-reviewer gate

7. **Spawn `@manual-reviewer`** (Task tool) truyền: mục lục dự kiến, audience (admin/nội bộ), danh sách feature + nguồn mỗi cái, Open Questions hiện có. Agent review per `review-format.md` (verdict approve/revise/block + findings).
8. **Xử lý findings:** BLOCKING → sửa outline (bổ sung trụ thiếu, đổi tiêu đề task-based, tách trang trộn loại, chuyển trang nguồn-rỗng thành OQ). WARNING → cân nhắc sửa. Loop spawn lại ≤2 vòng nếu vẫn còn BLOCKING. Ghi nhớ "đã sửa gì theo review" để báo user.

### Pha C.4 — Hỏi audience + giọng + độ chi tiết (AskUserQuestion, TRƯỚC HARD STOP)

8.5. **4 quyết định định hình cách viết — hỏi qua AskUserQuestion** (đề xuất sẵn 1 lựa chọn từ ngữ cảnh để user xác nhận nhanh; AskUserQuestion luôn có sẵn "Other" để user nhập phương án khác — theo tinh thần no-auto-pick của `approval-gate.md`):
   - **Ngôn ngữ viết**: gợi ý theo ngữ cảnh (ngôn ngữ của nguồn BA docs / seed / feature) — đặt lên đầu, note "(đề xuất — từ {nguồn})". Vd nguồn tiếng Việt → gợi Tiếng Việt; app/nguồn tiếng Anh → gợi English. User chọn "Other" nhập ngôn ngữ khác (Nhật, Trung...) → viết toàn bộ cẩm nang bằng ngôn ngữ đó. KHÔNG mặc định cứng tiếng Việt — hỏi rồi mới viết.
   - **Audience** (người đọc cuối): Giáo viên / CSKH-vận hành / Học viên cuối / (khác). Suy đề xuất từ `scope` + nguồn; đặt option đề xuất lên đầu.
   - **Giọng + xưng hô**: thân thiện "bạn" / trung tính "quý vị"/bên thứ ba. Mặc định "bạn" thân thiện (điều chỉnh theo ngôn ngữ đã chọn).
   - **Độ chi tiết**: Ngắn gọn (quick-start + 1 how-to chính) / Vừa đủ (Tutorial + How-to + Tra cứu + Xử lý sự cố + FAQ — khuyến nghị) / Chi tiết sâu (nhiều ảnh trạng thái + edge case). Độ chi tiết quyết định số trang how-to + số lớp thông tin mỗi bước.
   - Ghi 4 quyết định vào `{ug-index}` frontmatter (`audience` + `lang`) + đầu index (giọng/độ-chi-tiết) để Pha D dùng chung, no-re-ask. **KHÔNG hỏi lại** nếu user đã nói trong seed/lần trước.

### Pha C.5 — IN OUTLINE RA CHAT + HARD STOP (KHÔNG ghi file)

9. **KHÔNG Write file outline.** Mục lục chỉ sống trong chat — outline là vật trung gian dùng-một-lần để user duyệt, không phải artifact cần lưu. (Artifact duy nhất là cẩm nang ở GĐ2.)
10. **HARD STOP — IN THẲNG OUTLINE + CÂU HỎI RA CHAT.** Viết GỌN: bảng 1 dòng/trang, gộp "đã chỉnh theo review" vào cột Ghi chú (KHÔNG tách mục review riêng). **DỪNG.** KHÔNG viết trang nào tới khi user confirm.

    Format in ra chat (terse — bảng 1 dòng/trang + câu hỏi đánh số):

    ```
    🛑 Mục lục cẩm nang {feature} — {N} trang · @manual-reviewer: {verdict}, {B} blocking

    Audience giả định: {1 dòng}. {1 dòng lưu ý nghiệp vụ nếu có tension}

    | # | Trang | Nhóm | Ghi chú (gồm chỉnh theo review) |
    |---|-------|------|----------------------------------|
    | 1 | ... | Tổng quan | {nguồn ngắn / "+review: thêm X" nếu có} |
    | ...

    ❓ Cần chốt:
      Q1 (blocking): {câu} — {gợi ý phương án a/b/c}
      Q2: {câu}
      ...

    → Trả lời câu hỏi (hoặc "ok" nếu mặc định) + chỉnh trang nếu cần, rồi gõ `tiếp`/`ok` → em viết luôn cẩm nang.
    ```

    Nguyên tắc terse: cột Ghi chú gộp cả nguồn + delta-review trong 1 dòng (vd `UC login, FR-005..007 · +review: link #2`). KHÔNG mục "Đã chỉnh theo reviewer" riêng. KHÔNG lặp lại định nghĩa Diátaxis. Câu hỏi mỗi câu 1 dòng, kèm gợi ý phương án để user chỉ cần chọn.

### Pha C.6 — Write `{ug-index}` NGAY sau khi user gõ `tiếp` (state artifact)

> Chống mất outline nếu turn bị ngắt (compact context, session mới, quay lại sau nhiều ngày) giữa lúc user confirm và lúc viết xong trang đầu tiên. KHÔNG phải file outline riêng — đây là chính `{ug-index}` sẽ tồn tại tới cuối skill, chỉ ghi sớm hơn thay vì đợi tới Pha E.

10.5. Ngay khi user gõ `tiếp`/`ok` (kèm answers), resolve scope → `{ug-dir}` (`userguide/` product · `{feature}-userguide/` feature) rồi **Write `docs/userguide/{ug-dir}/index.md`** với outline đã chốt (đã qua `@manual-reviewer` + đã áp answers vào audience/scope): frontmatter `type: userguide-index` + `scope` + `audience` + bảng Sections đủ N trang, mỗi trang `status: pending`. Đây LÀ bước ghi state — không đợi viết xong section nào mới ghi. Trước Write set env `CLAUDE_SKILL_NAME=/userguide` + `CLAUDE_CHANGELOG_AUTHOR={@author}` + `CLAUDE_CHANGELOG_NOTE=outline duyệt, {N} trang pending` (≤80 ký tự); hook ghép cả dòng vào activity.log.

### Pha D — Viết chi tiết per-section (sau khi user confirm)

11. **Nguồn outline đã duyệt = đọc `{ug-index}`** (vừa ghi ở Pha C.6), KHÔNG dựa vào trí nhớ hội thoại. Nếu turn hiện tại vừa qua HARD STOP (chưa bị ngắt) → dùng luôn context đang có. Nếu là turn/session mới (gọi lại `/userguide` mà thấy `{ug-index}` đã có outline `status: pending`) → Read file khôi phục outline, KHÔNG chạy lại Pha A-C, KHÔNG hỏi lại user.
12. **Per-section, gap-driven** theo `_templates/userguide-section.md` (chọn khung A/B/C/D/E/F theo loại):
    - Điền tối đa từ nguồn (UC → bước how-to; Error Matrix → bảng troubleshooting; FR → bảng reference; definitions → glossary; FAQ/Glossary → khung E/F).
    - **Resolve placeholder template**: template dùng `{{feature}}` (vd `srs/{{feature}}-spec.md`) — thay bằng slug feature THẬT của trang trước khi Write. KHÔNG để `{{feature}}` lọt vào trang stakeholder đọc.
    - Nhúng wireframe/ASCII sẵn có (tra bảng Screens cột "Thuộc flow" trong `{ug-index}` → đọc block `## Screen: {slug}` trong `ascii-wireframe/{flow-slug}.md` sub-section Wireframe, hoặc link `html-wireframe/`); chỗ cần ảnh thật → placeholder `![...](images/{slug}.png)` + bảng callout. Pha D.5 có thể thay placeholder bằng ảnh chụp thật.
    - Nguồn thiếu wording/limit cụ thể → `<!-- TBD ... OQ-{n} -->`. KHÔNG bịa.
    - Cross-link giữa how-to ↔ reference ↔ troubleshooting liên quan (Every Page Is Page One).
    - Sau khi viết xong 1 trang: **Edit `{ug-index}`** ngay, đổi dòng trang đó `status: pending` → `status: written` (L2 diff nhỏ). Đây là cách turn sau biết đã viết tới đâu nếu bị ngắt giữa Pha D.

### Pha D.5 — Ảnh minh họa: 3 cách (HỎI user chọn trước)

> Ảnh là phần minh họa các bước. Có 3 cách lấy ảnh — **hỏi user chọn** (AskUserQuestion), KHÔNG tự quyết:
> - **(A) Auto-chụp** — skill lái Playwright chụp app/HTML thật, đánh số/mũi tên tự động. Cần nguồn ảnh + (nếu app thật) user cấp URL/đăng nhập.
> - **(B) User tự chụp** — user KHÔNG muốn cấp quyền truy cập app. Skill viết đầy đủ chữ + **để placeholder kèm brief chi tiết** (chụp màn nào, ở bước nào, đánh dấu vùng nào) để user tự bỏ ảnh vào. Đây là default an toàn khi thiếu quyền.
> - **(C) Dùng ảnh sẵn có** — feature đã có wireframe/ASCII (`ascii-wireframe/`, `html-wireframe/`) → nhúng/link, không chụp mới.

12.5. **Hỏi cách lấy ảnh** (AskUserQuestion, đề xuất theo ngữ cảnh): có sẵn wireframe → gợi (C); có URL app + user OK cấp quyền → gợi (A); còn lại / user ngại cấp quyền → (B). Kết quả áp cho toàn bộ ảnh trong cẩm nang (hoặc hỏi per-nhóm nếu user muốn trộn).

12.6. **Nhánh (B) — User tự chụp (không auto):** với MỖI chỗ cần ảnh, giữ placeholder `![{caption}](images/{slug}.png)` + chèn **brief HTML-comment** ngay dưới (đã có trong `_templates/userguide-section.md`): màn/URL nào · chụp ở bước nào · trạng thái cần chụp · các vùng đánh dấu (1)(2)(3) khớp bảng callout. Bảng callout 5 cột vẫn viết đầy đủ → user chỉ việc chụp + vẽ số theo. Final report liệt kê danh sách ảnh cần bổ sung + đường dẫn `images/{slug}.png` để user thả vào. **Không auto-chụp, không đòi quyền.**

12.7. **Nhánh (A) — Auto-chụp: cần nguồn + user đồng ý.** Nguồn = (a) file HTML local (`html-design/{feature}-prototype.html`, `html-wireframe/{flow}.html`) hoặc (b) URL app thật (kèm đăng nhập). Hỏi thêm 2 điều:
   - **Phạm vi chụp**: đúng luồng cần / luồng + vài màn dự phòng.
   - **Che PII**: ảnh app thật có email/tên thật → hỏi che (mask) hay giữ nguyên. Che = liệt kê selector PII vào `mask` của job.

12.8. **(A) Check Playwright**: `node .claude/skills/userguide/engine/check-playwright.mjs` (đọc exit code + JSON). Thiếu module (exit 2) hoặc browser (exit 3) → **hỏi user "cài {module|chromium} không?"** rồi mới chạy lệnh trong `hint` (`npm install` / `npx playwright install chromium`). **KHÔNG tự cài im lặng.**

12.9. **(A) Build job.json** (xem header `capture.mjs` để biết schema): outDir `docs/userguide/{ug-dir}/images`; mỗi screen 1 shot với `slug` (khớp tên file placeholder), `html` HOẶC `url`+`login`, `frame` (nếu nội dung trong iframe — bắt buộc kiểm bằng probe), `waitFor`/`waitMs`, `steps` (thao tác trước khi chụp), `callouts`, `mask` (PII). Callout selector chấp Playwright pseudo (`:has-text`, `text=`).
   - **Kiểu annotation mỗi callout** (chọn theo mục đích nhấn mạnh): `{"selector","n":1}` = badge SỐ (map từ bảng 5 cột); `{"selector","type":"arrow","dir":"left","text":"..."}` = MŨI TÊN chỉ vào + nhãn chữ (dir=phía đặt nhãn: left/right/top/bottom); `{"selector","type":"label","text":"Bấm đây"}` = nhãn chữ + mũi tên; `{"selector","type":"box","color":"#2563eb"}` = chỉ khung highlight. Mọi kiểu đều kèm khung quanh element. Dùng arrow/label khi bước cần **hướng dẫn/nhấn mạnh rõ**; dùng badge số khi map 1-1 với bảng thao tác.

12.10. **(A) Chạy** `node .claude/skills/userguide/engine/capture.mjs <job.json>` **từ repo root**. Engine: chờ font ready + freeze animation → định vị element qua locator (iframe-aware) → inject SVG overlay TRƯỚC screenshot → ghi PNG + `.png.sha1`. Ảnh không đổi (sha1 khớp) tự skip; ép chụp lại đặt env `UG_FORCE=1`.

12.11. **(A) Đọc lại report** engine (JSON): `errors` rỗng? `warnings` (callout selector no match) → sửa selector. **Tự soi ảnh** (Read PNG) 1-2 tấm kiểm callout đúng chỗ chưa. Ổn → placeholder trong trang đã trỏ đúng `images/{slug}.png` (giữ nguyên bảng callout — số/nhãn trên ảnh khớp bảng). Lỗi → giữ placeholder + brief (như nhánh B), ghi OQ.

### Pha E — Write + index

13. **L1 plan preview (BA-facing prose, batch)** — liệt kê các trang sẽ tạo + 1 dòng nội dung nổi bật mỗi trang + số OQ. Prose tự nhiên (`ba-conventions` Mục 5), KHÔNG bảng dev. User Y.
14. **Write** từng trang vào `{ug-dir}/pages/{slug}.md`. (Bình thường Pha D đã viết hết — đây chỉ bù trang còn sót nếu turn bị gián đoạn giữa loop.) File đã tồn tại → update mode, L2 diff.
15. **Update `{ug-index}`** (đã tồn tại từ Pha C.6, KHÔNG tạo mới) — mọi dòng Sections giờ `status: written`. Đây là index duy nhất, không có file outline riêng.

### Pha F — Render preview

16. **Render cửa vào + data:**
    - Sinh `{ug-dir}/data.js`: `window.GUIDE = { product, scope, audience, updated, sections: [{slug, title, group, diataxis, file, md}] }`. `file` = tên file nguồn của trang (vd `huong-dan-dich-cau.md`) — renderer dùng để map cross-link `.md` giữa các trang → chuyển section nội bộ (KHÔNG mở file). `md` = nội dung trang từ `pages/*.md`, đã strip HTML-comment TBD/OQ, **rewrite path ảnh** `](images/` → `](${ug-dir}/images/` vì file `.html` ở top-level còn ảnh trong bundle.
    - **Cross-link giữa trang:** viết dạng link `.md` bình thường (`[Trang X](./x.md)`) — renderer tự map sang section qua `file`/title. KHÔNG cần viết `#slug` thủ công.
    - Copy `_templates/userguide-preview.html` → `docs/userguide/{ug-html}`, sửa `<script src>` trỏ `{ug-dir}/data.js`.
    - Template **light-only, docs-style** (trắng/đen + xanh dương highlight, KHÔNG dark toggle). Double-click `{ug-html}` mở browser file://. Self-contained, no CDN.

### Pha G — Gom Open Questions + final report

> `/userguide` là **forward-terminal** (nguồn = BA docs đã chốt; downstream chỉ `/export`). OQ ở đây thuần loại "nguồn BA thiếu wording/limit/lỗi cụ thể" → **KHÔNG cascade upstream/downstream** như spec docs. Vì thế skill KHÔNG dùng `resolve-oqs.md` (rule đó dành cho chuỗi requirements `/prd`→`/srs`) — xử lý gọn tại chỗ:

17. **Gom OQ:** grep mọi `<!-- TBD ... OQ-{n} -->` trong các trang vừa viết → in danh sách + hỏi `Resolve giờ? (Y / skip / ids)`.
    - `skip` → giữ OQ trong index (mục "Open Questions"), gợi user chạy `/cr` nếu là khác biệt nghiệp vụ thật.
    - `Y` / `ids` → loop 1-by-1: user trả lời → **L2 diff** trang liên quan (điền chỗ TBD) + gỡ marker OQ. **KHÔNG sửa ngược spec** — manual là forward, spec là nguồn; nếu answer mâu thuẫn spec → ghi OQ + gợi `/cr`, không tự đổi.
    - Mỗi trang bị sửa: set `CLAUDE_CHANGELOG_NOTE` trước Edit (hook ghi activity.log).
18. **Final report:**
    ```
    ✅ Cẩm nang vận hành xong: docs/userguide/
       Trang đã viết: {N} ({tutorial}/{howto}/{reference}/{trouble}/...)
       Scope: {product | feature:slug} | Feature phủ: {F} | Open Questions còn hold: {Q}
       Ảnh: {đã auto-chụp K / chờ user tự chụp M} | Mở: docs/userguide/{ug-html} (double-click)

    {Nếu nhánh B — user tự chụp:}
    📸 Ảnh cần bổ sung (thả file đúng tên vào docs/userguide/{ug-dir}/images/):
       - {slug}.png — {màn/bước} — đánh dấu (1){vùng} (2){vùng}
       - ...

    Recommended next:
      - /export <...> pdf   — đóng gói cẩm nang ra PDF cho stakeholder
      - /userguide — gọi lại khi BA docs đổi, skill tự update
    ```

## Gotchas

- **Đây là FORWARD từ BA docs đã chốt** — KHÔNG sửa nghiệp vụ, KHÔNG sáng tạo tính năng ngoài nguồn. Manual phản ánh đặc tả; khác biệt phát hiện → ghi OQ, gợi `/cr`/`/gap`, không tự đổi.
- **HARD STOP là bắt buộc** — sau khi in mục lục ra chat, DỪNG. Đừng "tiện tay" viết trang. User phải duyệt mục lục + trả lời câu hỏi trước.
- **@manual-reviewer review OUTLINE, không review nội dung chi tiết** (chưa viết). Mục tiêu: cấu trúc + độ phủ + phân loại + tiêu đề task-based đúng TRƯỚC khi đổ công viết.
- **Đừng để lộ "Diátaxis" trong output stakeholder** — tên trang tiếng Việt thân thiện; loại Diátaxis chỉ là metadata nội bộ trong `{ug-index}` để audit không-trộn-loại.
- **Tutorial 1 đường** — "Bắt đầu nhanh" KHÔNG liệt kê mọi tùy chọn (đó là Tra cứu). Người mới đi đúng 1 lối đảm bảo thành công.
- **Nguồn rỗng → OQ, không bịa** — feature chưa có screens/wording cụ thể thì trang how-to để TBD + OQ, không tự chế thao tác/giá trị.
- **Audience admin ≠ developer** — được dùng thuật ngữ hệ thống, nhưng vẫn là "làm xong việc gì", không phải "gọi API nào". Giữ task-based.
- **`{ug-html}` self-contained + light-only** — docs-style (trắng/đen + xanh dương CHỈ highlight link + mục đang chọn, như Word/Notion). KHÔNG dark mode (tài liệu cần rõ ràng nhất quán). KHÔNG CDN ngoài. Data tách `{ug-dir}/data.js` để regen không đụng HTML.
- **Cấu trúc gọn** — top-level `docs/userguide/` chỉ lộ file `.html`; mọi file phụ (index/data/pages/images) nằm trong `{ug-dir}`. User chỉ mở 1 file.
- **Cross-link giữa trang KHÔNG mở file .md** — các trang là section trong SPA `{ug-html}`, KHÔNG phải file mở riêng. Viết link dạng `[Trang X](./{basename}.md)` với `{basename}` **khớp đúng tên file trong `pages/`** — renderer map basename → section qua field `file` trong data.js rồi chuyển section nội bộ (chặn click, không navigate ra file). Sai basename → link không nhảy (renderer fallback khớp title, nhưng nên viết đúng tên). KHÔNG viết link trỏ `../` hay path cũ trước khi restructure.
- **Auto-chụp ảnh thật (Pha D.5, có engine)** — engine `.claude/skills/userguide/engine/capture.mjs` (Playwright) chụp file HTML local HOẶC URL app thật (đăng nhập + điều hướng + thao tác), iframe-aware, inject SVG overlay đánh số theo bounding-box (bảng callout 5 cột là kịch bản), che PII qua `mask`, sha1 chống lỗi-thời. **Luôn hỏi user** phạm vi + PII + cài Playwright (không auto). Không có nguồn ảnh / user skip → giữ placeholder.
- **Nội dung trong iframe** — nhiều app SPA nhúng nội dung chính trong iframe khác origin (vd nội dung bài học ở `materials.*` trong khi vỏ ở `teacher.*`). `body.innerText` trang ngoài rỗng nhưng screenshot vẫn đủ. Engine hỗ trợ `frame` (khớp url-substring) để định vị element + chụp đúng. Selector `getByRole`/`text=` trên page ngoài KHÔNG thấy element trong iframe → phải trỏ frame.
- **Playwright version ↔ browser** — module cài rồi vẫn có thể thiếu chromium đúng build (vd cache có `chromium-1217` nhưng cần `-1228`). `check-playwright.mjs` exit 3 báo thiếu browser → `npx playwright install chromium`.
- **`docs/userguide/` chưa tồn tại** → Write tự tạo. `images/` để user tự bỏ ảnh sau (placeholder trỏ tới đó).
- **Update mode (file đã tồn tại)** → Read `{ug-index}` + trang cũ trước, L2 diff per file, set env note (hook ghi activity.log). Outline cũ còn → đối chiếu trang mới/bỏ.
- **@author resolution** (`ba-conventions` Mục 1) cho activity.log — KHÔNG ghi `owner` vào frontmatter (đã diet).

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../agents/manual-reviewer.md
- @../../../_templates/userguide-section.md
- @../../../_templates/userguide-preview.html
- engine/capture.mjs (chụp + annotate ảnh, Pha D.5) · engine/check-playwright.mjs (kiểm tra + hướng dẫn cài)

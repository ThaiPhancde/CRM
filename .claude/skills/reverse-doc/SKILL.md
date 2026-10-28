---
name: reverse-doc
description: Dùng khi cần tái lập bộ tài liệu SRS từ nguồn CŨ (docx/pdf/ảnh/spec rời) — đọc nguồn, cluster thành feature, dựng reverse-SRS đa tầng kèm nhãn độ tin cậy + gaps. KHÔNG phỏng vấn (nguồn = proof). Kích hoạt bằng `/reverse-doc @<nguồn>` hoặc `/reverse-doc <thư mục nguồn>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
argument-hint: "@<file nguồn> | <thư mục nguồn> | (empty để hỏi nguồn)"
---

# /reverse-doc — Tái lập SRS từ nguồn cũ

## Goal

Đọc **tài liệu nguồn cũ** (docx/pdf/ảnh chụp/spec rời rạc) rồi **tái lập thành bộ SRS đa tầng** trong `docs/_reverse/{feature}/`: `{feature}-reverse-spec.md` (SRS 12 mục đầy đủ + **Mục 0 provenance** + cột **Nguồn/Nhãn** mỗi bảng) · `reverse-sources.md` (danh mục nguồn) · `reverse-gaps.md` (OQ/Gap/Conflict) · `srs/{feature}-reverse-{flows,states,erd}.md` (mermaid) · `usecases/{feature}-reverse-usecase-index.md` + `uc-*.md`. Ghi **tách** doc chính thức (trong `docs/_reverse/`, KHÔNG đè `docs/{feature}/`).

**KHÔNG phỏng vấn** — nguồn là bằng chứng; chỗ nguồn thiếu/mơ hồ/mâu thuẫn → ghi vào `reverse-gaps.md`, KHÔNG dừng hỏi user. Có thể cluster 1 nguồn thành **NHIỀU feature** cùng lúc.

## Constraints

- **Nhóm A biến thể (derive từ NGUỒN, không phỏng vấn).** Chỉ hỏi DUY NHẤT "nguồn ở đâu" khi no-arg (`feature-bootstrap.md` nhóm A ghi chú reverse-doc).
- **2 bước HARD STOP:** (1) sau khi cluster nguồn → feature + map nguồn → **plan** (`reverse-plan.json` + preview) → user chốt danh sách feature; (2) L1 trước Write mỗi feature.
- **L1 approval** trước mọi Write. Resumable qua `reverse-plan.json` (feature `pending`/`done`).
- **Nhãn độ tin cậy 3 mức** mỗi mục nội dung: **✅ nguồn nói rõ** · **🔵 suy luận hợp lý từ nguồn** · **🟡 giả định/gap (nguồn không nói)**. Cột Nguồn trỏ file+vị trí nguồn.
- **KHÔNG bịa nghiệp vụ** — nguồn không nói → 🟡 + ghi `reverse-gaps.md`, KHÔNG chế FR/số/wording. Mâu thuẫn giữa nguồn → ghi Conflict, giữ cả 2 + đánh dấu.
- **status: draft CỨNG** — reverse-SRS KHÔNG bao giờ `approved` (là tái lập, cần người xác thực).
- **Ghi tách** — `docs/_reverse/{feature}/`, KHÔNG đè `docs/{feature}/` (tránh ghi đè doc chính thức). Convert tạm: `docs/_reverse/.convert/`.
- **keyword-detection** (`keyword-detection.md`) để classify nội dung nguồn (đâu là FR, flow, rule, wording, user story...).
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first** (auto-detect từ nguồn). Frontmatter reverse types.

## Inputs

```
/reverse-doc @old-spec.docx          # 1 file nguồn
/reverse-doc docs/legacy/            # cả thư mục nguồn
/reverse-doc @screenshot1.png @screenshot2.png   # nhiều ảnh
/reverse-doc                         # hỏi nguồn ở đâu
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Reverse plan cũ? !`[ -f docs/_reverse/reverse-plan.json ] && echo "có — resume được" || echo "chưa"`

## Approach

### Bước 1 — Đọc nguồn + cluster (HARD STOP 1)

1. **Đọc nguồn:** file → Read (docx/pdf qua convert nếu cần → `.convert/`; ảnh → vision, cảnh báo chất lượng). Thư mục → glob tất cả.
2. **Classify + cluster:** dùng keyword-detection nhận diện loại nội dung; cluster theo **domain nghiệp vụ** → các feature dự kiến. Derive slug mỗi feature từ nội dung nguồn.
3. **Dựng `reverse-plan.json`** (manifest: list feature + `sources[]` map + status pending) + preview:
   ```
   Nguồn: {N file}. Em nhận diện {M} feature:
     - {feature-1} ← {nguồn a, b}
     - {feature-2} ← {nguồn c}
   Chốt danh sách này để em tái lập? (chốt / sửa / hủy)
   ```
   **HARD STOP** — chờ user chốt. KHÔNG tự đi tiếp.

### Bước 2 — Tái lập mỗi feature (HARD STOP 2 = L1 mỗi feature)

4. Cho mỗi feature (chốt ở bước 1), tái lập từ nguồn:
   - **`{feature}-reverse-spec.md`** — SRS 12 mục + **Mục 0** (nguồn/confidence/đối chiếu) + mỗi bảng có cột **Nguồn** + **Nhãn** (✅/🔵/🟡). FR/NFR/BR/Error rút TỪ NGUỒN, nhãn theo độ rõ.
   - **`srs/{feature}-reverse-{flows,states,erd}.md`** — mermaid nếu nguồn có flow/state/data (nhãn nguồn).
   - **`usecases/{feature}-reverse-usecase-index.md` + `uc-*.md`** — nếu nguồn có use case/flow.
   - **`reverse-sources.md`** (danh mục nguồn) + **`reverse-gaps.md`** (OQ/Gap/Conflict — mọi 🟡 + mâu thuẫn).
5. **L1 plan preview** mỗi feature (prose): "Em sẽ tạo bộ reverse cho `{feature}`: {N} FR (✅{a}/🔵{b}/🟡{c}), {E} error, {G} gap/conflict. Apply?" → Write → cập nhật `reverse-plan.json` feature `done`.

### Bước 3 — Report

6. **Output report:**
   ```
   ✅ Reverse-doc: docs/_reverse/ → {M} feature tái lập
      Mỗi feature: reverse-spec + gaps + (flows/states/erd/usecases nếu có)
      Độ tin cậy tổng: ✅{a}% rõ · 🔵{b}% suy luận · 🟡{c}% gap
      Gaps/Conflicts cần người xác thực: {G} (xem reverse-gaps.md)

   Bước tiếp: người xác thực nội dung 🟡 + Conflict → chuyển sang docs/{feature}/ chính thức
   (chạy /srs {feature} dùng reverse-spec làm nguồn), rồi /gap soát.
   ```

## Gotchas

- **KHÔNG phỏng vấn** — reverse dựa NGUỒN, không hỏi user suy nghiệp vụ. Chỗ thiếu → 🟡 + reverse-gaps.md.
- **KHÔNG bịa** — nguồn không nói → 🟡/gap, tuyệt đối không chế FR/số/wording. Mâu thuẫn → Conflict, giữ cả 2.
- **Ghi tách `docs/_reverse/`** — KHÔNG đè doc chính thức `docs/{feature}/`.
- **status draft cứng** — reverse cần người xác thực, không auto-approve.
- **Ảnh nguồn chất lượng thấp** — cảnh báo; nội dung đọc mờ → 🟡.
- **Resumable** — `reverse-plan.json` cho phép dừng giữa chừng + chạy lại tiếp feature `pending`.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/keyword-detection.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/diagram-selection.md
- @./references/example-reverse-doc.md

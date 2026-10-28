---
name: api-map
description: Dùng khi cần lập field mapping 3 tầng cho một tích hợp — field của ta ↔ field của vendor ↔ transform/quy tắc chuyển đổi, cho cả chiều out (ta gọi họ) và in (webhook họ gọi ta). Hội tụ dưới api-design, trước api-checklist. Kích hoạt bằng `/api-map <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature>"
---

# /api-map — Field mapping 3 tầng

## Goal

Viết **field mapping** tại `docs/{feature}/integration/api-map.md`: bảng **3 tầng** cho mỗi operation trong blueprint:
- **Field của ta** (entity/thuộc tính nghiệp vụ — từ SRS Data Requirements) ↔ **Field của vendor** (từ `api-summary`) ↔ **Transform** (đơn vị, định dạng, enum-map, bắt buộc/tùy chọn, default).
- Cả **direction out** (request ta gửi vendor) và **in** (webhook vendor gửi ta).
- Đánh dấu field **chưa map được** (thiếu ở 1 bên) → OQ, KHÔNG bịa.

Hội tụ dưới `api-design.md`; là nguồn cho `/api-checklist` + `/api-test`.

## Constraints

- **Nhóm B — cần blueprint + contract + entity** (`feature-bootstrap.md`): `integration/api-design.md` + `api-summary.md` + SRS Data Requirements. Thiếu design → refuse + route `/api-design`.
- **KHÔNG bịa field 2 bên** — field ta từ SRS entity; field vendor từ api-summary (nguồn thật). Chỗ 1 bên thiếu → đánh OQ (không tự tạo field).
- **Transform rõ ràng** — đơn vị (đồng vs cent), định dạng (ISO date), enum-map (trạng thái ta ↔ mã vendor), bắt buộc/tùy chọn, default. Đây là nơi lỗi tích hợp hay nấp (đơn vị tiền!).
- **Đánh dấu source-of-truth** cho field 2 chiều (khớp `api-design`).
- **KHÔNG map secret** — key/token không phải field nghiệp vụ; bỏ qua (xử lý ở env).
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update.
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-map`.

## Inputs

```
/api-map food-delivery      # field mapping từ api-design + api-summary + SRS entity
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có api-design: !`for d in docs/*/integration/api-design.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
api-map đã có: !`ls docs/*/integration/api-map.md 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + gather
1. **Resolve feature.** Thiếu api-design → refuse + route `/api-design`. Update mode? map tồn tại → Read full.
2. **Gather:** operation + field vendor (api-summary) · entity + thuộc tính (SRS Data Requirements) · state-map + source-of-truth (api-design).

### Phase B — Dựng bảng mapping
3. **Mỗi operation** (out + in): bảng `Field ta | Field vendor | Kiểu/đơn vị | Bắt buộc | Transform | Nguồn chân lý | Ghi chú`. Enum/trạng thái map theo state-map. Field 1 bên thiếu → OQ.

### Phase C — Approval + Write
4. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `integration/api-map.md`: mapping {N} operation ({out}/{in}), {M} field, {K} transform (đơn vị/enum/date). {Q} field chưa map (OQ). Apply?
5. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-map` + author + note). Write.

### Phase D — Report
6. **Report:**
    ```
    ✅ API map: docs/{feature}/integration/api-map.md
       {N} operation · {M} field · {K} transform | chưa map: {Q} (OQ)
    Tiếp: /api-checklist {feature} (test outline own/3rd/mixed × out/in)
    ```

## Gotchas

- **Sai đơn vị tiền** (đồng vs cent, ×100) — lỗi tích hợp kinh điển; transform phải ghi rõ.
- **Bịa field** khi 1 bên thiếu — phải OQ.
- **Bỏ quên chiều in (webhook)** — map cả field webhook gửi về.
- **Map secret như field** — sai; key/token ở env.
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
- @../../rules/kg-usage.md
- @../../../_templates/api-map.md
- @./references/example-api-map.md

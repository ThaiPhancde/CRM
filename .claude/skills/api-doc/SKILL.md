---
name: api-doc
description: Dùng khi cần đọc & tóm tắt contract API của nhà cung cấp thành bản BA đọc được — operation chính, mô hình auth mức cao, rate limit, error semantics, webhook. Đọc TỪ tài liệu vendor (proof), KHÔNG bịa endpoint. Kích hoạt bằng `/api-doc <feature> @<nguồn doc vendor>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature> @<đường-dẫn doc/OpenAPI/URL vendor> [--provider tên]"
---

# /api-doc — Tóm tắt contract API bên thứ 3

## Goal

Đọc tài liệu API của nhà cung cấp (doc/OpenAPI/Postman/ảnh chụp) và viết **bản tóm tắt BA đọc được** tại `docs/{feature}/integration/api-summary.md` (nhiều vendor → `api-summary-{provider}.md`):
- **Operation chính** (mỗi cái: làm gì về NGHIỆP VỤ, method+path lấy từ doc, tham số/kết quả cốt lõi).
- **Auth** (mô hình mức cao: API key / OAuth / signature — KHÔNG chép secret).
- **Rate limit / quota**, **Error semantics** (mã lỗi vendor → ý nghĩa nghiệp vụ), **Webhook/callback** (nếu có), **Môi trường** (sandbox/prod), **Idempotency** (vendor hỗ trợ không).

## Constraints

- **Nhóm B — cần NGUỒN doc vendor làm proof** (`feature-bootstrap.md` + `api-integration.md`): giống `/reverse-doc`, đọc nguồn, KHÔNG phỏng vấn bịa. Không có nguồn → hỏi DUY NHẤT "doc vendor ở đâu". Không có feature → refuse + route `/srs`.
- **KHÔNG BỊA endpoint/field/mã lỗi** — chỉ ghi cái CÓ trong doc vendor (ghi nguồn: mục/trang). Doc thiếu/mơ hồ → OQ, không chế. Đây là điểm sinh tử: bịa contract làm tích hợp sai (tiền/đơn).
- **Tóm tắt NGHIỆP VỤ, không chép nguyên** — mỗi operation nói "để làm gì trong luồng của ta", không dán toàn bộ schema. Method+path giữ đúng doc để trace.
- **KHÔNG chép secret** — auth mô tả mô hình (Bearer/HMAC), key/token dùng placeholder, đọc từ env sau này.
- **L1 TRƯỚC Write** (`approval-gate.md`), **L2 diff** khi update.
- **Doc sạch** (`ba-conventions.md`). **Vietnamese-first**. Frontmatter `type: api-summary` + `provider`.

## Inputs

```
/api-doc food-delivery @paygate-openapi.yaml           # tóm tắt từ OpenAPI
/api-doc food-delivery @vendor-docs/ --provider PayGate # tóm tắt từ thư mục doc
/api-doc food-delivery @screenshot-api.png             # đọc ảnh chụp doc (vision)
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có integration: !`for d in docs/*/integration/; do [ -d "$d" ] && basename $(dirname "$d"); done | tr '\n' ' '`
api-summary đã có: !`ls docs/*/integration/api-summary*.md 2>/dev/null | tr '\n' ' '`

## Approach

### Phase A — Resolve + đọc nguồn

1. **Resolve feature + nguồn vendor.** Thiếu nguồn → hỏi "doc ở đâu". Thiếu feature → refuse + route `/srs`.
2. **Đọc nguồn** (OpenAPI/markdown/ảnh). `.yaml/.json` OpenAPI → parse operation; ảnh → vision; URL → cần fetch (báo nếu không truy cập được). Convert cần công cụ tùy nguồn.

### Phase B — Trích operation (từ nguồn)

3. **Liệt kê operation liên quan nhu cầu của ta** (không cần chép hết API vendor — chỉ cái luồng ta dùng). Mỗi operation: mục đích nghiệp vụ + method/path + tham số/kết quả cốt lõi + mã lỗi.
4. **Auth / rate limit / webhook / môi trường / idempotency** — trích mức cao. Thiếu → OQ.

### Phase C — Approval + Write

5. **L1 plan preview** (prose BA):
   > Em sẽ {tạo/cập nhật} `integration/api-summary{-provider}.md` từ {nguồn}: {N} operation ta cần, auth {mô hình}, rate limit {…}, webhook {có/không}. {Q} điểm doc chưa rõ (OQ). Apply?
6. **Set env trước Write** (`CLAUDE_SKILL_NAME=/api-doc` + author + note). Write.

### Phase D — Report

7. **Report:**
    ```
    ✅ API summary: docs/{feature}/integration/api-summary{-provider}.md
       {N} operation · auth {…} · webhook {…} | Nguồn: {vendor doc} | OQ: {n}
    Tiếp: /api-design {feature} (Integration Blueprint: orchestration/state/webhook/retry)
    ```

## Gotchas

- **Bịa endpoint/field/mã lỗi không có trong doc** — CẤM tuyệt đối (tích hợp sai = mất tiền/đơn). Thiếu → OQ.
- **Chép nguyên schema** — tóm tắt nghiệp vụ, giữ method/path để trace.
- **Chép secret vào doc** — chỉ mô tả mô hình auth; key ở env.
- **Tóm tắt cả API vendor** — chỉ operation ta thực sự dùng trong luồng.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/api-integration.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @../../../_templates/api-summary.md
- @./references/example-api-doc.md

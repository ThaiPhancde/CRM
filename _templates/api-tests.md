---
type: api-tests
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/test/api/api-checklist.md
---

# {{feature_name}} — API Tests (Bruno)

> Collection sinh bởi engine `api-test-gen.mjs` từ `bruno/plan.json` + `bruno/vars.json`. `.bru` là output máy — KHÔNG sửa tay. Secret qua env (`{{process.env.KEY}}`).

## Requests

| # | Request | test_layer | direction | Trạng thái | Nguồn |
|---|---|---|---|---|---|
| 1 | {{tạo giao dịch}} | 3rd | out | ✅ chạy được | ACHK-001 |
| 2 | {{truy vấn trạng thái}} | 3rd | out | ⧗ .bru.todo (chờ URL sandbox) | ACHK-00N |

## Cách chạy

1. Mở collection `bruno/` bằng Bruno app/CLI.
2. Chọn environment `sandbox`.
3. Set biến môi trường secret: `export {{PROVIDER}}_KEY=...` (KHÔNG commit).
4. Run — request `.bru.todo` bị bỏ qua (chưa map đủ, không tính pass/fail).

## Chưa chạy được (todo)

- {{request}} — {{lý do: thiếu URL sandbox / giá trị thật — KHÔNG bịa để xanh}}

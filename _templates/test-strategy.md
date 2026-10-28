---
type: test-strategy
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature}}-spec.md
---

# {{feature_name}} — Test Strategy

> Chiến lược test dùng CHUNG cho `/test-checklist` + `/test-cases` (intake no-re-ask). Phần "durable" ít đổi; phần "per-run" cập nhật mỗi đợt test.

## Durable

- **Môi trường**: {{staging / prod-like / local}}
- **Dữ liệu test**: {{tài khoản mẫu, nhà hàng mẫu, số tiền mẫu...}}
- **Thiết bị / trình duyệt**: {{mobile 375 / desktop 1024, Chrome...}}
- **Ngôn ngữ**: {{vi / en}}
- **Phạm vi**: {{tính năng nào trong scope, ngoài scope}}

## Per-run

- **Mục đích đợt**: {{smoke / regression / feature test}}
- **Baseline**: {{build/version đang test}}
- **Profile**: {{tập test chạy: P0-only / full...}}

## Open Questions

- [ ] {{OQ nếu thiếu thông tin — KHÔNG bịa}}

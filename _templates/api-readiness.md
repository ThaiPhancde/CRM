---
type: api-readiness
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/integration/api-design.md
  - docs/{{feature_slug}}/test/api/api-checklist.md
---

# {{feature_name}} — Go-live Gate ({{provider}})

## 1. Cutover
{{Chuyển sandbox → production: thời điểm, ai, thứ tự.}}

## 2. Feature flag
{{Bật/tắt tích hợp, rollout từng phần.}}

## 3. Monitoring & alert
{{Theo dõi: tỉ lệ lỗi, thời gian phản hồi, webhook trễ — ngưỡng cảnh báo.}}

## 4. Rollback
{{Quay lui: tắt flag, fallback nghiệp vụ (bám degraded-UX của api-design).}}

## 5. SLA & deprecation
{{Cam kết vendor; xử lý khi vendor đổi/ngừng API.}}

## 6. Secret production
{{Key production ở env, tách sandbox, đã test — KHÔNG in secret.}}

## Bảng Go / No-Go

| Hạng mục | Trạng thái | Bằng chứng / việc còn thiếu |
|---|---|---|
| Cutover plan | ✅/❌ | {{}} |
| Feature flag | ✅/❌ | {{}} |
| Monitoring | ✅/❌ | {{}} |
| Rollback + degraded-UX | ✅/❌ | {{}} |
| Test pass (không còn .bru.todo tiền-đơn) | ✅/❌ | {{}} |
| Secret production | ✅/❌ | {{}} |
| OQ tiền/đơn đã chốt | ✅/❌ | {{}} |

**Kết luận:** {{GO / NO-GO}} — {{blocker nếu No-Go}}
**Người duyệt:** {{tên / vai trò / ngày}}

## Open Questions

- [ ] OQ-1: {{blocker go-live}}

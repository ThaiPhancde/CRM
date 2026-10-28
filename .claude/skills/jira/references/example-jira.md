# Ví dụ chuẩn — /jira (đồng bộ User Story ↔ Jira)

> Mẫu `/jira push food-delivery` khi **chưa cấu hình kết nối** (dry-run) và khi **đã có kết nối**. Học: KHÔNG bịa key; report phân biệt đã-đẩy-thật vs dry-run; 3-way merge chống đè; mapping ở `sync-state.yaml`.

---

## sync-state.yaml (sau lần push thật đầu tiên)

```yaml
version: 1
config:
  jira:
    base_url: "https://acme.atlassian.net"
    project_key: "FD"
    issue_type_map: { story: Story, epic: Epic }
    connection: env
mappings:
  jira:
    - artifact: docs/food-delivery/userstories/us-001.md
      key: "FD-12"
      url: "https://acme.atlassian.net/browse/FD-12"
      last_pushed: "2026-07-27T09:15:00"
      local_hash: "a1b2c3"
      remote_version: "1"
      status_local: approved
      status_remote: "To Do"
```

## Report push (có kết nối)

```
✅ Jira sync `food-delivery` (push):
   Đã đẩy thật: US-001→FD-12 (v1) · US-003→FD-13 (v1)
   Conflict giữ local: US-004 (Jira sửa tay v1→v2 — bạn chọn giữ local)
   Bỏ qua (không đổi): US-005 (hash khớp)
```

## Report push (CHƯA cấu hình — dry-run)

```
⧗ Jira dry-run `food-delivery` (chưa cấu hình kết nối):
   US-001 → SẼ tạo issue: [Story] "Khách đặt đơn và theo dõi trạng thái"
            description: FR-food-delivery-003, FR-food-delivery-005 + AC-001..003
   US-002 → SẼ tạo issue: [Story] "..."   (key: — chưa đẩy)
→ Điền .claude/state/atlassian/sync-state.yaml (config.jira.base_url + project_key) để đẩy thật.
```

---

**Vì sao mẫu này tốt:** (1) Dry-run in **payload thật** + `key: —`, KHÔNG bịa `FD-99`. (2) Report **tách bạch** đã-đẩy-thật (có key `FD-12`) vs dry-run (`⧗`). (3) US-004 Jira đổi ngoài → **CONFLICT**, hỏi user, không nuốt. (4) US-005 hash khớp → **skip** (idempotent). (5) `key`/`url` chỉ điền **sau khi** API thật trả về. (6) Token KHÔNG nằm trong file (`connection: env`).

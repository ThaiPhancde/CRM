---
name: jira
description: Dùng khi cần đồng bộ User Story sang Jira — đẩy (push) story thành issue, kéo (pull) trạng thái workflow về, hoặc xem drift (status). Đồng bộ 2 chiều an toàn qua sync-state, 3-way merge, KHÔNG bịa key. Kích hoạt bằng `/jira <push|pull|status> [feature]`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<push|pull|status> [feature] [--dry-run] [--allow-draft]"
---

# /jira — Đồng bộ User Story ↔ Jira

## Goal

Đồng bộ **user story** (`docs/{feature}/userstories/us-*.md` + `{feature}-story-index.md`) với **Jira issue** một cách an toàn:
- **push** — mỗi US → 1 Jira issue (Story/Epic theo map), điền lại `key`/`url` vào `sync-state.yaml` + cột `jira-key` của story-index.
- **pull** — kéo **workflow status** từ Jira về cột `status_remote` + gợi ý cập nhật index (không đổi nội dung local).
- **status** — in bảng **drift** (local vs remote vs base), read-only, KHÔNG gọi API.

Nội dung đẩy 1 chiều (local là nguồn); workflow status kéo 1 chiều về. Mapping GỘP tại `.claude/state/atlassian/sync-state.yaml` (`mappings.jira`).

## Constraints

- **Nhóm B — cần US làm nguồn** (`feature-bootstrap.md`). Chưa có `userstories/us-*.md` → **refuse tường minh + route `/userstory {feature}`**. KHÔNG tự tạo feature, KHÔNG bịa story.
- **External side-effect — L1 TRƯỚC mỗi lần đẩy** (`approval-gate.md` + `atlassian-sync.md`). KHÔNG có chế độ tự đẩy im lặng.
- **Hard gate** (`atlassian-sync.md` Mục 3): US `status: stale` → REFUSE (route chạy lại `/userstory`). US `status: draft` → chặn trừ khi `--allow-draft`. Đang lock → chờ.
- **KHÔNG BỊA key/URL.** Thiếu `config.jira.base_url` → ép **dry-run**: in payload sẽ gửi + `⧗ chưa đẩy (thiếu kết nối)`. `key`/`url` chỉ điền **sau khi** API thật trả về.
- **3-way merge** (`atlassian-sync.md` Mục 4) khi US đã có `key` + Jira đổi ngoài (remote_version tăng) → CONFLICT, hỏi user, KHÔNG tự đè.
- **Idempotent qua hash** — US không đổi (local_hash khớp) → skip, không update thừa.
- **KHÔNG lưu token** vào file (đọc từ env). **Vietnamese-first.** IT-BA framing — không hỏi cấu hình kỹ thuật Jira sâu (chỉ project_key + issue-type map).
- **story-index là nguồn status/jira-key** (`naming-conventions.md`) — cập nhật `jira-key` ở đó, KHÔNG rải vào từng `us-*.md`.

## Inputs

```
/jira status [feature]              # bảng drift, read-only (an toàn nhất, chạy trước)
/jira push [feature]                # đẩy US → Jira issue (L1 + 3-way merge)
/jira pull [feature]                # kéo workflow status Jira → local index
/jira push --dry-run                # ép in payload, KHÔNG gọi API
/jira push --allow-draft            # cho phép đẩy US status draft
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có user story: !`for d in docs/*/userstories/*-story-index.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`
Sync-state tồn tại: !`[ -f .claude/state/atlassian/sync-state.yaml ] && echo yes || echo "no (dry-run)"`
Jira base_url cấu hình: !`grep -A3 'jira:' .claude/state/atlassian/sync-state.yaml 2>/dev/null | grep base_url | grep -q '""' && echo "trống → dry-run" || echo "có"`

## Approach

### Phase A — Resolve + readiness

1. **Resolve feature + mode.** Thiếu US → refuse + route `/userstory` (nhóm B). Không rõ mode → mặc định `status` (an toàn, read-only).
2. **Load sync-state.** Chưa có `.claude/state/atlassian/sync-state.yaml` → khởi tạo skeleton (config rỗng) + báo "chưa cấu hình, sẽ dry-run". Có → đọc `mappings.jira`.
3. **Readiness hard-gate.** Quét status từng US ở `{feature}-story-index.md`: `stale` → refuse story đó + route; `draft` → chặn trừ `--allow-draft`.

### Phase B — Diff 3 chiều (mọi mode)

4. **Với mỗi US:** so `base/{us}.json` (snapshot) · local (us-*.md nội dung + hash) · remote (fetch Jira nếu có kết nối). Phân loại: `NEW` (chưa map) · `UNCHANGED` (hash khớp) · `LOCAL-AHEAD` (local đổi, remote như base) · `CONFLICT` (remote_version tăng) · `REMOTE-AHEAD` (chỉ status đổi).
5. **mode=status** → in bảng drift rồi DỪNG (không ghi gì ra ngoài):
   ```
   US   | Jira key | Local | Remote | Trạng thái sync
   001  | FD-12    | edited| v1     | LOCAL-AHEAD (cần push)
   002  | —        | draft | —      | NEW (chưa đẩy)
   ```

### Phase C — Approval + thực thi (push/pull)

6. **Dựng payload** mỗi US cần đẩy: summary = tiêu đề US, description = User Story + AC (markdown → wiki/ADF, giữ `AC-*`/`FR-*` dạng text), issue-type theo map, labels = feature + priority.
7. **L1 plan preview** (prose BA):
   > Em sẽ đẩy {N} user story của `{feature}` lên Jira (project `{FD}`): {liệt kê US + NEW/update}. {C} story có xung đột (Jira đã đổi) sẽ hỏi riêng. {D} story bỏ qua (không đổi). Kết nối: {thật | dry-run}. Apply?
8. **CONFLICT** → in diff 3-way từng cái, hỏi `giữ local / giữ remote / merge tay`. KHÔNG auto-đè.
9. **Thực thi:**
   - Có kết nối → gọi API (env token). Thành công → ghi `key`/`url`/`last_pushed`/`local_hash`/`remote_version` vào sync-state + cột `jira-key` story-index (L2 diff) + cập nhật `base/{us}.json`.
   - Dry-run → in payload + `⧗ SẼ tạo — chưa gọi API`. KHÔNG điền key giả.
   - **pull** → cập nhật `status_remote` + gợi ý map sang status local (user quyết, KHÔNG tự đổi vòng đời local).
10. **Set env trước ghi** (`CLAUDE_SKILL_NAME=/jira` + author + note vd `pushed 3 US → FD-12..14`). Hook ghi activity.log.

### Phase D — Report

11. **Report phân biệt rõ đã-đẩy-thật vs dry-run:**
    ```
    ✅ Jira sync `{feature}` (push):
       Đã đẩy thật: US-001→FD-12 (v1) · US-003→FD-13 (v1)
       Dry-run (chưa kết nối): US-002 ⧗
       Conflict giữ local: US-004 (Jira v2 → v3)
       Bỏ qua (không đổi): US-005
    → Cấu hình kết nối thật: điền .claude/state/atlassian/sync-state.yaml (config.jira)
    ```

## Gotchas

- **Bịa key `PROJ-123`** — CẤM tuyệt đối. Chưa gọi API thật thì key rỗng + dry-run.
- **Đẩy đè khi Jira đã đổi** — nuốt thay đổi người khác; phải CONFLICT + hỏi.
- **Rải `jira-key` vào từng us-*.md** — sai; nguồn là `{feature}-story-index.md`.
- **Đẩy story stale/draft im lặng** — hard-gate chặn; stale phải chạy lại `/userstory`.
- **Lưu token vào sync-state.yaml** — CẤM; token ở env.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/atlassian-sync.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/kg-usage.md
- @./references/example-jira.md

# Atlassian Sync — rule chung cho `/jira` + `/confluence`

> Rule chung cho MỌI skill đồng bộ artifact BA sang hệ thống ngoài Atlassian (Jira issue, Confluence page). Trả lời: **làm sao đẩy/kéo mà không mất dữ liệu, không bịa key/URL, không ghi đè thay đổi người khác đã sửa trên Jira/Confluence?** `/jira` + `/confluence` MUST reference file này trong Constraints + References.

## 0. Nguyên tắc tối cao

1. **External side-effect = cẩn trọng gấp đôi.** Đẩy 1 story lên Jira / xuất 1 doc lên Confluence là hành động **outward-facing** — người khác thấy ngay, khó rút lại. Luôn qua **L1 approval** trước mỗi lần ghi ra ngoài (`approval-gate.md`). KHÔNG có chế độ "tự đẩy im lặng".
2. **KHÔNG BỊA key/URL.** Chưa có kết nối thật (token/base URL) → **KHÔNG tự chế** `PROJ-123` hay `https://x.atlassian.net/wiki/...`. Chạy **dry-run**: in payload sẽ gửi + đánh dấu `⧗ chưa đẩy (thiếu kết nối)`. Key/URL chỉ được ghi vào sync-state **sau khi** API thật trả về.
3. **Local doc là nguồn thật của NỘI DUNG; Jira/Confluence là bản chiếu.** Trạng thái vòng đời (workflow status) thì Jira/Confluence có thể là nguồn (pull về). Không trộn: nội dung đẩy 1 chiều lên; status kéo 1 chiều về (trừ khi user chốt khác).
4. **Idempotent qua content hash.** Không đổi hash → skip, không tạo version rác trên Confluence / không update thừa Jira.

## 1. Vị trí state (GỘP Jira + Confluence)

```
.claude/state/atlassian/
├── sync-state.yaml          # config + mappings (jira + confluence) + watermark/hash — 1 entry/artifact
├── base/                    # snapshot 3-way (bản gốc lần sync gần nhất) — {artifact-id}.json
└── locks/                   # lock file khi đang sync (tránh 2 tiến trình đẩy cùng lúc)
```

> **Thay hẳn** `docs/_shared/jira-map.md` + `confluence-map.md` cũ (đã bỏ, xem `naming-conventions.md`). 1 file `sync-state.yaml` cho cả Jira + Confluence — dễ đọc drift chéo, 1 chỗ cấu hình.

### sync-state.yaml — cấu trúc

```yaml
version: 1
config:
  jira:
    base_url: ""              # rỗng = chưa cấu hình → dry-run
    project_key: ""           # vd "FD"
    issue_type_map: { story: Story, epic: Epic }
    connection: env           # token đọc từ env (KHÔNG lưu token vào file)
  confluence:
    base_url: ""
    space_key: ""
    parent_page_id: ""
mappings:
  jira:                        # 1 entry / user story
    - artifact: docs/food-delivery/userstories/us-001.md
      key: ""                  # "" = chưa đẩy (dry-run). Chỉ điền khi API thật trả về
      url: ""
      last_pushed: ""          # ISO datetime
      local_hash: ""           # hash nội dung local lần sync gần nhất
      remote_version: ""       # version/updated Jira lần sync gần nhất
      status_local: draft      # status frontmatter local
      status_remote: ""        # workflow status kéo về từ Jira
  confluence:                  # 1 entry / doc xuất bản
    - artifact: docs/food-delivery/srs/food-delivery-spec.md
      page_id: ""
      url: ""
      last_published: ""
      local_hash: ""
      remote_version: ""       # số version Confluence (int) lần publish gần nhất
```

- **KHÔNG lưu token/mật khẩu** trong file (đọc từ env: `JIRA_TOKEN`, `CONFLUENCE_TOKEN`...). File này commit được vào git.
- `key`/`url`/`page_id` rỗng ⇒ **artifact chưa từng đẩy thật** ⇒ luôn dry-run cho tới khi có kết nối.

## 2. Chế độ chạy (mode)

| Mode | Ý nghĩa | Điều kiện |
|---|---|---|
| **push** (jira) / **publish** (confluence) | Đẩy nội dung local ra ngoài | Có kết nối + qua L1 |
| **pull** (jira) | Kéo workflow status từ Jira về cột `status_remote` + gợi ý cập nhật index | Có kết nối |
| **status** | In bảng drift (local vs remote vs base) — read-only, KHÔNG ghi ra ngoài | Luôn được |
| **dry-run** | In payload sẽ gửi, KHÔNG gọi API | Auto khi thiếu kết nối, hoặc user gõ `--dry-run` |

Thiếu `config.*.base_url` → ép **dry-run** + thông báo rõ "chưa cấu hình kết nối {jira|confluence}, đây là bản thử; điền `.claude/state/atlassian/sync-state.yaml` để đẩy thật".

## 3. Hard gate — KHÔNG đẩy khi chưa sẵn sàng

> Đây là **exception hard-gate** của `approval-gate.md` (readiness gate mềm ở nơi khác, nhưng external side-effect thì cứng).

REFUSE push/publish khi:
- Artifact `status: stale` (upstream đã đổi sau khi doc viết) → route chạy lại skill sinh doc trước.
- Artifact `status: draft` **và** user không xác nhận đẩy bản nháp (mặc định chặn; user gõ `--allow-draft` mới cho).
- Có OQ chưa resolve **quan trọng** trong doc (chỉ cảnh báo, không cứng — trừ khi OQ chặn nội dung cốt lõi).
- Đang có lock file trong `locks/` (tiến trình sync khác chưa xong).

## 4. 3-way merge (chống ghi đè)

Mỗi lần push/publish với artifact **đã có mapping key/page_id**:

1. **So 3 bản:** `base` (snapshot lần trước, `base/{id}.json`) · `local` (doc hiện tại) · `remote` (fetch từ Jira/Confluence).
2. **remote_version == base.remote_version** (ngoài không ai sửa) → đẩy local đè an toàn.
3. **remote_version > base** (có người sửa trên Jira/Confluence) → **CONFLICT**: in diff 3-way, hỏi user (`giữ local` / `giữ remote` / `merge tay`). KHÔNG tự đè.
4. Sau khi ghi thành công → cập nhật `base/{id}.json` = bản vừa đẩy + `local_hash` + `remote_version` mới.

## 5. Không fabricate — dry-run trung thực

- Dry-run in đúng payload (Jira: summary/description/issue-type/labels; Confluence: title/space/parent/storage-body) + dòng `⧗ SẼ tạo/cập nhật — chưa gọi API (thiếu kết nối)`.
- KHÔNG in "✅ đã đẩy PROJ-42" khi chưa gọi API thật. Report phân biệt rõ **đã đẩy thật** (có key/url) vs **mới dry-run**.
- Ảnh/attachment chưa upload được → ghi placeholder + note, KHÔNG bịa link CDN.

## 6. Markdown → định dạng đích

- **Jira description:** markdown → Atlassian wiki markup / ADF (tùy API). Giữ ID (`FR-*`, `AC-*`) dạng text, không mất.
- **Confluence body:** markdown → storage format (XHTML) hoặc ADF. Bảng/heading/code giữ nguyên cấu trúc. Wikilink `[[docs/...]]` → link tương đối hoặc text (không để lộ cú pháp Obsidian trên Confluence).
- Convert lỗi 1 phần → giữ phần chạy được + note phần thiếu, KHÔNG bỏ im lặng.

## 7. Activity log

Set env trước mỗi lần ghi ra ngoài (hook `auto-changelog.sh` ghi `docs/_shared/activity.log`):
```
{date} | /jira | @author | docs/{feature}/userstories/us-001.md | pushed → FD-12 (v1)
{date} | /confluence | @author | docs/{feature}/srs/{feature}-spec.md | published → page 88410 (v3)
{date} | /jira | @author | (dry-run) us-002.md | ⧗ chưa đẩy — thiếu kết nối
```

## Anti-patterns

- ❌ Bịa key `PROJ-123` / URL Confluence khi chưa gọi API thật.
- ❌ Đẩy đè khi `remote_version` đã tăng (nuốt thay đổi người khác) — phải CONFLICT.
- ❌ Lưu token vào `sync-state.yaml`.
- ❌ Push story `status: stale`/`draft` không hỏi.
- ❌ Tạo version Confluence mới khi hash không đổi (rác lịch sử).
- ❌ Report "đã đồng bộ" mà không phân biệt đã-đẩy-thật vs dry-run.

## Tóm tắt 1 dòng

> **1 `sync-state.yaml` (Jira+Confluence) · L1 trước mỗi lần đẩy · hard-gate stale/draft · 3-way merge chống đè · thiếu kết nối → dry-run trung thực, KHÔNG bịa key/URL.**

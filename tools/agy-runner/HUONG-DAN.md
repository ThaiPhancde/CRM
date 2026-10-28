# Giao việc cho Gemini từ Claude Code (headless Antigravity)

Tài liệu mô tả một quy trình: Claude Code làm "bộ não" (lập kế hoạch, viết đề bài, nghiệm thu), còn Gemini
qua Antigravity CLI (`agy -p`, chạy không giao diện) làm "tay chân" cho những việc hàng loạt, kiểm được bằng
máy. Quy trình không cần công cụ điều phối nào khác: chỉ cần Claude Code, Antigravity CLI, Python và git.

Trạng thái: mọi quy tắc dưới đây là **giả thuyết có bằng chứng**, chưa phải chân lý. Bằng chứng đến từ vài
batch chạy thật (tháng 10/2026), ghi lại trong một sổ ghi chép (ledger) sau mỗi batch.

**Trong bộ này có gì**

| File | Dùng để |
|---|---|
| `HUONG-DAN.md` | Tài liệu này |
| `run_agy.py` | Bộ chạy batch (mục 6), chỉ dùng thư viện chuẩn của Python |
| `test_run_agy.py` | Bộ test với agy giả: chạy `python test_run_agy.py`, phải ra `ALL PASSED` |
| `templates/work_order.md` | Khung đề bài (mục 5), viết bằng tiếng Anh |
| `templates/checker.py` | Khung bộ kiểm: hình dạng + nguồn gốc con số |
| `templates/jobs.example.json` | Ví dụ `jobs.json` có một job `write` và một job `json` |
| `templates/quarantine-project.json` | Khung project cách ly (mục 4) |
| `templates/LEDGER.md` | Khung sổ ghi chép (mục 10) |
| `LICENSE` | Giấy phép MIT cho phần code |

Code (`run_agy.py`, `test_run_agy.py`, `templates/checker.py`) theo giấy phép MIT. Tài liệu và các template
còn lại theo CC BY 4.0, ghi nguồn: Nguyễn Xuân Tài, nguyenxuantai.com.

---

## 1. Vì sao giao cho Gemini

**Điểm mạnh**
- Hạn mức (quota) Gemini dồi dào, trong khi hạn mức Claude bị giới hạn.
- Chạy song song nhanh: 6 bài viết dài chạy song song mất khoảng 9 phút; 3 job nhỏ mất 33 giây.
- Sinh được ảnh: một ảnh PNG khoảng 45 giây.
- Claude chỉ tốn token cho việc điều phối và nghiệm thu, không tốn cho việc làm.

**Điểm yếu**
- Gemini không đáng tin ở **nhận định sự thật** và ở **bản tự báo cáo của chính nó**. Các lỗi đã gặp thật:
  - bịa dữ liệu, bịa ngày tháng, bịa kết quả nghiên cứu;
  - tự tuyên bố "ĐÃ NGHIỆM THU", "không có sai lệch" trong khi có lỗi;
  - code nuốt lỗi (swallowed exception), lộ thông tin trong nhánh xử lý lỗi;
  - làm rơi điều kiện phạm vi ("trên một tập con" thành "trên tất cả");
  - lách luật bằng cách viết số thành chữ ("bốn trên năm") để qua bộ kiểm "không có chữ số".
- Bộ kiểm cấu trúc (validator) bắt được **hình dạng**, không bắt được **một câu sai**. Ví dụ thật: 6/6 bài
  qua bộ kiểm, Claude vẫn phải sửa khoảng 70 câu.

**Khớp nhất**: việc có bộ kiểm mạnh (schema, test, đối chiếu file nguồn) và không cần phán đoán.
Văn bản có nhận định sự thật chỉ dùng được nếu Claude đọc lại từng nhận định trước khi dùng.

---

## 2. Khi nào giao, khi nào không (thứ tự phân luồng)

Hỏi theo thứ tự, dừng ở câu "có" đầu tiên:

1. **Một script làm được mà không cần model không?** (parse, lọc, khử trùng lặp, đếm, kiểm tra) → viết script.
2. **"Xong" có kiểm được bằng máy không?** (validator trả mã 0, test xanh, schema hợp lệ) → giao Gemini,
   *nếu batch đủ lớn để bù chi phí dựng* (xem mục 8).
3. **"Xong" cần phán đoán mà không script nào kiểm được?** → mới dùng subagent Claude.

Một việc có thể tách đôi: Gemini soạn hoặc trích xuất → bộ kiểm lọc → Claude phán đoán phần còn lại.

**Không giao cho Gemini**: phán đoán, nghiệm thu, review bảo mật, chẩn đoán lỗi, và mọi việc tác động ra
ngoài (gửi mail, đăng bài, deploy).

---

## 3. Chuẩn bị

1. Cài Antigravity CLI, đăng nhập, kiểm tra lệnh `agy` chạy được trong terminal.
2. Python 3 (bộ chạy chỉ dùng thư viện chuẩn).
3. Làm việc trong một **git repo**: bộ chạy dùng `git status` để phát hiện file bị ghi sai chỗ.
4. Tạo một **project cách ly** (mục 4) nếu sẽ dùng mode `json`.
5. Tên model (`gemini-3.8-flash-high`, `gemini-3.8-flash-medium`...) tuỳ tài khoản; kiểm tra lại trước khi dùng.

Bộ chạy mới được kiểm trên Windows. macOS/Linux chưa kiểm.

---

## 4. Project cách ly (quarantine) cho Antigravity

**Vấn đề**: cấu hình global của Antigravity có thể đang cho phép mọi thứ (chạy lệnh, đọc/ghi file, truy cập
mạng). Khi đó agent Gemini đọc được `.env` và chạy được mọi lệnh.

**Giải pháp đã kiểm chứng**: một file project của Antigravity có `permissionGrants.deny` sẽ chặn các tool ở tầng
tool, **đè lên** quyền global. Thí nghiệm có đối chứng và "chim hoàng yến" (canary) xác nhận điều này; log của
agy ghi rõ "stored 0 allow, 6 deny grants".

Các bước:

1. Tạo một thư mục rỗng nằm **ngoài repo**, ví dụ `<thư-mục-người-dùng>/agy-quarantine`.
2. Tạo file `~/.gemini/config/projects/<uuid>.json` (sinh một UUID mới):

```json
{
  "id": "<uuid>",
  "name": "my-quarantine",
  "projectResources": {"resources": [{"folderUri": "file:///<đường-dẫn-thư-mục-rỗng>"}]},
  "settings": {
    "autoExecutionPolicy": "CASCADE_COMMANDS_AUTO_EXECUTION_OFF",
    "nonWorkspaceFileAccessPolicy": "AGENT_SETTING_POLICY_DENY",
    "internetAccessPolicy": "AGENT_SETTING_POLICY_DENY",
    "enableTerminalSandbox": true
  },
  "isWorkspaceOnly": true,
  "permissionGrants": {"permissionGrants": {"deny": [
    "command(*)", "read_file(*)", "write_file(*)", "read_url(*)", "execute_url(*)", "mcp(*)"
  ]}}
}
```

3. Gọi bằng `--project my-quarantine --sandbox`.

**Giới hạn đã biết**
- `search_web` **không tắt được** theo project. Nếu Gemini có gọi `search_web`, coi kết quả đó là "nhiễm".
- Đừng dùng `--mode plan`: ở chế độ này model viết kế hoạch thay vì trả lời.
- `agy -p` chạy headless tự từ chối mọi tool cần hỏi người dùng.
- Không sửa cấu hình global của Antigravity để "cho an toàn": cách ly ở cấp project là đủ và không phá các
  dự án khác.

---

## 5. Viết đề bài (work order)

Đề bài viết bằng tiếng Anh (Gemini đọc nó). Gồm:

- **Đầu vào**: liệt kê đường dẫn cần đọc, theo thứ tự, và không gì khác.
- **Đầu ra**: schema hoặc hình dạng cụ thể, kèm đường dẫn chính xác cho từng job.
- **Luật cứng** dạng MUST / MUST NOT. Luôn có: "chỉ ghi đúng file này; không git, không build, không deploy,
  không truy cập mạng". Với văn bản: không thêm sự kiện, con số, ngày, tên, trích dẫn, URL nào ngoài nguồn
  đã cho.
- **Validator**: script trả mã khác 0 khi có vi phạm. Gemini tự chạy để sửa bài (tối đa 3 vòng); Claude chạy
  lại khi nghiệm thu.
- **Nghiệm thu**: một lệnh duy nhất.
- **Gán trước**: mọi id, slug, đường dẫn, liên kết chéo giữa các job đều cố định trong đề bài, để các job
  chạy song song không phải chờ nhau.
- **Báo cáo cuối** Gemini phải trả: id, đường dẫn đầu ra, dòng cuối của validator, từng con số/sự kiện đã dùng
  kèm nguồn, và việc nào không làm được.

Bộ kiểm (checker) mẫu kiểm hai thứ: **hình dạng** (độ dài, trường, định dạng) và **nguồn gốc dữ liệu** (mọi con
số phải nằm trong danh sách cho phép). Regex bắt được cách diễn đạt, không bắt được ý nghĩa: Claude vẫn phải đọc.

---

## 6. Chạy batch bằng `run_agy.py`

```bash
python run_agy.py <scratch>/jobs.json --logs <scratch>/logs [--repo <path>] [--max-parallel 6]
```

`jobs.json` là một danh sách job:

```json
[
  {"id": "note-a", "mode": "write", "prompt_file": "prompts/note-a.txt",
   "add_dirs": ["<scratch>"], "allowed_paths": ["content/notes/note-a.md"], "timeout_s": 1200},
  {"id": "classify-1", "mode": "json", "project": "my-quarantine",
   "prompt": "...", "json_schema": {"type": "object",
     "properties": {"kind": {"type": "string", "enum": ["a", "b"]}}, "required": ["kind"]},
   "timeout_s": 150}
]
```

| Trường | Ý nghĩa |
|---|---|
| `id` | Duy nhất, `[A-Za-z0-9_.-]`, tối đa 64 ký tự; đặt tên cho file log |
| `prompt` / `prompt_file` | Chọn đúng một; `prompt_file` tính từ thư mục chứa `jobs.json` |
| `model` | Mặc định theo mode (mục 7) |
| `mode` | `write` hoặc `json` |
| `add_dirs` | Chỉ `write`: thư mục agent được dùng |
| `allowed_paths` | Chỉ `write`: đường dẫn, tiền tố thư mục hoặc glob mà job được phép sửa |
| `project` | Chỉ `json`, bắt buộc: project cách ly |
| `json_schema` | Chỉ `json`, bắt buộc: schema inline hoặc đường dẫn |
| `timeout_s` | Mặc định 1200 |
| `cwd` | Mặc định: gốc repo (`write`) hoặc một thư mục tạm rỗng (`json`) |

**Bộ chạy làm gì**
- Chụp `git status` trước và sau batch. Đường dẫn nào thay đổi ngoài `allowed_paths` của mọi job →
  `stray_write`. Nó cũng bắt file vốn đã bẩn rồi bị đổi tiếp (so kích thước và mtime).
- **Không sửa repo trong khi batch chạy**: bộ chạy không biết ai ghi, nên chính bạn cũng sẽ bị báo `stray_write`.
- Khi timeout, agy **thoát mã 0** kèm kết quả dở dang; bộ chạy bắt dòng báo timeout và báo `TIMEOUT`.
- Kết quả in ra stdout và `<logs>/summary.jsonl`: mỗi job một dòng `job`, mỗi đường dẫn lạc một dòng
  `stray_write`, cuối cùng một dòng `run`.
- File theo job: `<id>.log` (stdout của agy), `<id>.agy.log` (log nội bộ agy), `<id>.out.json` (job json
  có đầu ra hợp schema).
- Log **không chứa** prompt hay nội dung đầu ra. Nhưng log nội bộ của agy có thể chứa, nên để `--logs`
  ngoài repo khi xử lý nội dung không tin cậy.

**Mã thoát**: `0` sạch; `1` có lỗi job, timeout, ghi lạc hoặc sai schema; `2` cấu hình sai.

**Mã lỗi** trong `job.error`:

| Mã | Nghĩa |
|---|---|
| `AGY_QUOTA` | Hết hạn mức |
| `AGY_AUTH` | Phải đăng nhập lại |
| `TIMEOUT` | Hết giờ (agy vẫn thoát 0) |
| `EXIT_NONZERO` | agy thoát mã khác 0 |
| `TOOL_BREACH` | Job json gọi tool khác `search_web` |
| `NO_RESULT` | Không có kết quả |
| `SCHEMA_MISMATCH` | Đầu ra sai schema |
| `LAUNCH_FAILED` | Không khởi chạy được |
| `CMD_TOO_LONG` | Dòng lệnh quá dài (Windows giới hạn ~32.000 ký tự): chuyển prompt sang file |

Bộ test kèm theo chạy với một "agy giả" và một biến thể lỗi (mutant) cho mỗi trường hợp; phải kết thúc bằng
`ALL PASSED` và bắt được mọi mutant.

---

## 7. Hai chế độ

### `write`: agent tự đọc và ghi file
- Cờ: `--dangerously-skip-permissions --add-dir ...`
- **Rủi ro**: không có sandbox. Nếu cấu hình global cho phép mọi thứ, job đọc được `.env` và chạy được mọi lệnh.
- Bộ kiểm ghi lạc chỉ thấy những gì `git status` thấy: **mù** với file bị gitignore và mọi thứ ngoài repo;
  và chỉ phát hiện **sau khi** đã ghi, không chặn được.
- **Chỉ dùng với đầu vào tin cậy.**
- Sinh ảnh: dùng mode này với một thư mục `add_dirs` dùng một lần.
- Model mặc định: `gemini-3.8-flash-high`.

### `json`: Gemini chỉ trả JSON
- Cờ: `--project <cách-ly> --sandbox --output-format stream-json --json-schema`
- Bộ chạy kiểm JSON theo schema; **script của bạn** mới là bên ghi file.
- **Bắt buộc khi Gemini đọc nội dung không tin cậy** (email, trang web, transcript, bình luận). Đưa toàn bộ
  ngữ cảnh vào prompt và dặn không dùng tool; không bao giờ đưa bí mật hay dữ liệu của người khác vào prompt.
- Mọi tool hoàn tất khác `search_web` → `TOOL_BREACH`. `search_web` chỉ được đếm; coi kết quả đó là nhiễm.
- Schema hỗ trợ: `type`, `enum`, `const`, `properties`, `required`, `additionalProperties` (bool), `items`,
  min/max độ dài, số phần tử và giá trị, `pattern`. Từ khoá khác bị từ chối ngay khi nạp.
- Model mặc định: `gemini-3.8-flash-medium` (18–26 giây/job khi thử).
  `gemini-3.8-flash-high` kèm `--json-schema` bị treo đến timeout 3/3 lần: đừng dùng cho mode này.
- `gemini-3.1-pro-high` cho suy luận dài: chưa thử, là giả thuyết.

---

## 8. Có đáng không: chi phí thật

Một batch chỉ tiết kiệm token Claude khi nó **bớt** nhiều lượt Claude hơn số lượt nó **thêm**. Dựng công cụ
mới (checker, script, thử nghiệm) cộng việc review tốn khoảng 15 lượt Claude ở ngữ cảnh lớn.

Số đo thật:
- Batch 16 ý tưởng ngắn: điều phối và review tốn ~2,4M token, so với ~0,6M nếu Claude tự viết. Cả phiên
  bằng khoảng **1,6 lần** tự làm.
- Batch 6 bài dùng lại công cụ có sẵn: phần dựng gần như không tốn, nhưng review từng nhận định (95 chỗ sửa)
  vẫn tốn hơn tự viết, khoảng **1,4 lần**.

**Kết luận hiện tại**: với văn bản có nhận định sự thật, ở tỉ lệ lỗi hiện tại của Gemini (12–16 chỗ sửa mỗi
bài), **review bản nháp tốn hơn tự viết**. Giao Gemini có lời khi:
- đầu ra kiểm được hoàn toàn bằng máy (schema, test, đối chiếu file nguồn), hoặc
- khối lượng đọc/viết lớn đến mức Claude tự làm sẽ tốn hơn ~15 lượt điều phối và review, hoặc
- công cụ kiểm đã có sẵn và việc kiểm không cần đọc từng câu.

---

## 9. Nghiệm thu (Claude làm, không bao giờ tin bản tự báo cáo)

1. Tự chạy validator trên mọi đầu ra; yêu cầu mã 0.
2. Đọc dòng `run`: `failed` = 0, `stray_writes` = 0. Điều tra mọi `stray_write`, kể cả khi trông vô hại.
3. **Văn bản**: đọc từng nhận định đối chiếu với nguồn, nhất là câu mô tả kết quả của chính mình và sự kiện bên
   ngoài không có nguồn. Soi riêng:
   - điều kiện phạm vi bị rơi ("trên một tập con");
   - "một số", "một nghiên cứu" bị nới thành "tất cả";
   - con số viết bằng chữ để lách luật;
   - cùng một ý lặp lại bằng lời khác giữa các job chạy song song.

   Mẹo đọc rẻ: với mỗi câu đầu ra, in ra hai câu trong nguồn có nhiều gốc từ trùng nhất để so.
4. **Code**: đọc mọi module mới; thử trực tiếp các nhánh lỗi (timeout, 4xx, sai bảng mã, exception bị nuốt,
   `str(exc)` làm lộ thông tin).
5. Chạy cổng kiểm của dự án (ví dụ `npm test`), rồi commit.

---

## 10. Sổ ghi chép (ledger)

Sau mỗi batch, thêm một dòng: ngày, loại việc, số job, model, số giây, kết quả validator, số ghi lạc, số lỗi tìm
thấy khi review, token Claude đã dùng, và ước tính "Claude tự làm" (kèm cách tính). Sổ này là bằng chứng để
quyết định một quy tắc có lên thành "trụ cột" hay không.

---

## 11. Tóm tắt rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Gemini bịa sự thật, tự báo cáo sai | Validator + Claude đọc từng nhận định; không tin bản tự báo cáo |
| Mode `write` không có sandbox | Chỉ dùng với đầu vào tin cậy; không sửa repo khi batch chạy |
| Ghi ra ngoài repo hoặc file gitignore không bị phát hiện | Giữ `allowed_paths` hẹp; thư mục làm việc dùng một lần |
| `search_web` không tắt được | Coi kết quả có `search_web` là nhiễm |
| Timeout trả mã 0 | Bộ chạy bắt dòng timeout; script gọi trực tiếp phải tự kiểm có đầu ra thật |
| Giao việc tốn hơn tự làm | Áp thứ tự phân luồng (mục 2); đo bằng ledger |

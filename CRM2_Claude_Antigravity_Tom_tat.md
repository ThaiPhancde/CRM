# CRM2 — Kết hợp Claude Code và Antigravity CLI

Ngày tổng hợp: 28/10/2026. Tài liệu ghi lại nội dung chính và trạng thái đã xác nhận trong cuộc chat; không khẳng định đã triển khai các bước còn lại.

## 1. Mục tiêu và cách hoạt động

Dùng hai agent để phát triển code CRM:

1. Claude Code extension trong VS Code nhận yêu cầu, đọc dự án, chốt phạm vi và chia việc.
2. Claude gọi Python runner `run_agy.py` qua terminal.
3. Runner gọi Gemini qua Antigravity CLI (`agy`) để thực hiện nhiệm vụ độc lập.
4. Claude kiểm tra diff, chạy test, sửa và tích hợp kết quả.

Đây là phối hợp thông qua CLI, không phải điều khiển agent trong cửa sổ IDE Antigravity. Không cần tự sao chép prompt giữa hai ứng dụng hoặc giữ phiên chat `agy` mở để runner hoạt động. Claude vẫn cần được hướng dẫn sử dụng runner; việc cài CLI không tự tạo cơ chế điều phối.

## 2. Bộ công cụ đã xem xét

File gốc: `Giao-Viec-Cho-Gemini-Tu-Claude-Code.zip`.

Các thành phần chính:

- `HUONG-DAN.md`: hướng dẫn phân việc và nghiệm thu.
- `run_agy.py`: chạy batch job qua `agy`.
- `test_run_agy.py`: kiểm thử bằng CLI giả và mutation test.
- `templates/work_order.md`: mẫu giao việc.
- `templates/jobs.example.json`: mẫu cấu hình batch.
- `templates/checker.py`: bộ kiểm mẫu, cần chỉnh theo nhiệm vụ.
- `templates/quarantine-project.json`: mẫu project giới hạn quyền.
- `templates/LEDGER.md`: ghi nhận thời gian, lỗi, token và hiệu quả.

Hai chế độ:

| Chế độ | Cách thực hiện | Giới hạn chính |
| --- | --- | --- |
| `write` | Agent tự đọc, ghi file; runner dùng `--dangerously-skip-permissions` | Không được coi là sandbox; kiểm tra đường dẫn chỉ diễn ra sau khi chạy |
| `json` | Agent trả structured JSON, runner kiểm schema rồi lưu | Cần project giới hạn quyền được kiểm chứng; schema không bảo đảm dữ liệu đúng về ý nghĩa |

## 3. Kết quả review và test trong chat

| Hạng mục | Kết quả |
| --- | --- |
| Test chức năng với `agy` giả | Tất cả qua |
| Mutation test | Bắt được 9/10 mutant |
| Mutant lọt | Chỉ diệt tiến trình cha thay vì cả cây tiến trình |
| Exit code của lệnh test đầy đủ | `1`, do có mutant sống sót |
| Chạy Gemini thật ở môi trường review | Chưa thực hiện vì môi trường đó không có `agy` |

Mutant lọt cho thấy bài test diệt tiến trình con chưa đủ mạnh trên Linux đã thử; chưa chứng minh cơ chế diệt cây tiến trình của code gốc sai.

### Các vấn đề cần xử lý trước khi dùng thường xuyên

1. **`allowed_paths` không chặn ghi:** runner chỉ đối chiếu Git trước/sau. File bị gitignore và file ngoài repo có thể không được phát hiện.
2. **Quyền đường dẫn bị gộp giữa các job:** job A sửa file được phép của job B có thể vẫn qua. Nên tách worktree và giới hạn phạm vi từng job.
3. **`search_web` vẫn được tính thành công:** tài liệu coi kết quả là nhiễm, code chỉ đếm rồi có thể lưu output. Cần trả lỗi hoặc có bước duyệt riêng.
4. **`prompt_file` vẫn thành đối số `-p`:** không khắc phục giới hạn độ dài dòng lệnh Windows. Nên chuyển sang stdin phù hợp với CLI.
5. **Validator JSON tự viết có lỗi:** đã tái hiện `true` qua `enum: [1]`, `false` qua `const: 0`, và schema sai kiểu `required` vẫn được nạp. Nên dùng validator chuẩn, kiểm cả schema.
6. **Log có thể chứa nội dung:** summary chỉ có metadata, nhưng log stdout/stderr và log nội bộ có thể chứa câu trả lời hoặc dữ liệu nhạy cảm.
7. **Mode `write` chưa bắt buộc có sản phẩm:** exit 0 không bảo đảm file yêu cầu được tạo hay validator đã qua.
8. **Quarantine chưa được runner xác minh:** có tên project không đồng nghĩa deny rules đã đúng. Worktree chỉ tách thay đổi, không phải sandbox bảo mật.

Chưa sửa hoặc cài runner lên máy người dùng trong cuộc chat này.

## 4. Trạng thái cài đặt trên máy Windows

### Đã xác nhận

- Tài khoản Windows: `ADMIN`.
- Thư mục dự án người dùng đang mở: `D:\CRM2`.
- Installer báo cài thành công tại:

```text
C:\Users\ADMIN\AppData\Local\agy\bin\agy.exe
```

- Installer đã thêm `%LOCALAPPDATA%\agy\bin` vào User PATH.
- Ban đầu terminal chưa nhận PATH mới nên báo `agy` không được nhận diện.
- Sau đó người dùng đã chạy được `agy` ở `PS D:\CRM2>` và thấy màn hình chat với dấu `>`.

### Chưa xác nhận

- Phiên bản `agy` cụ thể và danh sách model thực tế.
- Kết quả gọi headless `agy -p`.
- Claude Code extension đã nhận PATH mới hay chưa.
- Runner đã được giải nén vào đường dẫn nào trên máy.
- Stack, Git branch và trạng thái code thực tế bên trong `D:\CRM2`.
- Hai agent đã chạy một nhiệm vụ code hoàn chỉnh hay chưa.

## 5. Phân biệt nơi cài, workspace và PATH

| Khái niệm | Ý nghĩa trong trường hợp này |
| --- | --- |
| Nơi cài CLI | `C:\Users\ADMIN\AppData\Local\agy\bin`, dùng chung cho các dự án |
| Workspace | Thư mục code agent được giao làm việc, hiện là `D:\CRM2` |
| PATH | Cho phép terminal tìm thấy `agy.exe` dù đang ở ổ C hay D |

Không cần cài thêm CLI vào ổ D hoặc vào từng project. Chạy installer từ `C:\Users\ADMIN` không khiến CLI chỉ dùng được ở thư mục đó.

Nếu màn hình trust hiển thị `C:\Users\ADMIN`, chọn **No, exit**, rồi mở lại từ `D:\CRM2`. Chỉ xác nhận trust khi đường dẫn hiển thị đúng dự án.

### Khắc phục PATH trong phiên PowerShell hiện tại

```powershell
$env:Path = "$env:LOCALAPPDATA\agy\bin;$env:Path"
Set-Location D:\CRM2
agy --version
agy
```

Hoặc gọi trực tiếp:

```powershell
Set-Location D:\CRM2
& "C:\Users\ADMIN\AppData\Local\agy\bin\agy.exe"
```

Thoát hoàn toàn các cửa sổ VS Code rồi mở lại để extension và terminal mới nhận PATH. Các dòng `logging before google.Init` xuất hiện trong log installer không phủ nhận thông báo cài thành công ở cuối.

## 6. Bước tiếp theo ngay tại trạng thái hiện tại

Người dùng đang ở màn hình chat `agy` tại `D:\CRM2`.

1. Bấm Esc để đóng thông báo Verbosity nếu cần.
2. Thử yêu cầu chỉ đọc:

```text
Chỉ đọc cấu trúc workspace hiện tại và tóm tắt dự án. Không sửa file, không cài dependency, không chạy migration.
```

3. Thoát về PowerShell bằng Ctrl+C; nếu chưa thoát thì làm theo giao diện CLI.
4. Kiểm tra headless:

```powershell
agy models
agy -p "Reply with exactly READY. Do not use tools."
```

5. Nếu nhận `READY`, mở Claude Code extension trong `D:\CRM2` để thiết lập và thử runner.

Lưu ý: thấy giao diện chat khởi động chưa đủ xác nhận một yêu cầu model thực tế hoặc headless đã thành công.

## 7. Áp dụng cho CRM mới

Trong phần hướng dẫn trước, phương án mới được tham chiếu là `ai-operations-hub`; đường dẫn người dùng thực tế cung cấp sau đó là `D:\CRM2`. Không mặc định tên thư mục này chứng minh tên repo hoặc stack. Claude cần audit repo đang mở trước khi viết code.

Các ràng buộc đã mang vào hướng dẫn CRM mới:

- Modular monolith, database riêng; không tự dùng chung DB với ToolSpy/Pancake CRM.
- Nếu repo chưa có stack, định hướng đã nhắc là Next.js + FastAPI + PostgreSQL + worker; nếu đã có stack thì audit và giữ phù hợp.
- Chỉ triển khai phase được giao.
- `DEMO_MODE=replay` và `EXTERNAL_WRITES_ENABLED=false`.
- Không tự ghi ngược Pancake POS, push hoặc deploy.
- Workspace permissions, approval, audit, idempotency và policy được kiểm ở server.

### Chia việc đề xuất

| Claude Code | Gemini qua Antigravity |
| --- | --- |
| Kiến trúc, contract, schema/database, phân quyền | Component UI, bảng, form, bộ lọc theo contract |
| Approval, audit, idempotency, policy | Mapper, fixture, adapter dùng dữ liệu mẫu |
| Tích hợp, review và nghiệm thu | Nhiệm vụ độc lập, phạm vi file rõ, có kiểm tra |

Ví dụ module mua hàng: Claude chốt API và backend; Gemini làm bảng yêu cầu mua hàng, bộ lọc và form dựa trên contract và replay data; Claude kiểm tra rồi nối API.

Không để hai agent sửa cùng một file đồng thời. Bắt đầu một job Gemini với `--max-parallel 1`; sau khi xác nhận ổn mới tăng mức song song.

## 8. Yêu cầu khởi tạo để đưa cho Claude Code

Đường dẫn `D:\AI-Tools\Giao-Viec-Cho-Gemini` dưới đây là gợi ý, chưa được xác nhận đã tồn tại. Thay bằng vị trí giải nén thật.

```text
Thiết lập phối hợp Claude Code và Gemini qua Antigravity CLI cho repo đang mở tại D:\CRM2.

Bộ công cụ dự kiến tại D:\AI-Tools\Giao-Viec-Cho-Gemini. Kiểm tra đường dẫn thực tế trước khi dùng.

Bạn là agent chính: audit repo, chốt phạm vi phase, chia việc, tích hợp và nghiệm thu. Gemini thực hiện nhiệm vụ độc lập thông qua run_agy.py.

1. Đọc hướng dẫn repo, kiểm tra stack, trạng thái Git và phase hiện tại. Không tự khởi tạo lại dự án hoặc sửa ToolSpy/pancake-crm.
2. Kiểm tra Python, Git, agy và model thực tế. Chạy một prompt nhỏ để xác nhận headless hoạt động.
3. Review và sửa runner trước khi dùng: prompt dài qua argv; search_web vẫn được coi thành công; validator JSON; thiếu output/validator bắt buộc; test diệt cây tiến trình; kiểm quyền đường dẫn từng job.
4. Thêm quy ước giao việc vào CLAUDE.md, giữ nguyên các hướng dẫn đã có. Mỗi job có file được sửa, đầu ra, tiêu chí nghiệm thu và lệnh kiểm tra.
5. Tạo Git worktree riêng cho Gemini; chỉ đưa dữ liệu mẫu cần thiết, không sao chép secret. Worktree không phải sandbox bảo mật.
6. Chọn một nhiệm vụ nhỏ trong phase hiện tại, tạo prompt và jobs.json, chạy --max-parallel 1, đọc diff, chạy kiểm tra phù hợp rồi tích hợp khi đạt.
7. Báo phần Claude làm, phần Gemini làm, kết quả kiểm tra và việc còn thiếu. Nếu bị chặn bởi đăng nhập hoặc thiếu CLI, báo đúng bước người dùng phải làm.

Giữ DEMO_MODE=replay, EXTERNAL_WRITES_ENABLED=false. Không ghi API thật, không ghi ngược POS, không tự triển khai các phase khác, không push/deploy.
```

## 9. Giao việc sau khi thiết lập xong

Ví dụ yêu cầu:

```text
Làm màn hình yêu cầu mua hàng trong phase hiện tại. Bạn chốt contract và backend; giao Gemini làm bảng danh sách, bộ lọc và form theo contract. Dùng dữ liệu replay, kiểm tra rồi tích hợp kết quả.
```

Runner được gọi theo dạng sau; các đường dẫn là ví dụ, phải thay theo vị trí thật:

```powershell
python D:\AI-Tools\Giao-Viec-Cho-Gemini\run_agy.py `
  D:\AI-Jobs\purchase-list\jobs.json `
  --repo D:\CRM2-gemini `
  --logs D:\AI-Jobs\purchase-list\logs `
  --max-parallel 1
```

## 10. Token và hiệu quả

- Gemini dùng hạn mức/token của Gemini; Claude vẫn tốn token để chia việc, đọc báo cáo và review.
- Không phải cứ dùng hai agent là tiết kiệm hơn.
- Tài liệu ZIP ghi một số batch văn bản tốn hơn Claude tự làm khoảng 1,4–1,6 lần; đây là số liệu của tác giả, không phải phép đo trên CRM2.
- Phù hợp nhất với nhiệm vụ độc lập, có contract và test rõ; cần ghi ledger để đo hiệu quả thật.

## 11. Tài liệu chính thức đã đối chiếu trong chat

- Headless: https://antigravity.google/docs/cli/headless/
- CLI reference: https://antigravity.google/docs/cli/reference/
- Installer Windows người dùng đã chạy: https://antigravity.google/cli/install.ps1

Các cờ, model và chính sách có thể thay đổi theo phiên bản. Kiểm tra CLI đang cài trước khi áp dụng. Không coi model mặc định ghi trong ZIP là chắc chắn có trên tài khoản.

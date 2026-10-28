# Phối hợp Claude Code + Gemini (Antigravity CLI)

Cập nhật: 28/10/2026 (Phase 0). Nguồn: `CRM2_Claude_Antigravity_Tom_tat.md`, `tools/agy-runner/HUONG-DAN.md`. Người dùng yêu cầu (28/10): kết hợp Antigravity, rồi chỉnh lại: **Claude vẫn là người chỉ đạo, Gemini chỉ phụ trợ — khoảng 80/20** (D-27).

## 1. Vai trò và tỷ lệ

| | Claude Code — chỉ đạo, ~80% | Gemini qua `agy -p` — phụ trợ, ~20% |
|---|---|---|
| Quyết định | Mọi quyết định: phạm vi, thiết kế, contract, chấp nhận hay bỏ output | Không quyết định gì |
| Code lõi | Kiến trúc, Prisma schema, migration, `bindTenant`, `requirePerm`, approval, audit, idempotency, adapter, logic tiền, chống trùng, liên kết đơn, gộp khách, chấm điểm, journey, tool AI, prompt | Không chạm |
| UI | Phần lớn: AppShell, trang, form, bảng, luồng, drawer/modal, dashboard, báo cáo | Component đơn giản, lặp lại (badge, skeleton, empty/error state) khi đã có token |
| Dữ liệu | Zod schema của fixture, seed | Sinh fixture khối lượng lớn theo schema (đơn 12 tháng, khách, hội thoại, LLM replay) |
| Test | Test nghiệp vụ, tích hợp, quyền, E2E | Test bảng cho hàm thuần đã có chữ ký; bảng ánh xạ trạng thái |
| Rà soát | Review mọi diff, chạy test, sửa, nghiệm thu, cập nhật docs | Ảnh chụp 4 trạng thái theo danh sách trang |

**Cách giữ tỷ lệ:** mặc định Claude tự làm. Chỉ giao Gemini khi việc vừa lặp lại/khối lượng lớn, vừa có checker máy, và phần Claude phải review nhỏ hơn phần tự làm. Gemini không sẵn sàng hoặc batch thất bại thì Claude tự làm, không chờ. Cuối mỗi phase ghi tỷ lệ ước tính vào `implementation-status.md`; vượt quá ~25% là dấu hiệu giao quá nhiều.

Luật phân luồng (HUONG-DAN §2): script làm được → viết script; "xong" kiểm được bằng máy → giao Gemini; cần phán đoán → Claude.

## 2. Thiết lập (lát 1.0 của Phase 1)

1. Kiểm `agy --version`, `agy models`, `agy -p "Reply with exactly READY. Do not use tools."` từ `D:\CRM2`. Ghi phiên bản và model thật vào mục 7 file này. Không coi model trong ZIP là chắc có.
2. Repo phải là git repo (`git init` nếu chưa) — runner dùng `git status` để phát hiện ghi sai chỗ.
3. Chạy `python -I tools/agy-runner/test_run_agy.py` → phải `ALL PASSED`.
4. **Sửa runner trước khi dùng thường xuyên** (8 vấn đề trong `CRM2_Claude_Antigravity_Tom_tat.md` §3), tối thiểu 4 mục chặn:
   - `prompt_file` đọc rồi đưa qua stdin, không ghép vào `-p` (giới hạn dòng lệnh Windows).
   - Job dùng `search_web` → tính **thất bại**, không lưu output.
   - Mode `write` bắt buộc có đủ file trong `allowed_paths` và validator exit 0 mới coi là thành công.
   - Thay validator JSON tự viết bằng kiểm schema tối thiểu đúng (`enum`, `const`, `required` phải là mảng); hoặc chỉ dùng mode `write` + checker riêng.
   Các mục còn lại (quyền đường dẫn từng job, log chứa nội dung, diệt cây tiến trình, quarantine) ghi vào mục 6 và xử lý khi gặp.
5. Tạo worktree cho Gemini: `git worktree add ../CRM2-gemini -b gemini/work`. Worktree **không phải sandbox bảo mật**; không copy `.env`, chỉ `.env.example`.
6. Tạo project cách ly `agy` theo `tools/agy-runner/templates/quarantine-project.json` cho mode `json`.

## 3. Quy ước giao việc

Thư mục: `ai-jobs/<phase>-<slug>/` gồm `work-order.md` (theo `tools/agy-runner/templates/work_order.md`, tiếng Anh), `jobs.json`, `prompts/*.txt`, `checker.py`, `logs/`. Thư mục `ai-jobs/` có trong git (trừ `logs/`).

Mỗi job phải có:
- `allowed_paths` liệt kê **đúng** file được tạo/sửa; job khác file khác; không hai job cùng file.
- Nguồn được đọc liệt kê rõ (contract, design system, 1 file ví dụ). Gemini không đọc `.env`, `prisma/migrations`, `src/lib/rbac.ts`.
- Checker chạy được bằng máy: `tsc --noEmit` trên file đó, `vitest run <file>`, `eslint`, đếm chuỗi tiếng Việt, hoặc so schema fixture bằng zod.
- Tiêu chí nghiệm thu của Claude (mục 6 work order), không dựa vào báo cáo của Gemini.

Chạy:

```powershell
python -I tools\agy-runner\run_agy.py ai-jobs\p1-ui-basic\jobs.json --repo D:\CRM2-gemini --logs ai-jobs\p1-ui-basic\logs --max-parallel 1
```

Bắt đầu `--max-parallel 1`; tăng lên 3 sau batch đầu ổn.

Nghiệm thu: Claude `git diff` trên worktree, chạy checker + `npm run typecheck && npm test`, đọc từng component theo design system (4 trạng thái, z-index, tiếng Việt), rồi `git cherry-pick`/merge vào nhánh chính. Ghi một dòng vào `ai-jobs/LEDGER.md`.

## 4. Phần phụ trợ có thể giao Gemini theo phase (~20%)

Cột Claude là phần chính, Claude tự làm. Cột Gemini là phần **có thể** giao, không bắt buộc.

| Phase | Claude làm (chính) | Gemini có thể phụ trợ | Checker |
|---|---|---|---|
| 1 | Toàn bộ: scaffold, schema, `db`, `rbac`, auth, token, AppShell, Drawer/Modal, DataTable, Form, trang quản trị, seed | `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Toast` | tsc, eslint, vitest render |
| 2 | Adapter registry, normalize, liên kết đơn, sync worker, trang `/ket-noi`, `/don-hang`, `/xac-minh` | Sinh fixture đơn 12 tháng cho 2 adapter theo zod schema; bảng test ánh xạ trạng thái | zod parse; vitest |
| 3 | Gộp/tách, chuẩn hóa SĐT, scope, toàn bộ trang 360 | Bảng test chuẩn hóa SĐT 6 quốc gia | vitest |
| 4 | Toàn bộ (phân công, hàng đợi, kanban, task, nhắc) | Fixture lead/hội thoại mẫu | zod parse |
| 5 | Toàn bộ (ticket, SLA, tri thức) | Bài tri thức mẫu 4 ngôn ngữ (Claude duyệt nội dung) | zod parse, đếm ngôn ngữ |
| 6 | Toàn bộ (Warehouse, SQL chỉ số, Score, UI điểm) | Bảng test RFM với kỳ vọng Claude tính tay | vitest |
| 7 | Toàn bộ (segment, journey, cap, outbox, UI) | — | — |
| 8 | Toàn bộ (LlmProvider, tool, approval, lọc PII, AiPanel, `/ai`) | Fixture LLM replay 6 chức năng × 4 ngôn ngữ theo schema (Claude đọc từng câu) | zod parse |
| 9 | Toàn bộ (truy vấn, 6 trang báo cáo, biểu đồ, xuất) | — | — |
| 10 | Toàn bộ (vận đơn, COD 4 mốc, sản phẩm) | Fixture DeliveryEvent/Settlement | zod parse |
| 11 | Rà soát UI/UX, sửa, E2E, kịch bản demo, deploy-checklist | Ảnh chụp 4 trạng thái mọi trang theo danh sách | tồn tại file ảnh |

## 5. Không giao Gemini

Prisma schema/migration, `lib/db.ts`, `lib/rbac.ts`, `lib/money.ts`, mọi service nghiệp vụ, adapter (cả replay lẫn thật), trang/luồng UI chính, tool AI, prompt hệ thống, mọi thứ chạm bí mật, review bảo mật, nghiệm thu, cập nhật `docs/*`.

## 6. Rủi ro runner còn mở (từ review 28/10)

| # | Vấn đề | Xử lý |
|---|---|---|
| 1 | `allowed_paths` chỉ đối chiếu git trước/sau; file gitignore/ngoài repo không bị bắt | Worktree riêng + checker kiểm file tồn tại; không để Gemini gần `.env` |
| 2 | Quyền đường dẫn gộp giữa job | Mỗi batch một worktree; job khác file |
| 3 | `search_web` tính thành công | Sửa ở lát 1.0 |
| 4 | `prompt_file` → `-p` | Sửa ở lát 1.0 |
| 5 | Validator JSON lỗi | Sửa/thay ở lát 1.0 |
| 6 | Log chứa nội dung | `logs/` gitignore; không đưa PII vào prompt (fixture là hư cấu) |
| 7 | Mode `write` không bắt buộc sản phẩm | Sửa ở lát 1.0 |
| 8 | Quarantine chưa được runner xác minh | Chỉ dùng mode `json` cho phân loại không chạm file |

## 7. Trạng thái môi trường (cập nhật khi làm lát 1.0)

- `agy` **1.4.9** tại `C:\Users\ADMIN\AppData\Local\agy\bin` (kiểm 28/10). `agy -p "Reply with exactly READY…"` trả `READY` — headless chạy được. Model có trên tài khoản: `gemini-4-argon-{low,medium,high}`, `gemini-3.8-flash-{low,medium,high}` (và một số model khác). Dùng `gemini-4-argon-medium` cho việc cần chất lượng, `gemini-3.8-flash-medium` cho fixture/test bảng.
- `agy -p` **không đọc prompt từ stdin** ở chế độ text (`-p -` bị hiểu là prompt "-", kiểm 28/10). Vì vậy runner truyền `prompt_file` bằng một câu trỏ tới file + `--add-dir` thư mục chứa file.
- Runner đã sửa 4 mục chặn (28/10): validator JSON so `true`≠`1`, `false`≠`0` và kiểm `required`/`enum` đúng kiểu lúc nạp cấu hình; `search_web` tính là TOOL_BREACH; mode `write` báo `NO_OUTPUT` khi thiếu file trong `allowed_paths` và có `check` (lệnh kiểm, exit ≠ 0 → `CHECK_FAILED`); `prompt_file` không nằm trên dòng lệnh. `python -I tools/agy-runner/test_run_agy.py`: **ALL PASSED, 15/15 mutant bị bắt**.
- Git: đã `git init` (nhánh `main`), **chưa có commit nào** → chưa tạo được worktree `../CRM2-gemini`. Cần người dùng cho phép commit lần đầu trước batch Gemini đầu tiên.
- Phase 1 không giao Gemini việc nào: các component dự kiến giao (badge, skeleton, empty/error state, toast) nhỏ đến mức Claude viết nhanh hơn soạn work order + review. Tỷ lệ Phase 1: Claude 100% / Gemini 0%.
- Worktree `D:\CRM2-gemini` (nhánh `gemini/work`) tạo sau commit đầu (28/10). Batch đầu tiên `ai-jobs/p2-catalog` chạy thật: 152 s, checker OK, 0 ghi sai chỗ, Claude đọc duyệt 42 tên — ghi ở `ai-jobs/LEDGER.md`.
- Phase 2 tỷ lệ: Claude ~93% / Gemini ~7% (danh mục sản phẩm đa ngôn ngữ). Dữ liệu đơn 12 tháng KHÔNG giao Gemini vì script tất định làm được (luật phân luồng mục 1).

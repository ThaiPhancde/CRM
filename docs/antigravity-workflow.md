# Phối hợp Claude Code + Gemini (Antigravity CLI)

Cập nhật: 28/10/2026 (Phase 0). Nguồn: `CRM2_Claude_Antigravity_Tom_tat.md`, `tools/agy-runner/HUONG-DAN.md`. Người dùng yêu cầu (28/10): kết hợp Antigravity với Claude chỉ đạo; tỷ lệ chỉnh từ 80/20 thành **60/40** ngày 29/10 (D-27).

## 1. Vai trò và tỷ lệ

| | Claude Code — chỉ đạo, ~60% | Gemini qua `agy -p` — ~40% |
|---|---|---|
| Quyết định | Mọi quyết định: phạm vi, thiết kế, contract, chấp nhận hay bỏ output | Không quyết định gì |
| Code lõi | Kiến trúc, Prisma schema, migration, `db`, `session`, quyền, approval, audit, idempotency, adapter, logic tiền, chống trùng, liên kết đơn, gộp khách, chấm điểm, journey, tool AI, prompt | Không chạm |
| Contract | Zod schema, kiểu TS trả về của service, server action (chỉ chuyển FormData → service) | Dùng đúng contract, không sửa |
| UI | AppShell, design system lõi (Drawer/Modal/DataTable/Form), trang có luồng phức tạp hoặc chạm tiền/quyền (ví dụ hàng đợi xác minh, duyệt AI) | **Phần lớn trang**: danh sách, chi tiết, form, kanban, timeline, trang báo cáo + biểu đồ — gọi service/action Claude đã viết, theo `docs/ui-design-system.md` và một trang mẫu |
| Dữ liệu | Zod schema của fixture, script sinh tất định khi có quy luật | Fixture cần văn bản tự nhiên (sản phẩm, hội thoại, ticket, bài tri thức, câu trả lời AI mẫu), đa ngôn ngữ |
| Test | Test nghiệp vụ, tích hợp, quyền, cô lập workspace | Test bảng cho hàm thuần đã có chữ ký; test E2E Playwright theo kịch bản Claude viết |
| Rà soát | Review mọi diff, chạy test, sửa, nghiệm thu, cập nhật docs | Ảnh chụp 4 trạng thái theo danh sách trang |

**Cách giữ tỷ lệ:** mỗi phase Claude viết schema + service + test trước (nguồn sự thật), rồi giao Gemini các trang và dữ liệu mẫu theo bảng mục 4 — chạy song song khi Claude làm lát kế tiếp. Batch thất bại hoặc review cần sửa nhiều hơn tự làm thì Claude tự làm, không chờ. Cuối mỗi phase ghi tỷ lệ ước tính vào `implementation-status.md`; dưới ~30% là đang giao quá ít, trên ~50% là đang giao cả phần lõi.

**Đo tỷ lệ:** tính theo số dòng code + nội dung được merge (không tính docs), ghi ở `ai-jobs/LEDGER.md`.

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

## 4. Việc giao Gemini theo phase (~40%)

Phase 1–2 đã làm theo tỷ lệ cũ (Phase 1: 0%, Phase 2: ~7%). Từ Phase 3 áp dụng bảng dưới. Cột Claude làm trước; cột Gemini giao sau khi service + test của Claude xanh.

| Phase | Claude làm (lõi) | Giao Gemini | Checker |
|---|---|---|---|
| 3 | Schema `Customer`/`CustomerIdentity`/`Address`/`ContactPreference`, chuẩn hóa SĐT E.164, hợp nhất/gộp/tách có bằng chứng, `scopeFor`, che PII, service `listCustomers`/`getCustomer360` + test | Trang `/khach-hang` (danh sách, lọc), trang 360 (thẻ tóm tắt, tab Đơn/Tương tác/Địa chỉ/Danh tính/Lịch sử gộp, `Timeline`), tab Khách ở `/xac-minh`; bảng test chuẩn hóa SĐT 6 quốc gia | tsc, eslint, vitest, E2E mở trang |
| 4 | Schema Lead/Assignment/Activity/Task, quy tắc phân công, idempotency, worker nhắc, service + test | Kanban `/nhu-cau`, `/hang-doi`, `/nhiem-vu`, form Activity/Task, drawer chuyển phụ trách; fixture lead + hội thoại 4 ngôn ngữ | tsc, vitest, zod fixture, E2E kéo thả |
| 5 | Schema Ticket/SLA/KnowledgeArticle, tính SLA, service + test | `/cham-soc` danh sách + chi tiết (timeline, phản hồi), `/tri-thuc` (danh sách, soạn markdown, phiên bản); 20 bài tri thức mẫu vi/en/ar/de | tsc, zod, đếm ngôn ngữ, E2E |
| 6 | Warehouse interface, SQL chỉ số, Score engine + ScoreVersion, service + test | Hiển thị điểm/lý do ở 360 và bảng, trang cấu hình trọng số; bảng test RFM (Claude tính kỳ vọng) | tsc, vitest |
| 7 | Segment/Journey engine, ContactCap, Outbox, service + test | `/phan-khuc` (builder điều kiện), `/hanh-trinh` (sơ đồ bước, danh sách run), `/chien-dich`; mẫu tin nhắn 4 ngôn ngữ | tsc, zod, E2E |
| 8 | LlmProvider, tool registry, approval, lọc PII, prompt hệ thống, service + test | `AiPanel`, trang `/ai` (lịch sử run, duyệt, chi phí); fixture LLM replay 6 chức năng × 4 ngôn ngữ (Claude đọc từng câu) | tsc, zod, E2E |
| 9 | Truy vấn báo cáo qua Warehouse + scope, service trả số liệu + test | 6 trang `/bao-cao/*` + biểu đồ Recharts + dashboard theo vai | tsc, snapshot số khớp service |
| 10 | COD 4 mốc, Settlement, PurchasingLink, parser dán dữ liệu, service + test | `/van-don`, màn cập nhật hàng loạt, nâng cấp `/san-pham`; fixture Settlement | tsc, zod, E2E |
| 11 | Kịch bản demo, deploy-checklist, sửa lỗi lõi | Bộ E2E Playwright đi hết kịch bản, ảnh chụp 4 trạng thái mọi trang, sửa lỗi UI theo danh sách Claude | E2E xanh, axe |

**Cách giao UI cho Gemini:** work order nêu đường dẫn trang, service/action được gọi (chữ ký + kiểu trả về), một trang mẫu đã có để bắt chước (ví dụ `src/app/(app)/don-hang/page.tsx`), `docs/ui-design-system.md`, và danh sách 4 trạng thái phải có. Checker: `npx tsc --noEmit`, `npx vitest run`, chuỗi giao diện phải là tiếng Việt, không import `@/lib/db` trực tiếp trong file view (chỉ qua service).

## 5. Không giao Gemini

Prisma schema/migration, `lib/db.ts`, `lib/session.ts`, `lib/permissions.ts`, mọi file `src/modules/**/service.ts` và logic nghiệp vụ (tiền, chống trùng, gộp, chấm điểm, journey), adapter (cả replay lẫn thật), server action có kiểm quyền, tool AI, prompt hệ thống, mọi thứ chạm bí mật, review bảo mật, nghiệm thu, cập nhật `docs/*`.

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

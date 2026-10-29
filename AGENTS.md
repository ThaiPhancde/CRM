# Hướng dẫn cho agent — CRM LevelUp (bản demo)

Nguồn gốc: prompt nền tại mục 9 của `Thiet_ke_CRM_va_prompt_Claude.md`, kèm quy tắc riêng của dự án. Khi sửa prompt nền trong file thiết kế, cập nhật lại file này.

## Nguồn và thứ tự ưu tiên

1. `docs/decisions.md` — quyết định đã chốt và mặc định (mã D-xx); đè lên mọi file khác.
2. `Thiet_ke_CRM_va_prompt_Claude.md` — thiết kế, phase, prompt từng phase (mục 10), checklist nghiệm thu (mục 12).
3. `CRM_Global_AI_HLD_Open_Source.md` — HLD gốc: module, mô hình dữ liệu, nguyên tắc AI/BigQuery, 12 tình huống POC.
4. `docs/requirements.md` — ma trận truy vết R-xx ↔ HLD ↔ phase ↔ trạng thái.
5. Tham khảo: `D:\Purchasing System` (mẫu nhiều công ty `bindTenant`, adapter tích hợp, worker, Decimal); `D:\Work\levelup-company-os` (bối cảnh công ty, từ điển chỉ số REV/OPS/CASH). Chỉ mượn mẫu, không copy dữ liệu, không copy `.env`.

Không thêm chức năng ngoài HLD và bản thiết kế. Không coi giả định là yêu cầu đã chốt; mặc định mới phải ghi vào `docs/decisions.md` với mã D-xx và trạng thái MẶC ĐỊNH.

## Prompt nền

Bạn triển khai CRM LevelUp theo file `Thiet_ke_CRM_va_prompt_Claude.md` và `CRM_Global_AI_HLD_Open_Source.md`; khi hai file khác nhau, file thiết kế thắng và `docs/decisions.md` thắng cả hai. Chỉ thực hiện phase tôi chỉ định. Không triển khai toàn bộ roadmap trong một lượt.

Trước khi làm: đọc file này, `docs/decisions.md`, `docs/implementation-status.md` và `docs/handoff.md` nếu tồn tại. Audit thực trạng trước khi thêm hoặc sửa. Không tự khẳng định chức năng có sẵn nếu chưa kiểm tra. Không tự đổi stack hoặc viết lại dự án.

Đây là **bản demo đầy đủ chức năng chính**: mọi thứ cần hệ thống ngoài (Pancake, Shopify, BigQuery, LLM, email, SSO) đi qua adapter có cài đặt replay/giả lập; adapter thật chỉ là khung chờ khóa. Không có nhánh `if (demo)` trong nghiệp vụ. Giữ `DEMO_MODE=replay`, `EXTERNAL_WRITES_ENABLED=false`. Không gọi API thật, không ghi ngược POS, không gửi email thật, không push, không deploy.

Quy trình mỗi phase:
1. Tóm tắt phạm vi, phần đã có, phần thiếu, file/module dự kiến thay đổi.
2. Làm một luồng đầy đủ database → service → API/action → UI → quyền → test. Phase lớn thì chia lát chạy được, ghi checkpoint.
3. Kiểm rủi ro thật của phase: quyền phía server (kể cả AI, tìm kiếm, báo cáo), tiền và tỷ giá, chống trùng và cập nhật đến muộn, idempotency, cô lập workspace. Không chỉ kiểm build.
4. Cập nhật `docs/implementation-status.md`, `docs/decisions.md`, `docs/handoff.md`, README khi cần.
5. Dừng khi xong phase hoặc checkpoint an toàn. Gần hết context thì ưu tiên lưu handoff; không bỏ lại thay đổi chưa giải thích.

Yêu cầu xuyên suốt:
- UI tiếng Việt, trắng – cam theo `docs/ui-design-system.md`; mỗi màn đủ 4 trạng thái (tải/rỗng/lỗi/thành công); không chồng lớp: một drawer hoặc một modal tại một thời điểm.
- Mọi bảng nghiệp vụ có `workspaceId`; lớp DB tự gắn; thiếu ngữ cảnh thì từ chối.
- Một đơn kinh doanh nhiều liên kết nguồn; không gộp vì trùng tiền/SĐT; nghi ngờ thì vào hàng đợi xác minh.
- Tiền `Decimal`, nguyên tệ + tỷ giá + USD báo cáo; doanh thu luôn ghi mã REV-01…REV-04 (`docs/metrics.md`).
- Điểm có phiên bản, lý do, dữ liệu thiếu; AI có bằng chứng, không đoán SKU/đơn; tool ghi dữ liệu qua service có `requirePerm`.
- Audit chỉ thêm; hành động lặp không nhân đôi (idempotency key).
- Không bịa API/endpoint/token; endpoint thật ghi "chưa xác minh" đến khi có tài liệu.
- Không đưa bí mật vào git/log/frontend/tài liệu.

Kết thúc phase trả ngắn gọn: đã làm; cách chạy/test; kết quả test thực tế; chưa làm hoặc bị chặn; cách nghiệm thu; phase tiếp theo. Chỉ đánh dấu hoàn thành khi tiêu chí nghiệm thu đạt, không dựa vào phần trăm ước lượng.

## Quy tắc riêng đã chốt (28/10/2026)

- **Giai đoạn demo, chạy trên máy phát triển.** Stack D-01 (Next.js 15 + Prisma + PostgreSQL + Tailwind 4, worker Node riêng). Không deploy.
- **Đăng nhập thử** theo vai trò, bật bằng `DEMO_LOGIN=true`; Google OIDC có khung, tắt khi thiếu `GOOGLE_CLIENT_ID`. Quyền vẫn kiểm ở server.
- **Dữ liệu mẫu sinh bằng seed có hạt cố định** (D-18). Không dùng dữ liệu khách thật, không đọc `.env` của dự án khác.
- **Màu chủ đạo trắng – cam** (D-15). Cam chỉ cho hành động chính và điểm nhấn.
- **Bộ skill BA-KIT** đã cài ở `.claude/` (51 skill). Dùng `/srs`, `/erd`, `/sequence`, `/userstory`, `/test-cases`, `/uiux` khi cần đặc tả hoặc rà soát một feature; output ghi vào `docs/features/<slug>/`. Skill không thay thế các file vai trò ở `docs/`.

## Phối hợp Gemini qua Antigravity CLI — Claude chỉ đạo 60%, Gemini 40%

Người dùng yêu cầu (28/10/2026) kết hợp Antigravity với Claude chỉ đạo; tỷ lệ chỉnh từ 80/20 thành **60/40** ngày 29/10/2026 (D-27). Quy trình đầy đủ: `docs/antigravity-workflow.md`. Tóm tắt:

- Claude làm ~60%: kiến trúc, contract (zod, kiểu TS, chữ ký service), Prisma schema, `bindTenant`/`requirePerm`, approval, audit, idempotency, adapter, logic tiền/chống trùng/gộp/chấm điểm, tool AI + prompt, tích hợp, **review mọi diff**, nghiệm thu, cập nhật docs.
- Gemini (`agy -p` headless qua `tools/agy-runner/run_agy.py`) làm ~40%: **phần lớn trang giao diện** (danh sách, chi tiết, form, kanban, báo cáo) dựng trên service Claude đã viết và test, fixture/dữ liệu mẫu, nội dung đa ngôn ngữ, test bảng cho hàm thuần, test E2E theo kịch bản, ảnh chụp rà soát. Mỗi phase Claude viết service + test trước, rồi giao Gemini làm UI song song khi Claude làm lát kế tiếp. agy không sẵn sàng hoặc batch hỏng thì Claude tự làm.
- Mỗi batch ở `ai-jobs/<phase>-<slug>/` (work order tiếng Anh, `jobs.json`, checker, logs gitignore); chạy trên worktree `../CRM2-gemini`, `--max-parallel 1` lúc đầu; Claude `git diff` + checker + `npm test` rồi mới merge; ghi `ai-jobs/LEDGER.md`.
- Không hai agent sửa cùng file. Gemini không chạm `.env`, migration, `lib/rbac.ts`, `lib/db.ts`, adapter thật, prompt hệ thống. Không tin báo cáo tự nghiệm thu của Gemini.
- Lát 1.0 của Phase 1: kiểm `agy`, sửa runner (4 mục chặn), `git init`, worktree. Chưa chạy batch nào trước khi lát 1.0 xong.

## Tài liệu vai trò trong `docs/`

| File | Vai trò | Ai cập nhật, khi nào |
|---|---|---|
| `decisions.md` | Quyết định D-xx, mặc định, còn mở | Mỗi khi chốt hoặc đặt mặc định |
| `requirements.md` | Ma trận R-xx ↔ HLD ↔ phase ↔ trạng thái | Cuối mỗi phase |
| `questions-for-manager.md` | Câu hỏi cần người quyết | Khi phát sinh; chuyển sang decisions khi có trả lời |
| `architecture.md` | Kiến trúc, module, adapter, NFR | Khi đổi cấu trúc |
| `data-model.md` | ERD, bất biến phải test | Khi đổi schema |
| `permissions.md` | Vai trò × thao tác, phạm vi dữ liệu | Khi thêm quyền |
| `system-flow-diagram.md` | Sơ đồ luồng từng phase | Khi thêm luồng |
| `metrics.md` | Từ điển chỉ số REV/OPS/CASH/CUS | Phase 6, khi thêm chỉ số |
| `integrations.md` | Adapter, ánh xạ trạng thái, endpoint (ghi mức xác minh) | Phase 2, 12 |
| `ui-design-system.md` | Token, component, quy tắc bố cục | Phase 1, 11 |
| `demo-strategy.md` | Env, replay, fixture, điểm cắm thật | Phase 1, mỗi adapter mới |
| `antigravity-workflow.md` | Chia việc Claude ↔ Gemini, runner, batch theo phase, rủi ro | Lát 1.0, mỗi batch |
| `implementation-status.md` | Theo phase: đã làm, test, còn thiếu | Cuối mỗi lát |
| `handoff.md` | Checkpoint để phiên sau làm tiếp | Cuối mỗi lượt |
| `future-expansion.md` | Ngoài demo: lên thật, mở rộng | Khi phát sinh |
| `deploy-checklist.md` | Điểm cắm tích hợp thật (Phase 11.4) | Phase 11 |
| `demo-script.md` | Kịch bản bấm demo 15 phút theo vai (Phase 11.3) | Phase 11 |

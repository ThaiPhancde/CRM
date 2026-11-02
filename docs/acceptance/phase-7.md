# Biên bản nghiệm thu Phase 7 — Điều phối chăm sóc và marketing

- **Ngày:** 02/11/2026
- **Yêu cầu:** người dùng yêu cầu nghiệm thu Phase 7 rồi làm Phase 8.
- **Người kiểm:** Claude, đối chiếu tiêu chí "Nghiệm thu" Phase 7 trong `Thiet_ke_CRM_va_prompt_Claude.md` mục 10, checklist mục 12 (dòng journey) và quy tắc chịu tải D-48.
- **Phiếu ký chính thức:** thuộc người dùng và giám đốc (D-30).
- **Kết quả chung:**
  - `npx vitest run` → 11 file, **317 passed, 1 skipped**. Ca bỏ qua là chạy thử BigQuery thật, chỉ chạy khi có khóa.
  - `npx tsc --noEmit` sạch; `next build` thành công.
  - Đo tải 200k khách / 600k đơn: **0/49 vượt mục tiêu** (`docs/perf/phase7.json`).

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Khách mua giữa chừng → run dừng với lý do | Test `khách mua giữa chừng thì dừng có lý do…`: khách có đơn sau khi vào hành trình → `EXITED`, lý do "Khách đã mua". Cùng nhóm luật: ticket mở → "Đang có khiếu nại cần xử lý"; từ chối nhận tin → "Khách từ chối nhận tin"; quá hạn → "Hết hạn N ngày". | **Đạt** |
| Vượt ContactCap → bỏ qua, ghi lý do | Test: khách đã nhận 2 email trong 7 ngày → `SKIPPED_CAP` "Đã nhận 2/2 tin EMAIL trong 7 ngày", không ghi Outbox/ContactLog. Đếm từ `ContactLog` xuyên chiến dịch. Thêm: thị trường DE chưa đồng ý → `SKIPPED_NO_CONSENT`; ngoài 9–20 giờ địa phương → dời tới 9:00 (cả múi lệch nửa giờ, 80 ca bảng). | **Đạt** |
| Không gửi gì ra ngoài (Outbox SIMULATED) | Test chỉ thấy Outbox `SIMULATED`. **DB demo (02/11, mốc 06:00 UTC):** 9 tin vào Outbox, cả 9 `SIMULATED`; tin khách UAE soạn bằng tiếng Ả Rập theo mẫu, có dòng "أرسل STOP…". 23 khách không có email → `SKIPPED_NO_RECIPIENT`. | **Đạt** |
| Chạy lại không gửi trùng (idempotency theo run + bước) | Test chạy lại → không thêm Outbox. **DB demo:** chạy lượt 2 cùng mốc → Outbox vẫn 9, nhật ký bước không đổi. Khóa: `JourneyStepLog(runId, stepIndex)` unique + Outbox `journey:<run>:<bước>`. | **Đạt** |
| Trang /phan-khuc, /hanh-trinh (sơ đồ bước, bật/tắt, xem run), /chien-dich | Trình duyệt (Quản lý + Marketing): lưu/xem trước/chạy phân khúc; tạo hành trình (lỗi theo trường, lưu xong sang trang chi tiết); sơ đồ bước kèm kết quả; danh sách khách lọc + phân trang; Marketing chỉ thấy "Chờ Quản lý bật"; ghi điểm chạm theo SĐT; console 0 lỗi. | **Đạt** |
| Quyền | Test: Marketing bật hành trình → 403; lọc REV-03 thiếu `finance.view` → 403; trường ngoài danh sách cho phép → lỗi; đang chạy không sửa bước. | **Đạt** |
| Chịu tải (D-48) | Xem trước phân khúc 481 ms, chạy phân khúc 3,2 s (23k khách), chạy bước 500 khách 0,93 s, chi tiết hành trình 52 ms, job hằng ngày 82–103 s. | **Đạt** (2 mục sát ngưỡng, ghi `performance.md` mục 5) |

## Ghi nhận khi nghiệm thu

- Hành trình mẫu dùng kênh Email nhưng 23/32 khách tới hạn ở Team PiAlpha không có email trong dữ liệu mẫu → bị bỏ qua đúng luật. Demo muốn thấy nhiều tin hơn thì thêm bước SMS/WhatsApp ở trang sửa hành trình (tạm dừng trước khi sửa).
- **Dữ liệu demo đã đổi:** đã chạy một lượt job ở mốc 06:00 UTC 02/11 → 9 tin SIMULATED, 32 khách đang ở bước "Chờ 3 ngày".
- "Soạn tin theo ngôn ngữ (LLM)": Phase 7 dùng mẫu theo ngôn ngữ khách; Phase 8 có LLM replay.

## Không chặn nghiệm thu

- Nhóm đối chứng / Experiment (R-53) dời Phase 9.
- Giao diện quản trị giới hạn liên hệ và mẫu tin (đang seed / fixture).
- Kho tồn thật qua Purchasing (Phase 10).

## Kết luận

Phase 7 **đạt toàn bộ tiêu chí nghiệm thu**.

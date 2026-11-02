# Biên bản nghiệm thu Phase 6 — Chỉ số, chấm điểm, Warehouse

- **Ngày:** 02/11/2026
- **Yêu cầu:** người dùng yêu cầu nghiệm thu Phase 6.
- **Người kiểm:** Claude, đối chiếu tiêu chí "Nghiệm thu" Phase 6 trong `Thiet_ke_CRM_va_prompt_Claude.md` mục 10 và quy tắc chịu tải D-48.
- **Phiếu ký chính thức:** thuộc người dùng và giám đốc (D-30).
- **Kết quả chung:**
  - `npx vitest run` → 9 file, **230 passed, 1 skipped**. Ca bỏ qua là chạy thử thật trên BigQuery, chỉ chạy khi có khóa.
  - `npx tsc --noEmit` sạch; `next build` thành công.
  - Đo tải 200k khách / 600k đơn: **0/41 vượt mục tiêu** (`docs/perf/phase6.json`).

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Một khách tính tay khớp REV-01..04 và RFM | Test `một khách tính tay khớp REV-01..04 …`. Khách có 5 đơn: ngoài kỳ, giao một phần + hoàn, khách từ chối, đơn hủy, tỷ giá 2. Kỳ vọng tính tay: REV-01 740, REV-02 740, REV-03 480, REV-04 580, hoàn 20, độ gần 35 ngày, chu kỳ 181,5 ngày, mua lại 60 ngày = không, từ chối do khách 1, RFM 4-5-4. SQL ra đúng từng số. | **Đạt** |
| Đổi trọng số tạo phiên bản mới, điểm cũ giữ | Test `đổi trọng số tạo phiên bản mới, điểm cũ giữ; tổng phải 100`. **Trình duyệt (Quản lý, 02/11):** `/quan-tri/diem` nhóm Nhu cầu hỗ trợ — tổng 120/100 thì nút lưu bị khóa; nhập 20/60/20 + lý do → v2 "Đang dùng", v1 "Phiên bản cũ" vẫn 311 điểm. "Tính lại ngay" → v2 có 311 điểm, v1 giữ 311. Cùng một khách: 60 (v1, tính 29/10) và 90 (v2, tính 02/11) — tính lại bằng tay, khớp trọng số và thời gian chờ. | **Đạt** |
| SQL chỉ số chạy trên Postgres; test cú pháp BigQuery, dry-run bỏ qua khi thiếu khóa | Postgres: chạy thật trên demo và `crm_load`. Test SQL sinh cho BigQuery không còn cú pháp riêng Postgres (`$n`, `::`, `EXTRACT(EPOCH`, `INTERVAL '…'`, `AT TIME ZONE`, tên trong ngoặc kép), có `TIMESTAMP_DIFF` và tên bảng theo dataset. Adapter BigQuery trả 501 có hướng dẫn. Dry-run thật `skipIf` khi thiếu `GOOGLE_APPLICATION_CREDENTIALS`. | **Đạt** |
| Điểm có lý do, phiên bản, dữ liệu thiếu; "chưa đủ dữ liệu" khi thiếu (D-11, HLD §7.2) | Test `chưa đủ dữ liệu không mặc định rủi ro` (RFM/rủi ro giao dịch null, không gán "Cao"); 68 ca bảng hàm thuần, Claude tự tính lại từng ca. Trình duyệt: hồ sơ 360 có lý do từng thành phần + "Phiên bản v1" + gợi ý; chi tiết lead 87/100 kèm lý do. | **Đạt** |
| Quyền và che tiền | Test: Marketing tạo phiên bản → 403; người thiếu `finance.view` thấy chỉ số tiền null và bằng chứng M bị che; khách ngoài phạm vi Sales → 404. | **Đạt** |
| Chịu tải (D-48) | Job hằng ngày 80 s (< 2 phút), điểm một khách 4 ms, danh sách khách kèm hạng 120 ms, danh sách lead kèm điểm 166 ms, chấm lead mở 0,7 s/lượt. | **Đạt** |

## Thay đổi khi nghiệm thu

- **Q-20 chốt theo công thức công ty (D-53):** từ điển chỉ số LevelUp coi REV-03 là chỉ số vận hành chính. Giao dịch hợp lệ cho RFM và giá trị khách = REV-03 cho cả COD lẫn prepaid, giữ như đã cài. REV-04 chỉ tham khảo.
- "REV-03 − giá vốn" đổi tên thành **CM-01 Biên đóng góp cấp 1** đúng mã công ty. Từ điển có 25 mã.
- **Dữ liệu demo đã đổi:** Nhu cầu hỗ trợ của Team PiAlpha đang dùng phiên bản 2 (20/60/20) tạo khi nghiệm thu. Muốn về mặc định thì tạo v3 = 40/40/20.

## Không chặn nghiệm thu

- REV-04 chưa gồm COD đã đối soát; chính sách kế toán từng nước (Phase 10–12).
- Chạy thật trên BigQuery (Phase 12).
- Ý định mua dùng từ khóa, Phase 8 thay bằng LLM có bằng chứng.
- Giá vốn thật phải gồm phí + thuế nhập khẩu theo thị trường (ghi chú CM-01).

## Kết luận

Phase 6 **đạt toàn bộ tiêu chí nghiệm thu**.

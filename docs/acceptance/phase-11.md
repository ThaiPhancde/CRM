# Biên bản nghiệm thu Phase 11 — Quản trị, rà soát UI/UX, chạy thử demo

- **Ngày:** 02/11/2026
- **Yêu cầu:** người dùng yêu cầu làm tuần tự: xong Phase 10 nghiệm thu rồi mới làm Phase 11, sau đó nghiệm thu Phase 11.
- **Tiêu chí (thiết kế mục 10):** checklist mục 12 đạt toàn bộ; E2E xanh; tài liệu cập nhật.
- **Người kiểm:** Claude. **Phiếu ký chính thức:** người dùng và giám đốc (D-30).
- **Kết quả chung:** `npx vitest run` 22 file **690 passed, 5 skipped** (test hợp đồng chạy thật chờ khóa); `npm run e2e` **12/12**; `tsc` sạch; `next build` sạch; đo tải **75/75**; đồng thời 20 người **0 lỗi, 13/13**.

## Checklist mục 12

| # | Mục | Bằng chứng | Kết quả |
|---|---|---|---|
| 1 | Một giao dịch ở hai nguồn chỉ tính một lần trong khách, báo cáo, chỉ số | `tests/orders.test.ts` "một giao dịch có ở hai nguồn… chỉ thành một đơn, REV-01 tính một lần"; `tests/customers.test.ts` "cùng SĐT ở hai nền tảng → một hồ sơ"; báo cáo đọc từ đơn chuẩn (REV khớp `/don-hang` 84/84, Phase 9); E2E Quản lý: đơn `#6031` có "Nguồn liên kết (2)" | **Đạt** |
| 2 | Thêm nền tảng mới chỉ cần adapter + fixture (D-28) | `tests/orders.test.ts` "thêm nền tảng thứ ba chỉ cần đăng ký adapter, không sửa nghiệp vụ"; `tests/contracts.test.ts` nền tảng chưa đăng ký → 400 | **Đạt** |
| 3 | Cùng sự kiện gửi lại không tạo đơn, task, tin nhắn trùng | orders "nhận lại cùng phiên bản → DUPLICATE"; sales "tạo lead/việc bấm hai lần chỉ ra một bản", "gửi lặp không nhân đôi"; service "trả lời khách… gửi lặp không nhân đôi"; fulfillment "bấm lại không nhân đôi", đối soát dán lại "Không đổi" | **Đạt** |
| 4 | Cập nhật cũ đến muộn không làm lùi trạng thái | orders "bản cũ đến muộn không làm lùi trạng thái (STALE)" | **Đạt** |
| 5 | Giao/hoàn một phần giữ đúng số lượng theo dòng | orders "giao/hoàn một phần giữ đúng số lượng theo dòng"; REV-03 tính phần đã giao (reports, scoring) | **Đạt** |
| 6 | Gộp khách sai truy vết được và tách lại đúng | customers "gộp rồi tách lại trả đơn về đúng chỗ"; sales "gộp khách chuyển lead/việc… tách lại trả về"; E2E Quản lý: hồ sơ Sophia Johnson → Lịch sử gộp | **Đạt** |
| 7 | Không thấy dữ liệu ngoài quyền qua UI, API, tìm kiếm, báo cáo, AI | customers "thiếu quyền PII/tiền… không tìm được theo SĐT", "team này không mở được hồ sơ team kia"; reports "thiếu finance.view không thấy nhóm tài chính, Sales chỉ thấy của mình"; ai "tool thiếu quyền bị từ chối ở server"; sales "lead / ticket chưa có nhóm chỉ báo Quản lý của chính workspace" (lỗi cô lập sửa ở Phase 10); E2E Sales/Marketing/Kế toán: 404 + không có số tiền | **Đạt** |
| 8 | AI không đoán SKU/đơn khi mơ hồ; tool thiếu quyền bị từ chối ở server | ai "tên mơ hồ → hỏi lại, không tạo việc… tool thiếu quyền bị từ chối ở server"; "nhiều đơn gần đây → hỏi chọn đơn (không đoán)" | **Đạt** |
| 9 | Dashboard đa tiền tệ đối chiếu được nguyên tệ và tỷ giá | reports "đổi tiền tệ báo cáo thấy tỷ giá" + bảng nguyên tệ có tỷ giá bình quân; E2E Quản lý: "1 USD = … ₫ (tỷ giá hiệu lực …)", "Theo nguyên tệ và tỷ giá đã dùng" | **Đạt** |
| 10 | Journey dừng khi khách mua, từ chối hoặc khiếu nại; không vượt frequency cap | marketing "khách mua giữa chừng thì dừng có lý do; vượt giới hạn liên hệ thì bỏ qua", "đang có khiếu nại thì dừng", "EU cần đồng ý trước"; admin-ops: giờ làm việc theo thị trường dời đúng giờ | **Đạt** |
| 11 | Báo cáo AI nêu kỳ, phạm vi, nguồn, độ mới; phân biệt dữ kiện và giả thuyết | `tests/checklist.test.ts` (mới): `period`, `scope`, `source`, `freshness`, `facts[]`, `hypothesis`, bằng chứng dẫn tới Từ điển chỉ số | **Đạt** |
| 12 | Điểm có phiên bản, lý do, dữ liệu thiếu; không dùng dữ liệu tương lai | scoring "chưa đủ dữ liệu không mặc định rủi ro; đổi trọng số tạo phiên bản mới, điểm cũ giữ"; `tests/checklist.test.ts` (mới) — **tìm ra và sửa lỗi**: đơn giao / khoản hoàn / giao thất bại sau mốc tính từng lọt vào chỉ số | **Đạt** (sau sửa) |
| 13 | UI trắng – cam, đủ 4 trạng thái, không chồng lớp, tiếng Việt, AA | `tests/contrast.test.ts` 20 cặp ≥ AA trên token thật (sau khi đổi token, D-59); E2E: không chồng lớp, không cuộn ngang 768/1280/1440/1920, focus 2px, rỗng/lỗi tiếng Việt; rà 2 reviewer, sửa 50 phát hiện đã xác minh; `loading.tsx`/`error.tsx` nhóm + empty state từng trang | **Đạt** |
| 14 | Không gửi gì ra ngoài: Outbox toàn SIMULATED, không gọi API thật | DB demo: Outbox **19/19 SIMULATED**; `tests/contracts.test.ts` gửi ra ngoài chỉ SIMULATED khi tắt, mọi khung thật trả 501; LLM/connector replay | **Đạt** |
| 15 | Chịu tải: bench đạt toàn bộ `performance.md`; đo đồng thời 20 người | `docs/perf/phase11.json` **75/75** (200k khách, 600k đơn, 180k nhu cầu mua, 600k vận đơn); `docs/perf/concurrent20.json` 20 phiên 0 lỗi 13/13 p95 | **Đạt** |
| 16 | Mọi điểm cắm thật có adapter khung, biến env, test hợp đồng bỏ qua khi thiếu khóa, ghi trong `deploy-checklist.md` | `docs/deploy-checklist.md` mục 1; `tests/contracts.test.ts` (5 ca luôn chạy + 4 ca chờ khóa) + BigQuery dry-run. Hội thoại, bộ gửi tin, OIDC chưa có adapter — ghi rõ "chưa có" kèm việc cần làm | **Đạt** (khung còn thiếu được liệt kê trung thực) |

## Lát 11.1–11.4

| Lát | Kết quả |
|---|---|
| 11.1 Quản trị | Cấu hình 5 nhóm (test lưu + audit + nghiệp vụ đọc giá trị mới), nhật ký lọc + trước/sau, xuất/xóa dữ liệu khách (test: không còn chuỗi định danh ở 11 bảng, đơn + số tiền giữ, chạy lại không đổi, audit không PII), `npm run backup` chạy thật (`backups/crm-…dump`) |
| 11.2 UI/UX | Như mục 13; 2 batch Gemini qua checker lần đầu |
| 11.3 Demo | `docs/demo-script.md`; E2E đi đúng kịch bản 5 vai; seed AI mẫu |
| 11.4 Handoff | `docs/deploy-checklist.md` + test hợp đồng |

## Ghi nhận

- **Dữ liệu demo đã đổi khi nghiệm thu:** giá vốn 14 biến thể (Phase 10), các lần đổi team của Quản lý trong E2E (chỉ cookie phiên).
- Tỷ lệ chia việc Phase 11 ~41/59 (Claude/Gemini) theo dòng — lệch D-54, ghi ở `implementation-status.md`.

## Kết luận

Phase 11 **đạt toàn bộ tiêu chí nghiệm thu**: checklist mục 12 16/16, E2E xanh, tài liệu cập nhật.

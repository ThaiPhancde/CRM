# Biên bản nghiệm thu Phase 3–5

- **Ngày:** 29/10/2026
- **Yêu cầu:** người dùng yêu cầu nghiệm thu Phase 3–5 rồi commit.
- **Người kiểm:** Claude, đối chiếu từng tiêu chí "Nghiệm thu" trong `Thiet_ke_CRM_va_prompt_Claude.md` mục 10 (bản đã cập nhật D-48/D-49).
- **Phiếu ký nghiệm thu chính thức** thuộc người dùng và giám đốc (D-30).
- **Môi trường:** máy phát triển, PostgreSQL 18.
  - DB demo `crm`: 2 team, ~1.967 đơn, 414 khách, 60 lead, 30 ticket, 20 bài tri thức.
  - DB tải `crm_load`: 602k đơn, 200k khách, 180k lead, 50k ticket.

**Kết quả chung:**
- `npx vitest run` → 7 file, **157/157 passed**.
- `npx tsc --noEmit` sạch; `next build` thành công.
- Đo tải trên `crm_load`: 0/35 thao tác vượt mục tiêu (`docs/performance.md`).
- `npm run worker -- --once` trên DB demo: exit 0.

## Phase 3 — Customer 360

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Gộp sai tách lại được, đơn về đúng | Test `chỉ trùng email … gộp rồi tách lại`. **Trình duyệt (Quản lý):** `/xac-minh` tab Khách gộp cặp "Sophia Johnson" (3 → 2 cặp chờ), mở hồ sơ giữ lại → tab Lịch sử gộp → "Tách lại". Kiểm DB sau tách: hai hồ sơ đều hoạt động, hồ sơ bị gộp nhận lại 1 đơn + 1 danh tính, `MergeLog.unmergedAt` có giá trị. | **Đạt** |
| Người thiếu quyền không thấy tiền và PII qua UI lẫn API | Test `người thiếu quyền PII/tiền …` (SĐT/email che, giá trị null, không tìm được theo SĐT). **API (Marketing):** `/don-hang/xuat` trả 200, SĐT dạng `+971 5•••••827`, cột tiền trống, không có SĐT đầy đủ nào trong file. Trang không có quyền (Marketing → `/cham-soc`) hiện "không có quyền", menu ẩn. | **Đạt** |
| Chuẩn hóa SĐT nhiều quốc gia (VN, US, DE, AE, SA, KW) | `tests/phone.test.ts`: 92 ca, 7 nước (thêm FR) — có "+", "00", số nội địa có/không tiền tố trung kế, ký tự phân cách, quá ngắn/dài. | **Đạt** |
| Không chia sẻ hồ sơ giữa team | Test `cùng SĐT ở hai team là hai hồ sơ riêng …`. | **Đạt** |

## Phase 4 — Nhu cầu mua và không gian sales

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Lead mới có người + hạn phản hồi trong ≤ 1 phút | Giao ngay khi tạo (test `lead mới có người phụ trách + hạn 4 giờ ngay khi tạo`); lead treo do worker giao mỗi phút (`WORKER_INTERVAL_MIN` mặc định 1; test `đủ tải thì để hàng chờ … worker giao khi có chỗ`). Worker chạy thật exit 0. | **Đạt** |
| Chuyển phụ trách có lịch sử | Test `chuyển phụ trách: cần lead.assign, đúng phạm vi, có lý do; lịch sử chỉ thêm`; trình duyệt Phase 4: Lịch sử phụ trách hiển thị. | **Đạt** |
| Task trùng (bấm hai lần) không nhân đôi | Test `tạo lead/việc bấm hai lần (cùng khóa) chỉ ra một bản` (kể cả hai yêu cầu đồng thời). | **Đạt** |
| Trưởng nhóm thấy cả team, Sales chỉ của mình | Test `Sales chỉ thấy lead của mình + chưa giao của nhóm; Trưởng nhóm thấy nhóm …`; test phạm vi khách/đơn (D-45). Trình duyệt: Phạm Sales thấy 6 khách thay vì 414. | **Đạt** |
| (D-49) Khách nhắn lại không tạo lead trùng | Test `khách liên hệ lại khi còn lead mở cùng SĐT + brand → ghi vào lead cũ`. | **Đạt** |
| (D-49) Lead im lặng tự đóng có lý do | Test `lead im lặng quá 14 ngày tự chuyển Mất liên lạc …`; worker chạy thật tự đóng 5 lead demo im lặng. | **Đạt** |
| (D-48) Danh sách/Kanban/hàng đợi < 500 ms, worker < 5 s với 180k lead | `docs/perf/after.json`, `phase5.json`: danh sách lead 109 ms, Kanban 87–105 ms, hàng đợi 11 ms, worker 0,7 s. | **Đạt** |

## Phase 5 — Dịch vụ sau bán và tri thức

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| SLA tính đúng theo mức | Test `hạn SLA theo mức (mặc định) và theo chính sách brand; đổi mức tính lại hạn` (Khẩn 30 phút/2 giờ; chính sách Lumi Trung bình 1 giờ/6 giờ). | **Đạt** |
| Quá hạn hiện ở hàng đợi | Test `SLA: nhắc … ; hàng đợi xếp quá hạn và khách VIP trước`. **Trình duyệt (Vũ Vận Đơn):** `/hang-doi` đầu danh sách là các ticket "Quá hạn", có ★ khách giá trị cao. | **Đạt** |
| Bài tri thức đúng brand/market/ngôn ngữ | Test `lọc theo brand/market … và ngôn ngữ; ticket gợi ý bài cùng brand/market`; test `nháp không hiện cho người đọc …`. Trình duyệt: bài có "Có bản nháp mới", người soạn xem v2 kèm cảnh báo. | **Đạt** |
| Quyền `ticket.*`, `knowledge.*` | Test phạm vi ticket (Sales/Vận đơn/Trưởng nhóm/Marketing 403/team khác); chuyển phụ trách cần `ticket.assign`; Sales soạn bài bị 403. Trình duyệt: Marketing không vào được `/cham-soc`. | **Đạt** |

## Không chặn nghiệm thu, đã ghi để làm sau

- Số mặc định chờ người dùng xác nhận: Q-22 (30 lead/người), Q-23 (SLA), D-48 (khối lượng mục tiêu), D-49 (7/14 ngày).
- SLA chưa tạm dừng khi "Chờ khách", chưa theo giờ làm việc từng thị trường (Phase 11).
- Chưa có nút "Tạo ticket" ngay từ trang đơn/khách.
- Chưa có E2E tự động và chưa đo tải đồng thời nhiều người (Phase 11).
- Địa chỉ khách demo chỉ có quốc gia (nguồn phát lại chưa có địa chỉ chi tiết).

## Kết luận

Phase 3, 4, 5 **đạt toàn bộ tiêu chí nghiệm thu** của bản thiết kế. Các mục "để sau" không thuộc tiêu chí của ba phase này.

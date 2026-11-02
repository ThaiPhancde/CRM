# Kịch bản demo 15 phút (Phase 11.3)

Dành cho người đi demo CRM LevelUp cho ban giám đốc và các trưởng bộ phận. Mỗi vai một đoạn ngắn; tổng khoảng 15 phút nếu đi hết. Thứ tự bấm dưới đây cũng là kịch bản E2E smoke (`tests/e2e/demo.spec.ts`), nên chạy `npm run e2e` trước buổi demo để chắc mọi bước còn chạy.

## Chuẩn bị (trước buổi demo, 5 phút)

1. DB demo mới: `npm run db:deploy && npm run db:seed && npm run db:seed-demo` (seed có hạt cố định — mọi máy ra cùng dữ liệu: 2 team, ~2.000 đơn 12 tháng, khách COD Trung Đông + khách EU trả trước, đơn trùng hai nguồn, khách đã gộp, ticket, hành trình đang chạy, đối soát COD, vài lần chạy AI).
2. `npm run worker` một lượt (chỉ số + điểm khách) rồi `npm run dev`, mở `http://localhost:3000/dang-nhap`.
3. Chạy `npm run e2e` (kiểm cả kịch bản này). Nếu có bước đỏ, xem `tests/e2e/shots/`.
4. Nhắc người xem: **chế độ demo** — mọi dữ liệu nguồn là phát lại từ dữ liệu mẫu, không gọi API thật, không gửi tin thật (hàng đợi gửi đi toàn "giả lập").

## 1. Quản lý — "một bức tranh, đúng số" (5 phút) — đăng nhập **Trần Quản Lý**

| Bấm | Nói gì |
|---|---|
| **Tổng quan** | Dashboard 30 ngày theo vai: REV-01…04 theo brand × thị trường, phễu nhu cầu mua, SLA ticket, cảnh báo. Mọi số tiền có mã chỉ số — không có "doanh thu" trần. |
| **Báo cáo → Tài chính**, đổi *Nhóm theo* = Tháng, *Tiền tệ báo cáo* = USD | Biểu đồ và bảng cùng số; dòng thông tin ghi tỷ giá đã dùng và ngày hiệu lực. Bảng "Theo nguyên tệ" đối chiếu được AED/SAR/KWD/USD với VND. Kéo xuống: COD theo hãng (CASH-01 đã thu, CASH-02 đã về, CASH-03 đang kẹt). |
| **Đơn hàng**, chọn *Mốc ngày* = Ngày giao, cùng kỳ | Thẻ REV-03 = đúng số của báo cáo tài chính — một định nghĩa, hai nơi khớp nhau. |
| Đổi team (góc trên) sang **Team EU** → **Đơn hàng**, tìm `#6031` | Một đơn kinh doanh có hai liên kết nguồn (Shopify + Pancake) — tính một lần trong khách, báo cáo, chỉ số. Đơn nghi trùng không tự gộp: **Cần xác minh**. |
| Về **Team PiAlpha** → **Khách hàng**, mở **Sophia Johnson** → tab Lịch sử gộp | Gộp hồ sơ có truy vết bằng chứng và tách lại được. |
| **Trợ lý AI** → hỏi "Doanh thu giao thành công theo thị trường" | Câu trả lời ghi kỳ, phạm vi, nguồn, độ mới; dữ kiện có bằng chứng. Tab Chi phí: mỗi lần chạy có token + chi phí. |
| **Hệ thống → Nhật ký**, lọc *Loại bản ghi* = Setting | Mọi thay đổi chỉ thêm, xem trước/sau với trường đổi được đánh dấu. **Cấu hình**: ngưỡng SLA, giới hạn liên hệ, giờ làm việc theo thị trường. |

## 2. Sales — "hôm nay tôi làm gì" (3 phút) — **Phạm Sales**

| Bấm | Nói gì |
|---|---|
| **Hàng đợi của tôi** | Việc cần làm + nhu cầu mua sắp quá hạn phản hồi, xếp theo hạn. |
| **Nhu cầu mua** (bảng kanban) | Chỉ thấy lead của mình + lead chưa giao của nhóm (quyền ở máy chủ). Kéo một thẻ sang "Đang tư vấn" — ghi nhật ký, hành động lặp không nhân đôi. |
| Mở một lead → **✦ Soạn phản hồi** (khung AI bên phải) | Bản nháp theo ngôn ngữ khách, cần người duyệt; không tự gửi. |
| Gõ `/van-don` trên thanh địa chỉ | 404 — Sales không có quyền vận đơn. |

## 3. Marketing — "đúng người, đúng lúc, không làm phiền" (3 phút) — **Đỗ Marketing**

| Bấm | Nói gì |
|---|---|
| **Phân khúc** → mở một phân khúc → Xem trước | Điều kiện theo trường cho phép; số khách tính ở máy chủ trên 200k khách vẫn < 1 giây (đo tải). |
| **Hành trình** → "Nhắc mua lại theo chu kỳ" | Sơ đồ bước kèm kết quả: khách dừng vì đã mua / từ chối / đang khiếu nại; bỏ qua vì vượt giới hạn liên hệ hoặc chưa đồng ý (DE, FR); tin ngoài giờ làm việc dời tới giờ bắt đầu. Mọi tin ở trạng thái **giả lập**. |
| **Báo cáo → Marketing** | Nguồn lead, chi phí trên lead (MKT-01/02). Không có số doanh thu — Marketing không có quyền xem tiền. |

## 4. Vận đơn — "đơn nào cần tôi" (2 phút) — **Vũ Vận Đơn**

| Bấm | Nói gì |
|---|---|
| **Vận đơn** → tab Cần can thiệp | Giao thất bại theo lý do chuẩn hóa; lý do thuộc khách mới tính vào rủi ro khách, lỗi hãng thì không. |
| Bấm **Xử lý** một đơn → Yêu cầu giao lại | Ghi yêu cầu vào hàng đợi gửi hãng (giả lập), đơn rời danh sách; nếu giao lại vẫn thất bại, đơn quay lại. |
| **Sản phẩm** | Tồn khả dụng theo thị trường đọc từ Mua hàng, cảnh báo tồn thấp; không thấy giá vốn (không có quyền xem tiền). |

## 5. Kế toán — "tiền COD đâu" (2 phút) — **Ngô Kế Toán**

| Bấm | Nói gì |
|---|---|
| **Vận đơn** → tab COD bốn mốc, kỳ tháng trước | Đã thu / đã về / đang kẹt theo hãng và theo tuổi; danh sách COD đã thu chưa về để nhắc hãng. Không có nút xử lý, không nhập được đối soát (vai chỉ xem). |
| Mở một đơn trong danh sách kẹt | Bốn mốc COD: đặt → giao → đã thu → chưa về. (Quản lý nhập bảng đối soát ở tab Đối soát bằng dán từ Excel — xem trước từng dòng rồi mới ghi.) |

## Câu hỏi thường gặp khi demo

- *"Số này lấy ở đâu?"* — rê chuột vào mã chỉ số (REV-03, CASH-02…) để xem định nghĩa; từ điển đầy đủ ở **Hệ thống → Từ điển chỉ số**.
- *"Có gửi tin cho khách thật không?"* — Không. `EXTERNAL_WRITES_ENABLED=false`; mọi tin nằm trong hàng đợi trạng thái giả lập.
- *"Lên thật cần gì?"* — `docs/deploy-checklist.md`: từng điểm cắm, biến môi trường, cách xác minh, bước lùi.

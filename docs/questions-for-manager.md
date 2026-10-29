# Câu hỏi cần chốt — CRM LevelUp

Mã Q-xx. Khi có trả lời, chuyển sang `docs/decisions.md` (mã D-xx) và ghi "đã trả lời" ở đây. Mỗi câu có mặc định tạm để demo không bị chặn.

## A. Phạm vi và người quyết

| Mã | Câu hỏi | Vì sao cần | Mặc định tạm |
|---|---|---|---|
| Q-01 | Ai nghiệm thu nghiệp vụ bản demo? | Lịch demo, kịch bản theo vai | **Đã trả lời 28/10 → D-30:** người dùng và giám đốc nghiệm thu |
| Q-02 | Đơn vị demo đầu tiên là gì? | Seed và tên workspace | **Đã trả lời 28/10 → D-29:** workspace là **team** (ví dụ team PiAlpha), không phải công ty con; công ty chính vẫn là LevelUp |
| Q-03 | Có cần Companies/Deals B2B (ABC, EurroGO) trong CRM này không? | HLD §3 nói không bắt buộc | **Đã trả lời 28/10 → D-31:** có thể; kiểm tính khả thi và mức cần thiết trước khi làm. Demo giữ B2C, chừa khung mở rộng |
## B. Dữ liệu và nguồn

| Mã | Câu hỏi | Vì sao cần | Mặc định tạm |
|---|---|---|---|
| Q-10 | Mỗi team đang bán qua nền tảng nào (Pancake POS, Shopify, website, sàn, khác), bao nhiêu shop, market từng shop? | Danh sách adapter cần làm thật, seed sát thật | D-18; Pancake và Shopify chỉ là hai adapter đầu, không giả định team nào dùng gì |
| Q-11 | Khách, đơn/ngày, lịch sử bao nhiêu tháng cần backfill | Hiệu năng, chi phí | 300 khách, 2.000 đơn/12 tháng |
| Q-12 | Quyền API Pancake hiện có: đơn, khách, hội thoại Inbox? Webhook đang phục vụ LevelUp — CRM chỉ polling? | HLD §1.2 | Polling, không Inbox |
| Q-13 | Shopify: app riêng hay custom app; quyền protected customer data đã xin chưa; đơn > 60 ngày? | HLD §5.1 | Chưa có |
| Q-14 | Có trường hợp **cùng một giao dịch xuất hiện ở hai nguồn** không (ví dụ đơn tạo ở nền tảng A rồi xử lý ở nền tảng B)? Nếu có, nền tảng nào giữ mã tham chiếu của nền tảng nào? | Quy tắc liên kết đơn D-06, D-28 — hiện chưa biết team nào có luồng này | Không giả định; quy tắc liên kết cấu hình theo cặp nền tảng (`linkRules`), demo có một cặp hư cấu để chứng minh cơ chế |
| Q-15 | Vận chuyển/COD: hãng nào, có API hay chỉ file đối soát? Mốc "đã thu", "đã về" lấy từ đâu? | Phase 10 CASH-01/02 | Fixture DeliveryEvent + Settlement |
| Q-16 | Dữ liệu giá vốn/tồn lấy từ Purchasing System hay nơi khác? | D-25 | Fixture |

## C. Nghiệp vụ

| Mã | Câu hỏi | Vì sao cần | Mặc định tạm |
|---|---|---|---|
| Q-20 | "Giao dịch hợp lệ" cho RFM/giá trị khách: REV-03 hay REV-04? Với prepaid có khác không? | D-M3 | REV-03 |
| Q-21 | Định nghĩa doanh thu ròng, lợi nhuận (chiết khấu, phí ship, hoàn, giá vốn) | HLD §7.3 | Ròng = REV-03 − hoàn; lợi nhuận chỉ khi có giá vốn |
| Q-22 | Quy tắc phân công lead: theo market, brand, team, ngôn ngữ, tải tối đa? | Phase 4 | Market + brand, vòng tròn, tối đa 30 lead mở/người — **đã cài theo mặc định (D-46), cấu hình ở `Setting.leadRouting`; chờ xác nhận số** |
| Q-23 | Hạn phản hồi lead mới và SLA ticket theo mức | Phase 4, 5 | Lead 4 giờ; ticket THẤP 48h/TRUNG 24h/CAO 8h/KHẨN 2h (ngày lịch) — **đã cài theo mặc định (D-46, D-50; phản hồi đầu 8h/4h/2h/30 phút do Claude đặt thêm), cấu hình ở `SlaPolicy`; chờ xác nhận số** |
| Q-24 | Giới hạn liên hệ (frequency cap): bao nhiêu tin/khách/tuần, theo kênh? | Phase 7 | 2 tin/7 ngày/kênh |
| Q-25 | Chu kỳ mua lại dùng chung hay theo danh mục sản phẩm? | CUS-02 | Theo khách, fallback trung bình brand |
| Q-26 | Khách "giá trị cao" ngưỡng bao nhiêu? | D-24 | ≥ 3 đơn REV-03/12 tháng |
| Q-27 | Lý do thất bại giao hàng nào tính là rủi ro khách (từ chối nhận) và lý do nào là lỗi vận chuyển? | R-72, Score rủi ro | Từ chối nhận/không liên lạc = khách; còn lại = vận chuyển |

## D. AI và BigQuery

| Mã | Câu hỏi | Vì sao cần | Mặc định tạm |
|---|---|---|---|
| Q-30 | Dataset BigQuery nào (PiAlpha dataset đang có KPI views?), ai cấp service account chỉ đọc | D-M2 | Postgres warehouse |
| Q-31 | Model và ngân sách AI/tháng khi lên thật | D-M7 | Replay |
| Q-32 | Tác vụ AI nào cần duyệt: tạo task, soạn tin, sửa hồ sơ? | Phase 8 Approval | Soạn tin gửi khách và sửa hồ sơ cần duyệt; tạo task không |
| Q-33 | Ngôn ngữ cần hỗ trợ thật | D-M6 | vi, en, ar, de |

## E. Triển khai (sau demo)

| Mã | Câu hỏi | Vì sao cần | Mặc định tạm |
|---|---|---|---|
| Q-40 | Máy chủ, vùng, tên miền; ai vận hành | Phase 12 | Chưa |
| Q-41 | Google Workspace domain cho SSO (`GOOGLE_HD`) | Phase 12 | levelupvn.com (chưa xác nhận) |
| Q-42 | Chính sách lưu/xóa dữ liệu khách theo thị trường (EU) | HLD §10.2 | Xuất/xóa theo yêu cầu, ghi audit |
| Q-43 | Mục tiêu độ trễ đồng bộ, thời gian đáp ứng, RPO/RTO, vùng triển khai và phạm vi lưu/chuyển dữ liệu xuyên quốc gia | HLD §10.2, §15 | Chưa đặt; demo chạy cục bộ |

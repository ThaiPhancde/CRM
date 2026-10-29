# Yêu cầu CRM LevelUp — ma trận truy vết

Cập nhật: 28/10/2026 (Phase 0). Nguồn: **HLD** = `CRM_Global_AI_HLD_Open_Source.md` (cột ghi mục §); **QĐ** = `docs/decisions.md` (D-xx); **TK** = `Thiet_ke_CRM_va_prompt_Claude.md`.

Trạng thái: **XĐ** xác định trong HLD · **CHỐT** người dùng chốt · **MĐ** mặc định của Claude · **MỞ** chờ trả lời. Cột Demo: ✓ trong demo · ◐ khung/giả lập · — làm khi lên thật.

## 1. Tóm tắt

- **Mục tiêu (HLD §1):** nên chăm sóc ai, lúc nào, bằng cách nào, kết quả có tạo giá trị không.
- **Nguồn dữ liệu (HLD §1.1, §5; D-28):** nền tảng bán bất kỳ qua adapter đăng ký — Pancake POS, Shopify là hai adapter đầu; website, sàn, vận chuyển, inbox thêm sau. Không giả định team nào dùng nền tảng nào. Demo dùng replay.
- **Người dùng (D-29):** công ty LevelUp, nhiều team (workspace, ví dụ PiAlpha) và brand; MKT, Sales/CSKH, Mua hàng, Vận đơn, Quản lý; quản trị công ty.
- **Người nghiệm thu (D-30):** người dùng và giám đốc.

## 2. Ma trận

### Nền tảng, quyền, danh mục

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-01 | Nhiều workspace tách hoàn toàn; quản trị công ty chuyển workspace (= team, D-29) | HLD §2, §6.1; D-03 | MĐ | 1 | ✓ |
| R-02 | Brand, Store (nền tảng), Market là danh mục; không đồng nhất shop/quốc gia/workspace | HLD §6.2; D-04 | XĐ | 1 | ✓ |
| R-03 | Vai trò và quyền `module.action`; kiểm ở server cho UI, API, tìm kiếm, báo cáo, AI | HLD §2; D-21 | XĐ | 1, 8, 9 | ✓ |
| R-04 | Đăng nhập thử theo vai; Google OIDC khung | D-14 | MĐ | 1 | ◐ |
| R-05 | Audit log chỉ thêm; idempotency cho hành động lặp | HLD §4, §14.2; D-16 | XĐ | 1 | ✓ |
| R-06 | Tỷ giá, tiền tệ báo cáo USD, loại thanh toán theo market | HLD §6.2; D-09 | XĐ | 1 | ✓ |

### Kết nối dữ liệu và đơn chuẩn

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-10 | Connector khai báo khả năng; xác thực, backfill có checkpoint, gia tăng, lỗi, replay | HLD §5.1 | XĐ — **đã có Phase 2** (replay; live báo 501 rõ ràng) | 2 | ◐ replay |
| R-11 | Khung adapter chung (registry theo mã platform); hai adapter đầu: Pancake (polling gia tăng), Shopify (GraphQL + webhook + đối chiếu); thêm nền tảng không sửa nghiệp vụ | HLD §5.1; D-28 | XĐ | 2, 12 | ◐ |
| R-12 | Chống trùng bản ghi nguồn theo (workspace, connection, loại, mã nguồn) | HLD §4 | XĐ | 2 | ✓ |
| R-13 | Một đơn kinh doanh, nhiều liên kết nguồn (bất kỳ cặp nền tảng, `linkRules` cấu hình); không gộp vì trùng tiền/SĐT; hàng đợi xác minh | HLD §5.2; D-06, D-28 | XĐ | 2 | ✓ |
| R-14 | Tách trạng thái đơn/thanh toán/giao/hoàn; giữ trạng thái gốc; một phần | HLD §4; D-07 | XĐ | 2 | ✓ |
| R-15 | Cập nhật đến muộn không lùi trạng thái | HLD §14.2 | XĐ | 2 | ✓ |
| R-16 | Nguồn chính theo trường dữ liệu, cấu hình theo luồng | HLD §5.3; D-32 | XĐ | 2 | ✓ |
| R-17 | Sản phẩm/biến thể chung, ánh xạ mã nguồn | HLD §4 | XĐ | 2, 10 | ✓ |
| R-18 | Ghi ngược tắt mặc định; chỉ bật từng đối tượng sau xác minh | HLD §1.2; D-13 | XĐ | 12 | — |

### Customer 360

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-20 | Hồ sơ hợp nhất nhiều mã nguồn; gộp bằng bằng chứng; lịch sử gộp; tách lại | HLD §6.1; D-08, D-41 | XĐ — **đã có Phase 3** (R-20…R-25; địa chỉ demo chỉ có quốc gia vì nguồn phát lại chưa có địa chỉ chi tiết) | 3 | ✓ |
| R-21 | Chuẩn hóa SĐT E.164, đánh giá email; không dùng tên/IP | HLD §6.1 | XĐ | 3 | ✓ |
| R-22 | Địa chỉ giữ bản gốc + chuẩn hóa; tách nơi giao/thanh toán | HLD §6.2 | XĐ | 3 | ✓ |
| R-23 | Quyền liên hệ theo kênh, mục đích, brand, lịch sử | HLD §6.2 | XĐ | 3, 7 | ✓ |
| R-24 | Trang 360: tóm tắt, đơn, tương tác, điểm, timeline; che PII theo quyền | HLD §3 | XĐ | 3 | ✓ |
| R-25 | Không chia sẻ hồ sơ giữa workspace/brand mặc định | HLD §6.1 | XĐ | 3 | ✓ |

### Nhu cầu mua, sales, dịch vụ

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-30 | Lead/nhu cầu mua: sản phẩm quan tâm, tiến độ, lý do chưa mua, hành động tiếp | HLD §3 | XĐ — **đã có Phase 4** (R-30…R-32; sản phẩm quan tâm là văn bản, Phase 10 gắn SKU) | 4 | ✓ |
| R-31 | Hàng đợi, phân công theo năng lực/market, chuyển phụ trách có lịch sử | HLD §3, §11; D-45, D-46 | XĐ — phân công theo brand + market + tải (chưa theo ngôn ngữ/năng lực cá nhân) | 4 | ✓ |
| R-32 | Activity, Task, lịch hẹn, kịch bản | HLD §3; D-47 | XĐ — lịch hẹn = việc loại Hẹn gặp + hẹn liên hệ lại | 4 | ✓ |
| R-33 | Ticket, loại sự cố, mức, SLA, thời hạn | HLD §3, §11; D-50 | XĐ — **đã có Phase 5** (SLA giờ lịch; chưa tạm dừng khi chờ khách) | 5 | ✓ |
| R-34 | Tri thức theo brand/market/ngôn ngữ, có phiên bản | HLD §3; D-50 | XĐ — **đã có Phase 5** | 5 | ✓ |
| R-35 | Khách giá trị cao gặp sự cố được ưu tiên | HLD §7.4; D-24, D-50 | MĐ — cờ VIP + xếp trước trong hàng đợi | 5 | ✓ |

### Chỉ số, điểm, insight

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-40 | Từ điển chỉ số: REV-01…04, OPS, CASH, CUS; mọi báo cáo ghi mã | D-10; `levelup-company-os/06` | MĐ — **đã có Phase 6** (bảng MetricDefinition + trang Từ điển chỉ số) | 6 | ✓ |
| R-41 | Bộ chỉ số nhiều chiều (phù hợp, ý định, tương tác, giá trị, mua lại, rủi ro, hỗ trợ, tin cậy) | HLD §7.1 | XĐ | 6 | ✓ |
| R-42 | Điểm ưu tiên sales 25/35/25/15; lưu lý do, phiên bản, thiếu dữ liệu, hành động | HLD §7.2; D-11; D-33; D-52 | XĐ — **đã có Phase 6** | 6 | ✓ |
| R-43 | RFM; COD phân tích riêng giao thành công/đã thu/đã đối soát | HLD §7.3; D-52 | XĐ — RFM có; COD đã thu/đối soát chờ Phase 10 | 6 | ◐ |
| R-44 | Phân biệt giá trị đã tạo với dự báo; dự báo kiểm thử theo thời gian | HLD §7.3 | XĐ | 6 (khung), 12 | ◐ |
| R-45 | Insight → hành động (giao sales, task, ưu tiên ticket, cảnh báo nguồn/sản phẩm) | HLD §7.4 | XĐ | 6, 7 | ✓ |
| R-46 | Warehouse interface; Postgres demo, BigQuery thật; không trên đường bắt buộc hằng ngày | HLD §2, §9; D-05 | XĐ — **đã có Phase 6** (Postgres chạy thật; BigQuery khung 501, SQL sinh chung) | 6 | ◐ |

### Điều phối chăm sóc và marketing

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-50 | Phân khúc động; chiến dịch; nguồn khách/touchpoint | HLD §3 | XĐ | 7 | ✓ |
| R-51 | Journey: điều kiện vào/ra, giới hạn liên hệ xuyên chiến dịch, dừng khi mua/từ chối/khiếu nại | HLD §8.5, §14.2 | XĐ | 7 | ✓ |
| R-52 | Gửi tin ghi Outbox SIMULATED; không gửi thật | D-13 | MĐ | 7 | ✓ |
| R-53 | Đo tác động riêng với dự báo (nhóm đối chứng) | HLD §7.3 | XĐ | 7 (khung Experiment) | ◐ |

### AI

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-60 | Sáu chức năng AI đầu tiên | HLD §14.1 | XĐ | 8 | ✓ replay |
| R-61 | Ba bề mặt: trợ lý chung, AI trong màn, tác vụ nền | HLD §8.3 | XĐ | 8 | ✓ |
| R-62 | Luồng tác vụ: hiểu → xác định → kiểm quyền → trạng thái mới → chuẩn bị → duyệt → API → audit | HLD §8.4 | XĐ | 8 | ✓ |
| R-63 | Không đoán SKU/đơn mơ hồ; nội dung khách là dữ liệu; tool tối thiểu; bằng chứng | HLD §8.4 | XĐ | 8 | ✓ |
| R-64 | Chi phí theo workspace/tính năng/model/run; ngân sách | HLD §8.6 | XĐ | 8 | ✓ |
| R-65 | Lọc bí mật/PII ngoài quyền trước khi gửi model | HLD §8.4 | XĐ | 8 | ✓ |

### Báo cáo, vận đơn, sản phẩm, quản trị

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-70 | Sáu nhóm báo cáo; mỗi báo cáo hiện phạm vi, tiền tệ, kỳ, độ mới, định nghĩa | HLD §9.2 | XĐ | 9 | ✓ |
| R-71 | Dashboard theo vai; đa tiền tệ đối chiếu được | HLD §14.2 | XĐ | 9 | ✓ |
| R-72 | Vận đơn: đơn cần can thiệp, lý do thất bại, COD 4 mốc, đối soát | HLD §3; `levelup-company-os/01` §3.3 | XĐ | 10 | ✓ |
| R-73 | Sản phẩm/mua hàng: giá vốn, tồn qua tích hợp chỉ đọc | HLD §3; D-25 | MĐ | 10 | ◐ fixture |
| R-74 | Quản trị: thành viên, vai trò, cấu hình, audit viewer, sao lưu, vòng đời dữ liệu | HLD §3 | XĐ | 1, 11 | ✓ |
| R-75 | UI trắng – cam, 4 trạng thái, không chồng lớp, AA | D-15 | CHỐT | 1, 11 | ✓ |
| R-76 | Kịch bản demo + E2E + handoff điểm cắm thật | TK §10 Phase 11 | MĐ | 11 | ✓ |

### Lên thật (ngoài demo)

| Mã | Yêu cầu | Nguồn | Trạng thái | Phase | Demo |
|---|---|---|---|---|---|
| R-80 | Khóa Pancake/Shopify, webhook HMAC, đối chiếu song song | HLD §5 | XĐ | 12 | — |
| R-81 | BigQuery dataset công ty, refreshMetrics, đối chiếu Postgres | HLD §9 | XĐ | 12 | — |
| R-82 | Anthropic LLM có ngân sách; đánh giá chất lượng | HLD §8.6 | XĐ | 12 | — |
| R-83 | SSO Google, SMTP, deploy, sao lưu lịch | HLD §10.2 | XĐ | 12 | — |
| R-84 | Chốt độ trễ đồng bộ, thời gian đáp ứng, RPO/RTO, vùng triển khai, lưu/chuyển dữ liệu xuyên quốc gia | HLD §10.2, §15; Q-43 | CHƯA CHỐT | 12 | — |

## 3. Kiểm tra nghiệm thu Phase 0

- [x] Bộ tài liệu vai trò có trong `docs/` theo `AGENTS.md`.
- [ ] Người dùng duyệt mặc định D-01…D-26.
- [ ] Người dùng trả lời hoặc giữ mặc định tạm cho D-M1…D-M8.

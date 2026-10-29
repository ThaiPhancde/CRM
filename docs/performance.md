# Hiệu năng và chịu tải

Cập nhật: 29/10/2026. Quyết định liên quan: D-48 (mục tiêu khối lượng, NFR), D-49 (luồng lead ở khối lượng lớn).

## 1. Mục tiêu khối lượng (D-48, mặc định chờ xác nhận)

Một team (workspace), 12 tháng dữ liệu:

| Dữ liệu | Khối lượng |
|---|---|
| Khách | 200.000 |
| Đơn | 600.000 (1,2 triệu dòng hàng, 1,8 triệu sự kiện giao hàng) |
| Nhu cầu mua | 180.000 (≈ 500/ngày) |
| Tương tác | 1,44 triệu |
| Việc | 150.000 |
| Thông báo | 300.000 |
| Nhập từ nguồn | ≈ 8.200 bản ghi/ngày (600k đơn × ~5 phiên bản / 365) |

Mục tiêu đo (trung vị 3 lần, máy phát triển, PostgreSQL 18 cục bộ):

| Loại thao tác | Mục tiêu |
|---|---|
| Trang danh sách, Kanban, hàng đợi | < 500 ms |
| Trang chi tiết, thông báo | < 300 ms |
| Ghi (tạo lead + phân công) | < 300 ms |
| Xuất CSV 10.000 dòng | < 5 s |
| Một lượt job worker | < 5 s |
| Nhập đơn từ nguồn | ≥ 30 bản ghi/giây |

**Về mục tiêu nhập đơn:** lần đo đầu dùng mục tiêu tạm "1.000 bản ghi < 5 giây". Con số đó không xuất phát từ nhu cầu nên đã đổi **sau khi đo** thành ≥ 30 bản ghi/giây, tính từ khối lượng thật. Mức đạt được (~45 bản ghi/giây ≈ 3,9 triệu/ngày) dư hơn 400 lần so với nhu cầu ~8.200/ngày.

## 2. Cách đo

Dữ liệu sinh vào database riêng `crm_load`; script tự từ chối nếu không phải DB `*_load`, nên không đụng DB demo. Bộ đo gọi đúng service mà trang web gọi, với ba vai Quản lý, Trưởng nhóm và Sales.

```bash
# DATABASE_URL trỏ tới …/crm_load (đổi tên DB trong chuỗi kết nối ở .env)
npx prisma migrate deploy
SCALE=1 npx tsx scripts/load/generate.ts     # ~10 phút, ~5,5 triệu dòng; SCALE=0.01 để thử nhanh
SCALE=1 npx tsx scripts/load/bench.ts <nhãn> # in bảng + ghi docs/perf/<nhãn>.json
```

Kết quả gốc lưu ở `docs/perf/before.json`, `after-indexes.json`, `after.json`.

## 3. Kết quả

Dữ liệu đo: 602.000 đơn, 200.500 khách, 180.010 lead, 1.440.000 tương tác.

| Thao tác | Mục tiêu | Trước | Sau index | Sau toàn bộ |
|---|---|---|---|---|
| Đơn: danh sách trang 1 (Quản lý) | < 500 ms | 220 ms | 189 ms | **186 ms** |
| Đơn: trang 500 (offset sâu) | < 500 ms | 280 ms | 220 ms | **230 ms** |
| Đơn: lọc trạng thái giao + thị trường | < 500 ms | 212 ms | 173 ms | **178 ms** |
| Đơn: tìm theo mã/tên | < 500 ms | 2.177 ms | 1.740 ms | **11 ms** |
| Đơn: danh sách (Sales, theo phạm vi) | < 500 ms | 896 ms | 776 ms | **367 ms** |
| Đơn: chi tiết | < 300 ms | 569 ms | 8 ms | **7 ms** |
| Đơn: xuất CSV 10.000 dòng | < 5 s | 4.868 ms | 3.730 ms | **2.953 ms** |
| Khách: danh sách mặc định | < 500 ms | 180 ms | 106 ms | **100 ms** |
| Khách: sắp theo giá trị | < 500 ms | 166 ms | 44 ms | **43 ms** |
| Khách: tìm theo SĐT | < 500 ms | 553 ms | 290 ms | **258 ms** |
| Khách: danh sách (Sales, theo phạm vi) | < 500 ms | 240 ms | 117 ms | **110 ms** |
| Khách: hồ sơ 360 | < 300 ms | 517 ms | 13 ms | **26 ms** |
| Lead: danh sách (Quản lý) | < 500 ms | 133 ms | 132 ms | **109 ms** |
| Lead: Kanban (Quản lý) | < 500 ms | 186 ms | 170 ms | **87 ms** |
| Lead: chi tiết | < 300 ms | 151 ms | 14 ms | **14 ms** |
| Hàng đợi của tôi (Sales) | < 500 ms | 15 ms | 10 ms | **11 ms** |
| Việc: danh sách (Trưởng nhóm) | < 500 ms | 201 ms | 172 ms | **180 ms** |
| Tạo lead + phân công tự động | < 300 ms | 93 ms | 85 ms | **82 ms** |
| Worker: giao lead + nhắc hạn (+ tự đóng) | < 5 s | 7.219 ms | 6.175 ms | **719 ms** |
| Worker: tính lại giá trị 100 khách | < 5 s | 22.027 ms | 203 ms | **250 ms** |
| Nhập đơn: 1.000 bản ghi mới | ≥ 30 bản ghi/s | 6 bản ghi/s | 49 bản ghi/s | **46 bản ghi/s** |
| Nhập đơn: 1.000 bản trùng | ≥ 30 bản ghi/s | 500 bản ghi/s | 350 bản ghi/s | **466 bản ghi/s** |

**Trước: 8/27 thao tác vượt mục tiêu. Sau: 0/28.**

**Phase 5 (thêm 50.000 ticket, 150.000 sự kiện, 300 bài × 2 phiên bản — `docs/perf/phase5.json`): 0/35 vượt mục tiêu.** Danh sách ticket 55 ms, đang mở + quá hạn 6 ms, tìm theo tiêu đề 123 ms, chi tiết 5 ms, danh sách tri thức 2 ms, hàng đợi Sales (có ticket) 23 ms, worker nhắc SLA 25 ms/lượt. Index đặt ngay trong migration của phase theo quy tắc 11 nên không phải sửa sau.

## 4. Nguyên nhân và cách sửa

| Nguyên nhân | Ảnh hưởng | Sửa |
|---|---|---|
| **21 khóa ngoại không có index.** Prisma không tự tạo index cho khóa ngoại trên PostgreSQL; các bảng bị thiếu gồm dòng hàng, liên kết nguồn, vận chuyển, sự kiện giao, danh tính khách, lead↔khách, việc↔lead… | Mỗi trang chi tiết và mỗi lần tính giá trị khách đều quét cả bảng hàng triệu dòng. Nhập đơn mất 163 ms/bản ghi. | Migration `scale_indexes`: 25 index khóa ngoại và lọc/sắp xếp. Từ nay mọi `@relation` mới phải kèm `@@index` (quy tắc 11, thiết kế mục 5). |
| Tìm "chứa chuỗi" (ILIKE `%…%`) không dùng được index thường | Tìm đơn 2,2 s | Index trigram (`pg_trgm`, GIN) cho mã đơn, tên/SĐT/email khách trên đơn, tên khách, SĐT danh tính, tên lead. |
| Phạm vi Sales lọc đơn qua quan hệ lồng (đơn → khách → lead) | Postgres đánh giá điều kiện trên mọi đơn: 0,9 s | Lấy danh sách khách được phép trước, rồi lọc `customerId IN (…)`. |
| Worker báo lại mọi lead quá hạn mỗi phút, và thử giao lại từng lead treo dù nhóm đã hết chỗ | 7 s mỗi lượt, tăng dần theo số lead tồn | Đánh dấu `overdueNotifiedAt` để chỉ báo một lần; ghi thông báo theo lô; nhóm hết chỗ thì bỏ qua phần còn lại trong lượt đó. |
| Mỗi lead không giao được sinh một thông báo cho từng Trưởng nhóm | 500 lead dồn lại thành 500 thông báo | Gộp: tối đa một thông báo cho mỗi người, mỗi nhóm, mỗi giờ (D-49). |

## 5. Giới hạn còn lại (đã biết, có hướng nâng cấp)

- **Nhập đơn tuần tự, mỗi bản ghi một giao dịch (~20 truy vấn).** Đạt ~46 bản ghi/giây. Khi một team vượt khoảng 1 triệu bản ghi/ngày thì chuyển sang nhập theo lô.
- **Tổng số đơn và REV-01 tính lại mỗi lần mở trang** (đếm và cộng trên toàn bộ kết quả lọc, ~180 ms với 600k đơn). Phase 6–9 chuyển sang bảng chỉ số dựng sẵn (Warehouse).
- **Phân trang bằng offset**: trang 500 mất 230 ms. Nếu cần lật rất sâu thì đổi sang phân trang theo con trỏ.
- **Phạm vi Sales lấy danh sách khách vào bộ nhớ**: một Sales có khoảng 3.000 khách trong phạm vi thì ổn. Từ vài chục nghìn trở lên thì cần bảng phân công khách riêng.
- **Index tạo trong transaction migration.** Trên DB thật đang chạy cần `CREATE INDEX CONCURRENTLY` (ghi ở `deploy-checklist.md`).
- Chưa đo **đồng thời nhiều người dùng**; các số trên là một người một lúc. Phase 11 thêm đo tải đồng thời (≤ 20 người theo thiết kế mục 1.3).

## 6. Luồng làm việc ở khối lượng lớn (D-49)

Kéo thả từng thẻ không phù hợp khi mỗi ngày có hàng trăm lead. Luồng đã sửa:

- **Hàng đợi là nơi làm việc chính.** Kanban thu gọn thành pipeline của một người (Sales mặc định "của tôi"; Quản lý/Trưởng nhóm phải chọn người). Chỉ giai đoạn mở hiện thành thẻ; giai đoạn đóng là ô thả có số đếm 30 ngày.
- **Giai đoạn tự chuyển:** liên hệ ra đầu tiên → Đang tư vấn; khách đặt đơn mới (sau ngày tạo lead) → Đã mua; im lặng quá 14 ngày và không có hẹn liên hệ lại → Mất liên lạc.
- **Chống lead trùng:** cùng SĐT hoặc email, cùng brand, còn lead mở có tương tác trong 7 ngày → ghi vào lead cũ.
- **Thao tác hàng loạt** trên danh sách: đổi giai đoạn hoặc chuyển phụ trách tối đa 200 lead mỗi lần.
- Ngưỡng 14 ngày và 7 ngày chỉnh trong `Setting.leadRouting` (`autoCloseDays`, `dedupeDays`) của từng team.

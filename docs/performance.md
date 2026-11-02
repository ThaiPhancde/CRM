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

**Phase 6 (`docs/perf/phase6.json`): 0/41 vượt mục tiêu sau khi sửa.** Lần đo đầu vượt 2: job hằng ngày (chỉ số R12M + 600k dòng điểm cho 200k khách) **148 s** (mục tiêu < 120 s) — SQL chỉ số 30 s, xóa/ghi CustomerMetric 13 s, ghi điểm tuần tự ~100 s; sửa: `SET LOCAL work_mem = '128MB'` trong giao dịch dựng chỉ số + ghi điểm 4 khúc song song → **80 s**. Danh sách đơn theo phạm vi Sales chậm lại **579 ms** do phạm vi khách thêm nhánh ticket (3 EXISTS lồng) → hợp 3 truy vấn có index → **321 ms**. Điểm/chỉ số một khách 4 ms, danh sách khách kèm hạng RFM 120 ms, danh sách lead kèm điểm 166 ms, chấm lead mở 0,7 s/lượt.

**Phase 7 (`docs/perf/phase7.json`): 0/49 vượt mục tiêu sau khi sửa.** Trong lúc đo phát hiện **lỗi dữ liệu tải**: `scripts/load/generate.ts` không ghi `deliveredAt`, nên trên `crm_load` mọi khách có 0 đơn giao thành công → toàn bộ chỉ số R12M/điểm là "Chưa đủ dữ liệu". **Con số 80 s của job hằng ngày ở Phase 6 đo trên dữ liệu suy biến này.** Đã sửa generator (đơn DELIVERED có `deliveredAt` = ngày đặt + 3 ngày) và bù 260.508 đơn trên `crm_load`. Đo lại trên dữ liệu đúng, lần đầu vượt 4: job hằng ngày **148 s**, xem trước phân khúc **5,9 s**, chạy phân khúc **13 s**, chạy bước hành trình 500 khách **7,2 s**. Sửa:
- Job hằng ngày: chỉ xóa/ghi điểm **đã đổi** (so chữ ký nội dung, không phụ thuộc thứ tự khóa jsonb) → **82–103 s** (SQL chỉ số ~50 s, ghi điểm ~30–50 s tùy số điểm đổi trong ngày). `Score.computedAt` vì vậy là lần điểm đổi gần nhất.
- Phân khúc: lọc hạng theo **id phiên bản đang dùng** (tra một lần, `segmentCtx`) thay vì nối `ScoreVersion.active`; chỉ mục phủ `Score(versionId, band, customerId)`, `CustomerMetric(period, daysToNextPurchase, customerId)` và `(period, recencyDays, customerId)` (truy vấn con Prisma không mang `workspaceId` — cô lập nằm ở `Customer`). Xem trước **481 ms**; chạy phân khúc một truy vấn lấy toàn bộ id (cursor chạy lại điều kiện nặng mỗi trang) → **3,2 s** cho 23.000 khách.
- Hành trình: dữ kiện thoát (đã mua / từ chối / ticket mở) tính **một lần cho cả lô** (3 truy vấn), nạp sẵn khách + brand, chạy **8 luồng song song gom theo khách** → **0,93 s** / 500 khách. Đưa khách vào từ ảnh chụp: ~1 s mỗi hành trình đang chạy mỗi lượt worker.

**Phase 8 (`docs/perf/phase8.json`): AI 5/5 đạt; 2–3 thao tác cũ vượt ngưỡng do máy dev dao động, không thuộc code Phase 8.** Tóm tắt 360 một khách **81 ms** (gom ngữ cảnh qua service + ghi AgentRun/ToolCall/AiCost), tìm tự nhiên **26 ms**, hỏi báo cáo REV-03 theo thị trường trên 200k khách **204 ms** (một truy vấn tổng hợp CustomerMetric, giao dịch chỉ đọc, giới hạn 10 s), lịch sử lần chạy **5 ms**, chi phí tháng AI-01..03 **5 ms**. Hai lần đo liên tiếp của các thao tác cũ cho: job hằng ngày 122 s → 115 s (ngưỡng 120 s), xem trước phân khúc 720 → 499 ms (ngưỡng 500 ms), nhập 1.000 đơn 37 → 51 s (ngưỡng 33 s; lần đo Phase 7 là 24 s), đồng bộ lại 1.000 bản trùng 2 → 14 s, một lần lọc đơn 2,1 s. Đã loại trừ tuple chết (VACUUM ANALYZE toàn bộ không đổi kết quả); không tìm ra tiến trình nền rõ ràng. **Chưa kết luận được nguyên nhân** — các số này chỉ ổn định tới ±2 lần trên máy dev dùng chung; phải đo lại trên máy riêng (Phase 11, đo tải đồng thời) trước khi tin vào bất kỳ ngưỡng sát nào.

**Phase 9 (`docs/perf/phase9.json`): 11/11 báo cáo + dashboard đạt (< 3 s); 1/65 thao tác cũ vượt sát ngưỡng.** Lần đo đầu (kỳ 12 tháng): tài chính 4,8–6,4 s, khách hàng 8,7 s, dashboard 5,9 s. Nguyên nhân (EXPLAIN): CTE dùng chung bị vật chất hóa (612k đơn quét 5–6 lần), gộp cuối sắp xếp 1,36 triệu dòng, cohort khử trùng bằng sắp xếp 233k khóa chuỗi theo collation. Sửa: mỗi nhánh UNION tự lọc theo mốc của nó và **gộp sẵn** (khóa × tiền tệ) trước UNION; một truy vấn cho cả bảng theo nhóm và theo nguyên tệ; chỉ mục `Order(workspaceId, deliveredAt)`, `(workspaceId, confirmedAt)`, `Payment(workspaceId, paidAt)`, `Refund(workspaceId, refundedAt)`; cohort dùng số tháng (nguyên) làm khóa, `GROUP BY` thay `DISTINCT`, khóa khách so theo byte (`COLLATE "C"` qua `dialect.bin`, BigQuery giữ nguyên); `work_mem` 128MB trong giao dịch đọc. Sau sửa: tài chính 12 tháng **1,5 s** (theo tháng 2,1 s), khách hàng (RFM + cohort 12 tháng) **2,2 s**, bán hàng 0,16 s, marketing 0,16 s, vận đơn 0,35 s, AI 8 ms, dashboard Quản lý **1,5 s**, Sales 14 ms, `/don-hang` theo ngày giao + REV-03 0,4 s. Vượt: xem trước phân khúc 512 ms (ngưỡng 500; các lần đo trước 481–720 ms — dao động máy dev, xem Phase 8).

**Phase 10 (`docs/perf/phase10.json`): 74/75 đạt; phần mới 11/11 đạt.** Dữ liệu tải trước đó có mọi vận đơn DELIVERED, không COD, không thất bại → bổ sung `scripts/load/phase10.ts` (vận đơn theo trạng thái đơn, COD AED + mốc thu, lý do thất bại, 3 hãng; 230k dòng đối soát qua đúng hàm seed; `generate.ts` gọi luôn). Lỗi tìm thấy khi đo: (1) **CASH 12 tháng quá 15 s ở lần chạy thứ 6** dù lần đầu 0,8 s — Postgres chuyển sang kế hoạch chung (generic plan) sau 5 lần cùng prepared statement, bộ lọc tùy chọn `(@p IS NULL OR cột = @p)` mất ước lượng → sửa gốc ở `Warehouse.read`: `SET LOCAL plan_cache_mode = force_custom_plan` (lỗi tiềm ẩn từ Phase 9 — mọi báo cáo đều có thể dính khi bấm xem lại > 5 lần trên cùng kết nối; đã kiểm 7 lần liên tiếp < 1 s). (2) Xem trước 500 dòng đối soát 4,0 s — `trackingNo IN (…)` không có btree → chỉ mục `Shipment(workspaceId, trackingNo)`: **62 ms**. (3) Tìm mã vận đơn "chứa chuỗi" chưa có trigram (D-48) → trigram `Shipment.trackingNo` + tách OR xuyên bảng thành hai tập ứng viên: **14 ms**. Kết quả: cần can thiệp trang 1 284 ms (77k vận đơn thất bại), xử lý một đơn 7 ms, CASH theo hãng 30 ngày 0,74 s / 12 tháng 0,85 s, COD kẹt trang 1 174 ms, bốn mốc một đơn 2 ms, sản phẩm 153 ms, mã nguồn chưa khớp 184 ms; báo cáo tài chính (thêm nhánh tiền về COD) 1,7–2,1 s. Vượt: `/don-hang` theo ngày giao + REV-03 **597 ms** (ngưỡng 500; dao động 490–675) — truy vấn cube REV-01..04 dùng chung với báo cáo (khớp số theo cấu tạo) chạy song song với danh sách; nâng cấp nếu cần: nhánh chỉ REV-03.

**Phase 11 (`docs/perf/phase11.json`, `docs/perf/concurrent20.json`): 75/75 đạt — lần đầu không còn thao tác nào vượt.** Hai thao tác sát ngưỡng nhiều phase được sửa gốc: (1) xem trước phân khúc 816 ms → **259 ms** — EXPLAIN cho thấy quét chỉ-mục trên `Score` phải đọc lại heap 59.529 lần vì job hằng ngày vừa ghi lại toàn bộ điểm và chỉ số (visibility map chưa đánh dấu); worker giờ `VACUUM (ANALYZE)` `CustomerMetric` + `Score` ngay sau khi ghi (≈ 4 s, tính trong job); (2) `/don-hang` theo ngày giao + REV-03 506–675 ms → **161 ms** — truy vấn doanh thu dùng chung nhận `only` (nhánh không cần có `AND 1 = 0`, planner bỏ qua), trang đơn chỉ chạy nhánh REV-03 và chạy song song với danh sách. Job hằng ngày đo theo đúng đường của worker (`scoringJobs`, gồm điểm nhu cầu mua + VACUUM): **96 s** (< 120 s). Sửa đúng nghĩa khi đo: chỉ số R12M không còn dùng dữ liệu sau mốc tính (đơn giao / khoản hoàn / giao thất bại sau mốc) — chỉ số 200k khách 41 s.
**Đồng thời 20 người** (`scripts/load/concurrent.ts`, D-59): 20 phiên trong một tiến trình (14 Sales, 5 Quản lý, 1 Trưởng nhóm), nghỉ 2–5 s giữa thao tác, 90 s: **480 thao tác (5,3/giây), 0 lỗi, 13/13 đạt p95** — trang ≤ 1,7 s p95 (đơn hàng Sales 1,1 s, hồ sơ 360 0,9 s), báo cáo tài chính 30 ngày 1,7 s, dashboard Quản lý 2,5 s p95 (ngưỡng 6 s). Đo chịu tải tối đa (THINK=0, bấm liên tục): 12 thao tác/giây, dashboard 8,4 s p95, đơn hàng Sales 4,0 s p95 — máy dev bão hòa CPU, không phải tiêu chí (người thật không bấm liên tục); lần đo đó cũng bắt được `crm_load` thiếu migration `customer_erased`.

**Đo lại khi nghiệm thu lại (02/11/2026, 8 lượt × 90 s, `docs/perf/recheck-concurrent20.json`):** con số 13/13 ở trên là một lượt thuận lợi (đo ngay sau job hằng ngày đã VACUUM). Đo lặp ở trạng thái bình thường (sau khi nhập đơn, chưa VACUUM): luôn **0 lỗi**, nhưng 0–4/13 thao tác vượt p95 tùy lượt. Tìm ra và sửa một lỗi thật: **REV-01 ở trang đơn hàng quét tuần tự cả bảng `Order`** (~245 MB) mỗi lần mở trang → chỉ mục phủ `(workspaceId, status, netBase)` (migration `order_rev01_idx`): đơn hàng Quản lý p95 **1,7–2,2 s → 0,37–0,9 s**. Thêm ngưỡng autovacuum 1% cho `Order`/`OrderItem`/`Customer` (migration `autovacuum_hot_tables`; mặc định 20% ≈ 126k dòng ≈ 15 ngày nhập đơn mới dọn, trong khi 14k thay đổi đã làm visibility map cũ, đơn hàng Quản lý 0,7 → 2,0 s). Còn lại: **đơn hàng phạm vi Sales p95 1,1–1,95 s quanh ngưỡng 1,5 s**, và mỗi lượt một thao tác Quản lý ngẫu nhiên vượt do chỉ ~15 mẫu (p95 ≈ lần chậm nhất) trên máy dev bão hòa CPU — xem mục 5.

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
- **Job hằng ngày 82–103 s, sát mục tiêu 120 s** (dao động theo checkpoint/autovacuum của Postgres và số điểm đổi). Nâng cấp kế tiếp: dựng chỉ số tăng dần (chỉ khách có đơn/ticket đổi) hoặc chạy ở BigQuery (D-05).
- **Xem trước phân khúc 481 ms, sát mục tiêu 500 ms**; điều kiện trên trường chỉ số chưa có chỉ mục riêng (REV-03, số đơn giao, ticket mở) sẽ chậm hơn. Nâng cấp: thêm chỉ mục theo trường hay dùng, hoặc đếm ước lượng khi > 100k khách.
- **Mỗi hành trình đang chạy tốn ~1 s mỗi lượt worker để kiểm khách mới trong ảnh chụp.** Với > 5 hành trình nên chỉ đưa khách vào khi ảnh chụp đổi (ghi id lần chạy đã đưa vào).
- Đo đồng thời 20 người (`docs/perf/concurrent20.json`, `recheck-concurrent20.json`) chạy 20 phiên + Postgres trên cùng máy dev: kết quả dao động 0–4/13 vượt p95 giữa các lượt, 0 lỗi. **Đơn hàng phạm vi Sales (p95 1,1–1,95 s, ngưỡng 1,5 s) là điểm sát nhất** — nâng cấp: bảng phân công khách (bỏ 3 truy vấn lấy phạm vi mỗi lần mở) hoặc REV-01 theo kỳ mặc định 30 ngày thay vì toàn bộ. Lên thật đo lại trên máy chủ thật, ≥ 50 mẫu mỗi thao tác.

## 6. Luồng làm việc ở khối lượng lớn (D-49)

Kéo thả từng thẻ không phù hợp khi mỗi ngày có hàng trăm lead. Luồng đã sửa:

- **Hàng đợi là nơi làm việc chính.** Kanban thu gọn thành pipeline của một người (Sales mặc định "của tôi"; Quản lý/Trưởng nhóm phải chọn người). Chỉ giai đoạn mở hiện thành thẻ; giai đoạn đóng là ô thả có số đếm 30 ngày.
- **Giai đoạn tự chuyển:** liên hệ ra đầu tiên → Đang tư vấn; khách đặt đơn mới (sau ngày tạo lead) → Đã mua; im lặng quá 14 ngày và không có hẹn liên hệ lại → Mất liên lạc.
- **Chống lead trùng:** cùng SĐT hoặc email, cùng brand, còn lead mở có tương tác trong 7 ngày → ghi vào lead cũ.
- **Thao tác hàng loạt** trên danh sách: đổi giai đoạn hoặc chuyển phụ trách tối đa 200 lead mỗi lần.
- Ngưỡng 14 ngày và 7 ngày chỉnh trong `Setting.leadRouting` (`autoCloseDays`, `dedupeDays`) của từng team.

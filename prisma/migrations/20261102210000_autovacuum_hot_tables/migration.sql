-- Bảng lớn ghi liên tục (nhập đơn ~8.200/ngày): mặc định autovacuum chờ 20% bảng đổi (~126k dòng Order) mới dọn, giữa hai lần
-- visibility map cũ làm index-only scan phải đọc heap — đo trên crm_load: 14k thay đổi → trang đơn hàng p95 691 → 2.034 ms.
-- Hạ ngưỡng xuống 1% (+ ngưỡng theo lượt chèn) để autovacuum chạy khoảng mỗi ngày. Chỉ là tham số bảng, không khóa dữ liệu.
ALTER TABLE "Order" SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01);
ALTER TABLE "OrderItem" SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01);
ALTER TABLE "Customer" SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01);

-- REV-01 ở trang đơn hàng (Σ netBase của đơn chưa hủy, mặc định toàn bộ kỳ) quét tuần tự cả bảng Order (~245 MB với 630k đơn) mỗi lần mở trang.
-- Chỉ mục phủ (workspaceId, status, netBase) → index-only scan, đọc ít hơn ~5 lần; 20 người đồng thời: đơn hàng Quản lý p95 1.704 → 406 ms.
CREATE INDEX "Order_workspaceId_status_netBase_idx" ON "Order"("workspaceId", "status", "netBase");

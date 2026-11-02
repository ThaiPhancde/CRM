-- So bằng theo mã vận đơn (đối soát dán bảng: trackingNo IN (...)) — trigram không phục vụ phép bằng tốt.
CREATE INDEX "Shipment_workspaceId_trackingNo_idx" ON "Shipment"("workspaceId", "trackingNo");

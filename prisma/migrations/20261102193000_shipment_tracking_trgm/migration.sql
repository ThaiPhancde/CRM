-- Tìm mã vận đơn "chứa chuỗi" ở /van-don (D-48: tìm chứa chuỗi phải có trigram).
CREATE INDEX "Shipment_trackingNo_trgm_idx" ON "Shipment" USING GIN ("trackingNo" gin_trgm_ops);

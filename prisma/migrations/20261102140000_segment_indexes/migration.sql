-- Phân khúc (D-48): lọc theo hạng của phiên bản đang dùng và theo chu kỳ mua / độ gần bằng chỉ mục phủ (truy vấn con không có workspaceId — cô lập nằm ở Customer).
CREATE INDEX "Score_versionId_band_customerId_idx" ON "Score"("versionId", "band", "customerId");
CREATE INDEX "CustomerMetric_period_daysToNextPurchase_customerId_idx" ON "CustomerMetric"("period", "daysToNextPurchase", "customerId");
CREATE INDEX "CustomerMetric_period_recencyDays_customerId_idx" ON "CustomerMetric"("period", "recencyDays", "customerId");

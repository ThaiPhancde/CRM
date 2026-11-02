-- Một lần thất bại chỉ xử lý một lần (D-58).
DROP INDEX "DeliveryAction_orderId_failedAt_idx";
CREATE UNIQUE INDEX "DeliveryAction_orderId_failedAt_key" ON "DeliveryAction"("orderId", "failedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_deliveredAt_idx" ON "Order"("workspaceId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_confirmedAt_idx" ON "Order"("workspaceId", "confirmedAt");

-- CreateIndex
CREATE INDEX "Payment_workspaceId_paidAt_idx" ON "Payment"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "Refund_workspaceId_refundedAt_idx" ON "Refund"("workspaceId", "refundedAt");


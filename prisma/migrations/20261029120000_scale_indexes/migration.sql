-- D-48: chịu tải dữ liệu lớn. Tìm kiếm "chứa chuỗi" (ILIKE) cần trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE INDEX "Assignment_leadId_idx" ON "Assignment"("leadId");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_marketId_idx" ON "Customer"("workspaceId", "marketId");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_valueBase12m_idx" ON "Customer"("workspaceId", "valueBase12m");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_orderCount_idx" ON "Customer"("workspaceId", "orderCount");

-- CreateIndex
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_shipmentId_idx" ON "DeliveryEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "Lead_customerId_idx" ON "Lead"("customerId");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_contactPhoneE164_idx" ON "Lead"("workspaceId", "contactPhoneE164");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_stage_lastActivityAt_idx" ON "Lead"("workspaceId", "stage", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Membership_teamId_idx" ON "Membership"("teamId");

-- CreateIndex
CREATE INDEX "Order_workspaceId_storeId_bookedAt_idx" ON "Order"("workspaceId", "storeId", "bookedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_marketId_bookedAt_idx" ON "Order"("workspaceId", "marketId", "bookedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_workspaceId_variantId_idx" ON "OrderItem"("workspaceId", "variantId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "SourceOrderLink_orderId_idx" ON "SourceOrderLink"("orderId");

-- CreateIndex
CREATE INDEX "SourceProductMapping_variantId_idx" ON "SourceProductMapping"("variantId");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_customerId_idx" ON "Task"("customerId");

-- CreateIndex
CREATE INDEX "Task_orderId_idx" ON "Task"("orderId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_status_remindedAt_dueAt_idx" ON "Task"("workspaceId", "status", "remindedAt", "dueAt");

-- CreateIndex
CREATE INDEX "Variant_productId_idx" ON "Variant"("productId");


-- D-49: mốc tương tác gần nhất cho lead đã có (bỏ qua dòng hệ thống).
UPDATE "Lead" l SET "lastActivityAt" = GREATEST(l."createdAt", COALESCE((SELECT MAX(a."occurredAt") FROM "Activity" a WHERE a."leadId" = l."id" AND a."type" <> 'SYSTEM'), l."createdAt"));
CREATE INDEX "Customer_displayName_trgm_idx" ON "Customer" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "CustomerIdentity_phoneE164_trgm_idx" ON "CustomerIdentity" USING GIN ("phoneE164" gin_trgm_ops);
CREATE INDEX "Lead_contactName_trgm_idx" ON "Lead" USING GIN ("contactName" gin_trgm_ops);
CREATE INDEX "Order_orderNumber_trgm_idx" ON "Order" USING GIN ("orderNumber" gin_trgm_ops);
CREATE INDEX "Order_customerName_trgm_idx" ON "Order" USING GIN ("customerName" gin_trgm_ops);
CREATE INDEX "Order_customerPhone_trgm_idx" ON "Order" USING GIN ("customerPhone" gin_trgm_ops);

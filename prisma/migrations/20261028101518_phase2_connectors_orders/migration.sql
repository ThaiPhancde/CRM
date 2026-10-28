-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('BACKFILL', 'INCREMENTAL', 'REPLAY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'OK', 'FAILED');

-- CreateEnum
CREATE TYPE "EventOutcome" AS ENUM ('APPLIED', 'LINKED', 'STALE', 'DUPLICATE', 'ERROR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'COD_PENDING', 'COD_COLLECTED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'IN_TRANSIT', 'PARTIAL', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "DeliveryEventType" AS ENUM ('PICKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'COD_COLLECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'LINKED', 'REJECTED');

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'replay',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "configEncrypted" TEXT,
    "pollIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "syncLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mode" "SyncMode" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "applied" INTEGER NOT NULL DEFAULT 0,
    "linked" INTEGER NOT NULL DEFAULT 0,
    "stale" INTEGER NOT NULL DEFAULT 0,
    "duplicate" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCheckpoint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "cursorAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "eventKey" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "outcome" "EventOutcome" NOT NULL,
    "error" TEXT,
    "payload" JSONB NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameAr" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "costPrice" DECIMAL(18,4),
    "costCurrency" TEXT,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceProductMapping" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sourceSku" TEXT NOT NULL,

    CONSTRAINT "SourceProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "marketId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL,
    "returnStatus" "ReturnStatus" NOT NULL DEFAULT 'NONE',
    "currency" TEXT NOT NULL,
    "grossAmount" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL,
    "shippingFee" DECIMAL(18,4) NOT NULL,
    "netAmount" DECIMAL(18,4) NOT NULL,
    "refundedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fxRate" DECIMAL(18,8) NOT NULL,
    "fxDate" DATE NOT NULL,
    "netUsd" DECIMAL(18,4) NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerSourceId" TEXT,
    "shipCountry" TEXT,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT,
    "sourceSku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "qtyDelivered" INTEGER NOT NULL DEFAULT 0,
    "qtyReturned" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineAmount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceOrderLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "orderNumberNorm" TEXT NOT NULL,
    "refs" TEXT[],
    "sourceStatusRaw" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceOrderLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLinkReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderAId" TEXT NOT NULL,
    "orderBId" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLinkReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "mergedId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "mergedById" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmergedAt" TIMESTAMP(3),
    "unmergedById" TEXT,

    CONSTRAINT "MergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNo" TEXT,
    "status" "FulfillmentStatus" NOT NULL,
    "failureReason" TEXT,
    "codAmount" DECIMAL(18,4),
    "deliveredAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "DeliveryEventType" NOT NULL,
    "reasonCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_workspaceId_key_key" ON "Setting"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_workspaceId_storeId_key" ON "Connection"("workspaceId", "storeId");

-- CreateIndex
CREATE INDEX "SyncRun_workspaceId_connectionId_startedAt_idx" ON "SyncRun"("workspaceId", "connectionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCheckpoint_workspaceId_connectionId_recordType_key" ON "SyncCheckpoint"("workspaceId", "connectionId", "recordType");

-- CreateIndex
CREATE INDEX "SourceEvent_workspaceId_outcome_idx" ON "SourceEvent"("workspaceId", "outcome");

-- CreateIndex
CREATE INDEX "SourceEvent_workspaceId_orderId_idx" ON "SourceEvent"("workspaceId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEvent_workspaceId_connectionId_eventKey_key" ON "SourceEvent"("workspaceId", "connectionId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_workspaceId_code_key" ON "Product"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_workspaceId_sku_key" ON "Variant"("workspaceId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "SourceProductMapping_workspaceId_connectionId_sourceSku_key" ON "SourceProductMapping"("workspaceId", "connectionId", "sourceSku");

-- CreateIndex
CREATE INDEX "Order_workspaceId_bookedAt_idx" ON "Order"("workspaceId", "bookedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_customerPhone_idx" ON "Order"("workspaceId", "customerPhone");

-- CreateIndex
CREATE INDEX "SourceOrderLink_workspaceId_platform_orderNumberNorm_idx" ON "SourceOrderLink"("workspaceId", "platform", "orderNumberNorm");

-- CreateIndex
CREATE UNIQUE INDEX "SourceOrderLink_workspaceId_connectionId_sourceRecordId_key" ON "SourceOrderLink"("workspaceId", "connectionId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLinkReview_workspaceId_orderAId_orderBId_key" ON "OrderLinkReview"("workspaceId", "orderAId", "orderBId");

-- CreateIndex
CREATE INDEX "MergeLog_workspaceId_entity_survivorId_idx" ON "MergeLog"("workspaceId", "entity", "survivorId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvent" ADD CONSTRAINT "SourceEvent_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceProductMapping" ADD CONSTRAINT "SourceProductMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceOrderLink" ADD CONSTRAINT "SourceOrderLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceOrderLink" ADD CONSTRAINT "SourceOrderLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

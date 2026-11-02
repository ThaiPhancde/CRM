-- CreateEnum
CREATE TYPE "DeliveryActionKind" AS ENUM ('REATTEMPT', 'CANCEL', 'TICKET');

-- AlterTable
ALTER TABLE "DeliveryEvent" ADD COLUMN     "reasonRaw" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "failedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNo" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "codAmount" DECIMAL(18,4),
    "remittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "DeliveryActionKind" NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL,
    "reasonCode" TEXT,
    "note" TEXT,
    "ticketId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Settlement_workspaceId_createdAt_idx" ON "Settlement"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_workspaceId_carrier_reference_key" ON "Settlement"("workspaceId", "carrier", "reference");

-- CreateIndex
CREATE INDEX "SettlementLine_settlementId_idx" ON "SettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "SettlementLine_orderId_idx" ON "SettlementLine"("orderId");

-- CreateIndex
CREATE INDEX "SettlementLine_workspaceId_remittedAt_idx" ON "SettlementLine"("workspaceId", "remittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementLine_workspaceId_orderId_trackingNo_key" ON "SettlementLine"("workspaceId", "orderId", "trackingNo");

-- CreateIndex
CREATE INDEX "DeliveryAction_orderId_failedAt_idx" ON "DeliveryAction"("orderId", "failedAt");

-- CreateIndex
CREATE INDEX "DeliveryAction_workspaceId_createdAt_idx" ON "DeliveryAction"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAction_workspaceId_idempotencyKey_key" ON "DeliveryAction"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Shipment_workspaceId_status_failedAt_idx" ON "Shipment"("workspaceId", "status", "failedAt");

-- CreateIndex
CREATE INDEX "Shipment_workspaceId_collectedAt_idx" ON "Shipment"("workspaceId", "collectedAt");

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAction" ADD CONSTRAINT "DeliveryAction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Điền failedAt cho vận đơn đã có (sau này ingest tự dựng lại).
UPDATE "Shipment" s SET "failedAt" = e.at
FROM (SELECT "shipmentId", MAX("occurredAt") AS at FROM "DeliveryEvent" WHERE "type" = 'FAILED' GROUP BY 1) e
WHERE e."shipmentId" = s."id";

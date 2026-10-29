-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER');

-- CreateEnum
CREATE TYPE "ContactPurpose" AS ENUM ('MARKETING', 'SERVICE');

-- CreateEnum
CREATE TYPE "AddressKind" AS ENUM ('SHIPPING', 'BILLING');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "primaryPhoneE164" TEXT,
    "primaryEmail" TEXT,
    "locale" TEXT,
    "marketId" TEXT,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "tags" TEXT[],
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "connectionId" TEXT,
    "sourceCustomerId" TEXT,
    "phoneE164" TEXT,
    "emailNormalized" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "AddressKind" NOT NULL,
    "raw" JSONB NOT NULL,
    "normalized" JSONB,
    "countryCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPreference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "purpose" "ContactPurpose" NOT NULL,
    "brandId" TEXT,
    "optIn" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerAId" TEXT NOT NULL,
    "customerBId" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_workspaceId_primaryPhoneE164_idx" ON "Customer"("workspaceId", "primaryPhoneE164");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_lastOrderAt_idx" ON "Customer"("workspaceId", "lastOrderAt");

-- CreateIndex
CREATE INDEX "CustomerIdentity_workspaceId_phoneE164_idx" ON "CustomerIdentity"("workspaceId", "phoneE164");

-- CreateIndex
CREATE INDEX "CustomerIdentity_workspaceId_emailNormalized_idx" ON "CustomerIdentity"("workspaceId", "emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_workspaceId_connectionId_sourceCustomerId_key" ON "CustomerIdentity"("workspaceId", "connectionId", "sourceCustomerId");

-- CreateIndex
CREATE INDEX "ContactPreference_workspaceId_customerId_channel_purpose_idx" ON "ContactPreference"("workspaceId", "customerId", "channel", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReview_workspaceId_customerAId_customerBId_key" ON "CustomerReview"("workspaceId", "customerAId", "customerBId");

-- CreateIndex
CREATE INDEX "Order_workspaceId_customerId_idx" ON "Order"("workspaceId", "customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPreference" ADD CONSTRAINT "ContactPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

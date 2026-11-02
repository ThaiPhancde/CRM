-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "JourneyRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'EXITED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'ENDED');

-- AlterTable
ALTER TABLE "CustomerMetric" ADD COLUMN     "daysToNextPurchase" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastCount" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "ms" INTEGER NOT NULL,
    "ranById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "SegmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segmentId" TEXT NOT NULL,
    "brandId" TEXT,
    "steps" JSONB NOT NULL,
    "exitRules" JSONB NOT NULL,
    "reentryDays" INTEGER NOT NULL DEFAULT 30,
    "status" "JourneyStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "status" "JourneyRunStatus" NOT NULL DEFAULT 'RUNNING',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "exitReason" TEXT,

    CONSTRAINT "JourneyRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyStepLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCap" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "brandId" TEXT,
    "maxCount" INTEGER NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactCap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "brandId" TEXT,
    "source" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT,
    "segmentId" TEXT,
    "journeyId" TEXT,
    "channel" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "cost" DECIMAL(18,4),
    "costCurrency" TEXT,
    "costBase" DECIMAL(18,4),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Touchpoint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "cost" DECIMAL(18,4),
    "costCurrency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Touchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Segment_workspaceId_active_idx" ON "Segment"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "SegmentRun_segmentId_createdAt_idx" ON "SegmentRun"("segmentId", "createdAt");

-- CreateIndex
CREATE INDEX "SegmentMember_customerId_idx" ON "SegmentMember"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentMember_runId_customerId_key" ON "SegmentMember"("runId", "customerId");

-- CreateIndex
CREATE INDEX "Journey_workspaceId_status_idx" ON "Journey"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Journey_segmentId_idx" ON "Journey"("segmentId");

-- CreateIndex
CREATE INDEX "JourneyRun_customerId_idx" ON "JourneyRun"("customerId");

-- CreateIndex
CREATE INDEX "JourneyRun_workspaceId_status_nextAt_idx" ON "JourneyRun"("workspaceId", "status", "nextAt");

-- CreateIndex
CREATE INDEX "JourneyRun_journeyId_status_idx" ON "JourneyRun"("journeyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyRun_journeyId_customerId_entryKey_key" ON "JourneyRun"("journeyId", "customerId", "entryKey");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyStepLog_runId_stepIndex_key" ON "JourneyStepLog"("runId", "stepIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCap_workspaceId_channel_brandId_key" ON "ContactCap"("workspaceId", "channel", "brandId");

-- CreateIndex
CREATE INDEX "ContactLog_workspaceId_customerId_channel_createdAt_idx" ON "ContactLog"("workspaceId", "customerId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "Campaign_segmentId_idx" ON "Campaign"("segmentId");

-- CreateIndex
CREATE INDEX "Campaign_journeyId_idx" ON "Campaign"("journeyId");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_status_idx" ON "Campaign"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_workspaceId_utmCampaign_key" ON "Campaign"("workspaceId", "utmCampaign");

-- CreateIndex
CREATE INDEX "Touchpoint_customerId_idx" ON "Touchpoint"("customerId");

-- CreateIndex
CREATE INDEX "Touchpoint_leadId_idx" ON "Touchpoint"("leadId");

-- CreateIndex
CREATE INDEX "Touchpoint_campaignId_idx" ON "Touchpoint"("campaignId");

-- CreateIndex
CREATE INDEX "Touchpoint_workspaceId_occurredAt_idx" ON "Touchpoint"("workspaceId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Touchpoint_workspaceId_idempotencyKey_key" ON "Touchpoint"("workspaceId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "CustomerMetric" ADD CONSTRAINT "CustomerMetric_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentRun" ADD CONSTRAINT "SegmentRun_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SegmentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyRun" ADD CONSTRAINT "JourneyRun_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyRun" ADD CONSTRAINT "JourneyRun_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStepLog" ADD CONSTRAINT "JourneyStepLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JourneyRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;


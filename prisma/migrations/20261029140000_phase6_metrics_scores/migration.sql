-- CreateEnum
CREATE TYPE "ScoreType" AS ENUM ('SALES_PRIORITY', 'RFM', 'TXN_RISK', 'SUPPORT_NEED');

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "code" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "timeAnchor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "pitfalls" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CustomerMetric" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "orders" INTEGER NOT NULL,
    "deliveredOrders" INTEGER NOT NULL,
    "failedByCustomer" INTEGER NOT NULL,
    "confirmedOrders" INTEGER NOT NULL,
    "rev01" DECIMAL(18,4) NOT NULL,
    "rev02" DECIMAL(18,4) NOT NULL,
    "rev03" DECIMAL(18,4) NOT NULL,
    "rev04" DECIMAL(18,4) NOT NULL,
    "refunds" DECIMAL(18,4) NOT NULL,
    "grossProfit" DECIMAL(18,4),
    "firstOrderAt" TIMESTAMP(3),
    "lastValidOrderAt" TIMESTAMP(3),
    "recencyDays" INTEGER,
    "avgCycleDays" DOUBLE PRECISION,
    "repurchase60" BOOLEAN NOT NULL DEFAULT false,
    "rScore" INTEGER,
    "fScore" INTEGER,
    "mScore" INTEGER,
    "openTickets" INTEGER NOT NULL DEFAULT 0,
    "maxOpenPriority" INTEGER NOT NULL DEFAULT 0,
    "oldestOpenTicketAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ScoreType" NOT NULL,
    "version" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ScoreType" NOT NULL,
    "versionId" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "value" INTEGER,
    "band" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "missingData" TEXT[],
    "suggestedAction" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerMetric_customerId_idx" ON "CustomerMetric"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMetric_workspaceId_period_asOf_idx" ON "CustomerMetric"("workspaceId", "period", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMetric_workspaceId_customerId_period_key" ON "CustomerMetric"("workspaceId", "customerId", "period");

-- CreateIndex
CREATE INDEX "ScoreVersion_workspaceId_type_active_idx" ON "ScoreVersion"("workspaceId", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreVersion_workspaceId_type_version_key" ON "ScoreVersion"("workspaceId", "type", "version");

-- CreateIndex
CREATE INDEX "Score_customerId_idx" ON "Score"("customerId");

-- CreateIndex
CREATE INDEX "Score_leadId_idx" ON "Score"("leadId");

-- CreateIndex
CREATE INDEX "Score_workspaceId_type_band_idx" ON "Score"("workspaceId", "type", "band");

-- CreateIndex
CREATE UNIQUE INDEX "Score_versionId_customerId_key" ON "Score"("versionId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_versionId_leadId_key" ON "Score"("versionId", "leadId");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScoreVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


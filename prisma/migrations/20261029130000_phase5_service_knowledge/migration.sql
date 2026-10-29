-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('GIAO_CHAM', 'LOI_HANG', 'DOI_TRA', 'BAO_HANH', 'KHAC');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('THAP', 'TRUNG', 'CAO', 'KHAN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('MOI', 'DANG_XU_LY', 'CHO_KHACH', 'DA_GIAI_QUYET', 'DONG');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('CREATED', 'NOTE', 'REPLY', 'STATUS', 'ASSIGN', 'PRIORITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "ticketId" TEXT;

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "priority" "TicketPriority" NOT NULL,
    "firstResponseHours" DOUBLE PRECISION NOT NULL,
    "resolveHours" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'MOI',
    "subject" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "brandId" TEXT,
    "teamId" TEXT,
    "ownerId" TEXT,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "firstResponseDueAt" TIMESTAMP(3) NOT NULL,
    "resolveDueAt" TIMESTAMP(3) NOT NULL,
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "dueSoonNotifiedAt" TIMESTAMP(3),
    "breachNotifiedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "body" TEXT,
    "actorId" TEXT,
    "meta" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "marketId" TEXT,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER,
    "tags" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_workspaceId_brandId_priority_key" ON "SlaPolicy"("workspaceId", "brandId", "priority");

-- CreateIndex
CREATE INDEX "Ticket_customerId_idx" ON "Ticket"("customerId");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_ownerId_status_idx" ON "Ticket"("workspaceId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_teamId_status_idx" ON "Ticket"("workspaceId", "teamId", "status");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_status_resolveDueAt_idx" ON "Ticket"("workspaceId", "status", "resolveDueAt");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_createdAt_idx" ON "Ticket"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_subject_trgm_idx" ON "Ticket" USING GIN ("subject" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_workspaceId_code_key" ON "Ticket"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_workspaceId_idempotencyKey_key" ON "Ticket"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketEvent_workspaceId_idempotencyKey_key" ON "TicketEvent"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_status_language_idx" ON "KnowledgeArticle"("workspaceId", "status", "language");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_brandId_idx" ON "KnowledgeArticle"("workspaceId", "brandId");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_title_trgm_idx" ON "KnowledgeArticle" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_articleId_version_key" ON "KnowledgeVersion"("articleId", "version");

-- CreateIndex
CREATE INDEX "Task_ticketId_idx" ON "Task"("ticketId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


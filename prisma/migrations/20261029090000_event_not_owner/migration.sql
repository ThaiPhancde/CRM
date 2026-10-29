-- Quy tắc 3 (thiết kế mục 5, D-32): bản ghi mới hơn từ nguồn không làm chủ nhóm trường nào của đơn → NOT_OWNER, không ghi đè.
ALTER TYPE "EventOutcome" ADD VALUE 'NOT_OWNER';
ALTER TABLE "SyncRun" ADD COLUMN "notOwner" INTEGER NOT NULL DEFAULT 0;

-- Xóa dữ liệu cá nhân theo yêu cầu (Phase 11.1).
ALTER TABLE "Customer" ADD COLUMN "erasedAt" TIMESTAMP(3);

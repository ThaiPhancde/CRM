-- D-44: tiền quy đổi chung đổi từ USD sang VND. Đổi tên cột (giữ dữ liệu) và quy đổi dữ liệu cũ theo 1 USD = 26.300 VND
-- (tỷ giá demo, giữ đúng tỷ lệ giữa các đồng tiền như trước). Không xóa dòng nào.

ALTER TABLE "FxRate" RENAME COLUMN "rateToUsd" TO "rateToBase";
UPDATE "FxRate" SET "rateToBase" = "rateToBase" * 26300;
INSERT INTO "FxRate" ("id", "workspaceId", "currency", "rateToBase", "validFrom", "createdAt")
SELECT 'fx_vnd_' || w."id", w."id", 'VND', 1, DATE '2025-01-01', NOW() FROM "Workspace" w
ON CONFLICT DO NOTHING;

ALTER TABLE "Order" RENAME COLUMN "netUsd" TO "netBase";
UPDATE "Order" SET "netBase" = "netBase" * 26300, "fxRate" = "fxRate" * 26300;

ALTER TABLE "Customer" RENAME COLUMN "valueUsd12m" TO "valueBase12m";
UPDATE "Customer" SET "valueBase12m" = "valueBase12m" * 26300;

-- Lý do nghi trùng đơn đã lưu dạng JSON: đổi khóa và đơn vị.
UPDATE "OrderLinkReview"
SET "reasons" = ("reasons" - 'amountDiffUsd') || jsonb_build_object('amountDiffBase', ((("reasons"->>'amountDiffUsd')::numeric) * 26300)::text)
WHERE "reasons" ? 'amountDiffUsd';

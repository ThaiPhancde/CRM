-- CreateIndex
CREATE INDEX "Order_customerEmail_trgm_idx" ON "Order" USING GIN ("customerEmail" gin_trgm_ops);


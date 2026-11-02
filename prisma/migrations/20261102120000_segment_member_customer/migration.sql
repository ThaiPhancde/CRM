-- SegmentMember → Customer: đưa khách vào hành trình từ ảnh chụp phân khúc bằng truy vấn có index (D-55).
ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

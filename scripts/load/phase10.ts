// Bổ sung dữ liệu vận đơn Phase 10 cho DB tải (D-48): vận đơn theo trạng thái giao của đơn, COD (AED) có mốc đã thu, thất bại có lý do +
// failedAt, ba hãng — rồi dựng bảng đối soát bằng đúng hàm seed demo. Trước bản này mọi vận đơn tải là DELIVERED không COD → đo suy biến.
// Chạy: DATABASE_URL=<…/crm_load> npx tsx scripts/load/phase10.ts   (generate.ts cũng gọi hàm này sau khi tạo vận đơn)
import { PrismaClient } from "@prisma/client";

export async function backfillPhase10(db: PrismaClient, workspaceId: string) {
  // Lý do + hãng chọn tất định theo id vận đơn (hashtext), cùng phân bố gần với dữ liệu demo.
  return db.$executeRaw`
    UPDATE "Shipment" s SET
      "status" = o."fulfillmentStatus",
      "deliveredAt" = o."deliveredAt",
      "codAmount" = o."netAmount",
      "collectedAt" = CASE WHEN o."deliveredAt" IS NOT NULL THEN o."deliveredAt" + interval '2 hours' END,
      "failedAt" = CASE WHEN o."fulfillmentStatus" IN ('FAILED', 'RETURNED') THEN o."bookedAt" + interval '2 days' END,
      "failureReason" = CASE WHEN o."fulfillmentStatus" IN ('FAILED', 'RETURNED')
        THEN (ARRAY['customer_refused','unreachable','wrong_address','carrier_delay','carrier_delay','damaged'])[1 + abs(hashtext(s."id")) % 6] END,
      "carrier" = (ARRAY['Aramex','SMSA','Fetchr'])[1 + abs(hashtext(s."orderId")) % 3]
    FROM "Order" o
    WHERE o."id" = s."orderId" AND s."workspaceId" = ${workspaceId}`;
}

if (process.argv[1]?.endsWith("phase10.ts")) {
  const url = process.env.DATABASE_URL ?? "";
  if (!/\/[a-z0-9_]+_load(\?|$)/i.test(url)) throw new Error("Chỉ chạy trên DB *_load");
  const db = new PrismaClient();
  (async () => {
    for (const w of await db.workspace.findMany({ where: { code: { startsWith: "LOAD-" } } })) {
      const t = Date.now();
      console.log(w.code, "vận đơn:", await backfillPhase10(db, w.id), `(${Math.round((Date.now() - t) / 1000)}s)`);
    }
    const { seedFulfillment } = await import("../seed-fulfillment");
    const t = Date.now();
    console.log("đối soát:", await seedFulfillment(new Date("2026-10-29T03:00:00Z")), `(${Math.round((Date.now() - t) / 1000)}s)`);
    for (const t of ["Shipment", "SettlementLine", "Settlement"]) await db.$executeRawUnsafe(`ANALYZE "${t}"`);
  })().finally(() => db.$disconnect());
}

// Dữ liệu demo Phase 10 (D-18, D-58): bảng đối soát COD theo hãng × tuần cho COD đã thu quá 14 ngày (mốc remitted).
// Tất định theo mã vận đơn: ~6% vận đơn cố ý để "kẹt" (thấy CASH-03 theo tuổi), ~25% bị hãng trừ phí 1,5% (thấy chênh lệch).
// Chạy lại không tạo trùng (unique đơn + mã vận đơn). Ghi thẳng như dữ liệu nguồn — thao tác người dùng đi qua applySettlement.
// Chạy riêng: npx tsx --env-file=.env scripts/seed-fulfillment.ts
import { Prisma } from "@prisma/client";
import { rootDb, workspaceDb } from "../src/lib/db";

const DAY = 86_400_000;
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
/** Thứ Năm của tuần chứa (collectedAt + 7 ngày) — ngày hãng chuyển tiền; mã bảng theo tuần ISO. */
function week(at: Date) {
  const d = new Date(at.getTime() + 7 * DAY);
  const day = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round((thu.getTime() - jan4.getTime()) / DAY / 7 - 3 / 7 + ((jan4.getUTCDay() + 6) % 7) / 7);
  return { remittedAt: thu, ref: `${thu.getUTCFullYear()}-W${String(w).padStart(2, "0")}` };
}

export async function seedFulfillment(now = new Date(), chunk = 5000) {
  const out = { settlements: 0, lines: 0, stuck: 0 };
  const cutoff = new Date(now.getTime() - 14 * DAY);
  for (const w of await rootDb.workspace.findMany({ where: { active: true } })) {
    const c = workspaceDb(w.id);
    let cursor: string | undefined;
    for (;;) {
      const ships = await c.shipment.findMany({
        where: { codAmount: { not: null }, collectedAt: { not: null, lte: cutoff }, trackingNo: { not: null }, carrier: { not: null } },
        select: { id: true, orderId: true, trackingNo: true, carrier: true, codAmount: true, collectedAt: true, order: { select: { currency: true } } },
        orderBy: { id: "asc" }, take: chunk, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!ships.length) break;
      cursor = ships.at(-1)!.id;
      const groups = new Map<string, { carrier: string; ref: string; lines: Prisma.SettlementLineCreateManyInput[] }>();
      for (const s of ships) {
        const h = hash(s.trackingNo! + s.orderId);
        if (h % 100 < 6) { out.stuck++; continue; }
        const { remittedAt, ref } = week(s.collectedAt!);
        if (remittedAt > now) continue;
        const reference = `${s.carrier!.slice(0, 3).toUpperCase()}-${ref}`;
        const amount = h % 4 === 0 ? s.codAmount!.mul("0.985").toDecimalPlaces(2) : s.codAmount!;
        const key = `${s.carrier}|${reference}`;
        const g = groups.get(key) ?? { carrier: s.carrier!, ref: reference, lines: [] };
        g.lines.push({ settlementId: "", orderId: s.orderId, trackingNo: s.trackingNo!, amount, currency: s.order.currency, codAmount: s.codAmount, remittedAt } as Prisma.SettlementLineCreateManyInput);
        groups.set(key, g);
      }
      for (const g of groups.values()) {
        const st = await c.settlement.upsert({
          where: { workspaceId_carrier_reference: { workspaceId: w.id, carrier: g.carrier, reference: g.ref } },
          create: { carrier: g.carrier, reference: g.ref } as Prisma.SettlementUncheckedCreateInput, update: {},
        });
        const r = await c.settlementLine.createMany({ data: g.lines.map((l) => ({ ...l, settlementId: st.id })), skipDuplicates: true });
        out.lines += r.count;
      }
      if (ships.length < chunk) break;
    }
    out.settlements += await c.settlement.count();
  }
  return out;
}

if (process.argv[1]?.endsWith("seed-fulfillment.ts")) {
  seedFulfillment().then((r) => console.log("đối soát COD:", r)).finally(() => rootDb.$disconnect());
}

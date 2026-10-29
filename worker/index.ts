// Worker nền (tiến trình riêng): đồng bộ các kết nối đến hạn. Các job Phase sau (chấm điểm, journey, nhắc việc) thêm vào đây.
// Chạy: npm run worker          (lặp mỗi WORKER_INTERVAL_MIN phút, mặc định 5)
//       npm run worker -- --once (một lượt; có lỗi thì thoát mã 1)
// Mỗi kết nối chạy trong try/catch riêng: lỗi một kết nối không chặn kết nối khác; lượt sau thử lại.
import { rootDb, workspaceDb } from "../src/lib/db";
import { runSync } from "../src/modules/connectors/service";
import { refreshCustomerStats } from "../src/modules/customers/resolve";

const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ at: new Date().toISOString(), ...o }));

export async function syncDue(now = new Date()) {
  const conns = await rootDb.connection.findMany({ where: { status: { in: ["ACTIVE", "ERROR"] }, store: { active: true } }, include: { store: true } });
  const failed: string[] = [];
  for (const c of conns) {
    const due = !c.lastSyncAt || c.lastSyncAt.getTime() + c.pollIntervalMin * 60000 <= now.getTime();
    if (!due) continue;
    try {
      const r = await runSync(c.workspaceId, c.id, "INCREMENTAL", now);
      log({ job: "sync", workspaceId: c.workspaceId, store: c.store.code, ...r.counts, reviews: r.reviews });
    } catch (e) {
      failed.push(c.id);
      log({ job: "sync", workspaceId: c.workspaceId, store: c.store.code, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { checked: conns.length, failed };
}

/** Giá trị 12 tháng là cửa sổ trượt → tính lại cho khách có số liệu cũ hơn 24 giờ (Phase 6 thay bằng Warehouse). */
export async function refreshStaleCustomerStats(now = new Date(), limit = 500) {
  const stale = await rootDb.customer.findMany({
    where: { mergedIntoId: null, OR: [{ statsAt: null }, { statsAt: { lt: new Date(now.getTime() - 86400000) } }] },
    select: { id: true, workspaceId: true }, take: limit,
  });
  let failed = 0;
  for (const c of stale) {
    try {
      await refreshCustomerStats(workspaceDb(c.workspaceId), c.id, now);
    } catch (e) {
      failed++;
      log({ job: "customer-stats", workspaceId: c.workspaceId, customerId: c.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { refreshed: stale.length - failed, failed };
}

async function main() {
  const once = process.argv.includes("--once");
  const minutes = Math.max(1, Number(process.env.WORKER_INTERVAL_MIN ?? 5));
  do {
    const r = await syncDue();
    const stats = await refreshStaleCustomerStats();
    log({ job: "tick", ...r, customerStats: stats });
    if (once) {
      await rootDb.$disconnect();
      process.exit(r.failed.length || stats.failed ? 1 : 0);
    }
    await new Promise((res) => setTimeout(res, minutes * 60000));
  } while (true);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("worker/index.ts")) void main();

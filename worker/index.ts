// Worker nền (tiến trình riêng): đồng bộ các kết nối đến hạn. Các job Phase sau (chấm điểm, journey, nhắc việc) thêm vào đây.
// Chạy: npm run worker          (lặp mỗi WORKER_INTERVAL_MIN phút, mặc định 5)
//       npm run worker -- --once (một lượt; có lỗi thì thoát mã 1)
// Mỗi kết nối chạy trong try/catch riêng: lỗi một kết nối không chặn kết nối khác; lượt sau thử lại.
import { rootDb } from "../src/lib/db";
import { runSync } from "../src/modules/connectors/service";

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

async function main() {
  const once = process.argv.includes("--once");
  const minutes = Math.max(1, Number(process.env.WORKER_INTERVAL_MIN ?? 5));
  do {
    const r = await syncDue();
    log({ job: "tick", ...r });
    if (once) {
      await rootDb.$disconnect();
      process.exit(r.failed.length ? 1 : 0);
    }
    await new Promise((res) => setTimeout(res, minutes * 60000));
  } while (true);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("worker/index.ts")) void main();

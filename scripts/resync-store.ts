// Nạp lại lịch sử một shop (bản ghi đã nhận bị loại là DUPLICATE). Chạy: npx tsx --env-file=.env scripts/resync-store.ts NOVA-SH-US
import { rootDb } from "../src/lib/db";
import { runSync } from "../src/modules/connectors/service";

async function main() {
  const code = process.argv[2];
  const c = await rootDb.connection.findFirstOrThrow({ where: { store: { code } } });
  const r = await runSync(c.workspaceId, c.id, "BACKFILL");
  console.log(code, JSON.stringify(r.counts), "khách chờ xác minh:", await rootDb.customerReview.count({ where: { workspaceId: c.workspaceId, status: "PENDING" } }));
}
main().finally(() => rootDb.$disconnect());

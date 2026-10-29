// Chạy bù Customer 360 cho đơn đã nhập trước Phase 3 (đơn chưa gắn khách). Chạy lại được.
// Chạy: npx tsx --env-file=.env scripts/resolve-customers.ts
import { rootDb, workspaceDb } from "../src/lib/db";
import { resolveAllCustomers } from "../src/modules/customers/resolve";

async function main() {
  for (const w of await rootDb.workspace.findMany()) {
    const t = Date.now();
    const n = await resolveAllCustomers(workspaceDb(w.id));
    const [customers, reviews] = await Promise.all([
      rootDb.customer.count({ where: { workspaceId: w.id, mergedIntoId: null } }),
      rootDb.customerReview.count({ where: { workspaceId: w.id, status: "PENDING" } }),
    ]);
    console.log(`${w.code}: gắn ${n} đơn → ${customers} khách, ${reviews} cặp chờ xác minh (${Math.round((Date.now() - t) / 1000)}s)`);
  }
}
main().finally(() => rootDb.$disconnect());

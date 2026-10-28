// Chạy lại mọi sự kiện lỗi của mọi kết nối (sau khi sửa nguyên nhân, ví dụ thêm tỷ giá). Chạy: npx tsx --env-file=.env scripts/retry-errors.ts
import { rootDb, workspaceDb } from "../src/lib/db";
import { retryErrorEvents } from "../src/modules/connectors/service";

async function main() {
  for (const c of await rootDb.connection.findMany({ include: { store: true } })) {
    console.log(c.store.code, await retryErrorEvents(workspaceDb(c.workspaceId), c.id));
  }
}
main().finally(() => rootDb.$disconnect());

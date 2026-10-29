// Áp lại phiên bản mới nhất của mọi bản ghi một shop qua luồng nhập (sau khi đổi quy tắc chủ nhóm / sửa mapper).
// Mỗi bản ghi: xóa sự kiện của phiên bản mới nhất, lùi mốc của liên kết, rồi nhập lại đúng payload đó — không đổi dữ liệu nguồn.
// Chạy: npx tsx --env-file=.env scripts/reapply-latest.ts ORBI-SH-EU
import { rootDb, workspaceDb } from "../src/lib/db";
import { getPlatform } from "../src/adapters/connectors/registry";
import { ingest, loadSettings } from "../src/modules/orders/ingest";

async function main() {
  const code = process.argv[2];
  const conn = await rootDb.connection.findFirstOrThrow({ where: { store: { code } } });
  const client = workspaceDb(conn.workspaceId);
  const platform = getPlatform(conn.platform);
  const settings = await loadSettings(client);
  const links = await client.sourceOrderLink.findMany({ where: { connectionId: conn.id } });
  const counts: Record<string, number> = {};
  for (const l of links) {
    const ev = await client.sourceEvent.findFirst({
      where: { connectionId: conn.id, sourceRecordId: l.sourceRecordId, sourceUpdatedAt: l.sourceUpdatedAt, outcome: { in: ["APPLIED", "LINKED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!ev) continue;
    await client.sourceEvent.delete({ where: { id: ev.id } });
    await client.sourceOrderLink.update({ where: { id: l.id }, data: { sourceUpdatedAt: new Date(0) } });
    const r = await ingest(client, { conn, platform, settings }, ev.payload);
    counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  }
  console.log(code, counts);
}
main().finally(() => rootDb.$disconnect());

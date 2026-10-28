// Kết nối dữ liệu: tạo kết nối, chạy đồng bộ (backfill/gia tăng), chạy lại sự kiện lỗi. Dùng chung cho trang /ket-noi và worker.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, workspaceDb, type Db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { requirePerm, type SessionUser } from "@/lib/session";
import { getPlatform, listPlatforms, sourceFor } from "@/adapters/connectors/registry";
import { ingest, loadSettings, type Outcome } from "@/modules/orders/ingest";

/** Lùi checkpoint 10 phút mỗi lượt để không sót bản ghi đến trễ; bản đã nhận bị loại bởi eventKey (DUPLICATE). */
const OVERLAP_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export async function listConnections(user: SessionUser) {
  requirePerm(user, "integration.view");
  const [conns, stores] = await Promise.all([
    db.connection.findMany({
      orderBy: { createdAt: "asc" },
      include: { store: { include: { brand: true, markets: true } }, runs: { orderBy: { startedAt: "desc" }, take: 5 }, _count: { select: { links: true } } },
    }),
    db.store.findMany({ where: { active: true, connections: { none: {} } }, orderBy: { code: "asc" } }),
  ]);
  const errorCounts = await db.sourceEvent.groupBy({ by: ["connectionId"], where: { outcome: "ERROR" }, _count: true });
  return {
    connections: conns.map((c) => ({ ...c, errorEvents: errorCounts.find((e) => e.connectionId === c.id)?._count ?? 0, platformInfo: getPlatformSafe(c.platform) })),
    storesWithoutConnection: stores,
    platforms: listPlatforms().map((p) => ({ code: p.code, label: p.label, verification: p.verification })),
  };
}

const getPlatformSafe = (code: string) => {
  try {
    const p = getPlatform(code);
    return { label: p.label, verification: p.verification };
  } catch {
    return null;
  }
};

const createSchema = z.object({
  storeId: z.string().min(1, "Chọn shop"),
  mode: z.enum(["replay", "live"]).default("replay"),
  pollIntervalMin: z.coerce.number().int().min(5, "Tối thiểu 5 phút").max(1440, "Tối đa 1440 phút").default(15),
});

export async function createConnection(user: SessionUser, input: unknown) {
  requirePerm(user, "integration.manage");
  const p = createSchema.safeParse(input);
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ");
  const d = p.data;
  if (d.mode === "live") throw new HttpError(400, "Kết nối thật chưa bật trong bản demo (Phase 12). Chọn chế độ phát lại.");
  const store = await db.store.findFirst({ where: { id: d.storeId } });
  if (!store) throw new HttpError(404, "Shop không thuộc team này");
  getPlatform(store.platform); // ném lỗi rõ ràng nếu chưa có adapter cho nền tảng của shop
  const c = await db.connection.create({ data: { storeId: store.id, platform: store.platform, mode: d.mode, pollIntervalMin: d.pollIntervalMin } as Prisma.ConnectionUncheckedCreateInput });
  await audit(db, { actorId: user.id, entity: "Connection", entityId: c.id, action: "create", after: d });
  return c;
}

export async function setConnectionStatus(user: SessionUser, id: string, status: "ACTIVE" | "PAUSED") {
  requirePerm(user, "integration.manage");
  const c = await db.connection.findFirst({ where: { id } });
  if (!c) throw new HttpError(404, "Không tìm thấy kết nối");
  await db.connection.update({ where: { id }, data: { status } });
  await audit(db, { actorId: user.id, entity: "Connection", entityId: id, action: "update", before: { status: c.status }, after: { status } });
}

export type SyncSummary = { runId: string; counts: Record<Outcome, number>; reviews: number };

/** Chạy một lượt đồng bộ cho kết nối. Dùng client gắn cứng workspace nên chạy được từ worker lẫn server action. */
export async function runSync(workspaceId: string, connectionId: string, mode: "BACKFILL" | "INCREMENTAL", now = new Date()): Promise<SyncSummary> {
  const client = workspaceDb(workspaceId);
  // Khóa: chỉ một lượt chạy cho mỗi kết nối (worker và nút "Đồng bộ ngay" có thể bấm cùng lúc).
  const lock = await client.connection.updateMany({
    where: { id: connectionId, OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }] },
    data: { syncLockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  if (lock.count === 0) throw new HttpError(409, "Kết nối đang đồng bộ, thử lại sau ít phút");
  const conn = await client.connection.findFirstOrThrow({ where: { id: connectionId }, include: { store: true } });
  const run = await client.syncRun.create({ data: { connectionId, mode } as Prisma.SyncRunUncheckedCreateInput });
  const counts: Record<Outcome, number> = { APPLIED: 0, LINKED: 0, STALE: 0, DUPLICATE: 0, ERROR: 0 };
  let reviews = 0;
  try {
    const platform = getPlatform(conn.platform);
    const settings = await loadSettings(client);
    const cp = mode === "BACKFILL" ? null : await client.syncCheckpoint.findFirst({ where: { connectionId, recordType: "order" } });
    const since = cp?.cursorAt ? new Date(cp.cursorAt.getTime() - OVERLAP_MS) : null;
    const events = await sourceFor(conn, conn.store.code).fetch(since, now);
    let cursor = cp?.cursorAt ?? null;
    for (const ev of events) {
      const r = await ingest(client, { conn, platform, settings, syncRunId: run.id }, ev.record);
      counts[r.outcome]++;
      if (r.review) reviews++;
      if (!cursor || ev.visibleAt > cursor) cursor = ev.visibleAt;
    }
    if (cursor) {
      await client.syncCheckpoint.upsert({
        where: { workspaceId_connectionId_recordType: { workspaceId, connectionId, recordType: "order" } },
        update: { cursorAt: cursor },
        create: { connectionId, recordType: "order", cursorAt: cursor } as Prisma.SyncCheckpointUncheckedCreateInput,
      });
    }
    await client.syncRun.update({ where: { id: run.id }, data: { status: "OK", finishedAt: new Date(), applied: counts.APPLIED, linked: counts.LINKED, stale: counts.STALE, duplicate: counts.DUPLICATE, errors: counts.ERROR, reviews } });
    await client.connection.update({ where: { id: connectionId }, data: { lastSyncAt: now, lastError: counts.ERROR ? `${counts.ERROR} bản ghi lỗi ở lượt gần nhất` : null, status: conn.status === "ERROR" ? "ACTIVE" : conn.status, syncLockedUntil: null } });
    return { runId: run.id, counts, reviews };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await client.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: msg.slice(0, 500), applied: counts.APPLIED, linked: counts.LINKED, stale: counts.STALE, duplicate: counts.DUPLICATE, errors: counts.ERROR, reviews } });
    await client.connection.update({ where: { id: connectionId }, data: { lastError: msg.slice(0, 500), status: "ERROR", syncLockedUntil: null } });
    throw e;
  }
}

export async function syncNow(user: SessionUser, connectionId: string, mode: "BACKFILL" | "INCREMENTAL") {
  requirePerm(user, "integration.manage");
  if (!(await db.connection.findFirst({ where: { id: connectionId } }))) throw new HttpError(404, "Không tìm thấy kết nối");
  const res = await runSync(user.workspaceId, connectionId, mode);
  await audit(db, { actorId: user.id, entity: "Connection", entityId: connectionId, action: "sync", after: { mode, ...res.counts, reviews: res.reviews } });
  return res;
}

/** Chạy lại các sự kiện lỗi của kết nối (sau khi đã sửa nguyên nhân, ví dụ thêm tỷ giá). */
export async function retryErrors(user: SessionUser, connectionId: string) {
  requirePerm(user, "integration.manage");
  return retryErrorEvents(workspaceDb(user.workspaceId), connectionId);
}

export async function retryErrorEvents(client: Db, connectionId: string) {
  const conn = await client.connection.findFirstOrThrow({ where: { id: connectionId } });
  const platform = getPlatform(conn.platform);
  const settings = await loadSettings(client);
  const failed = await client.sourceEvent.findMany({ where: { connectionId, outcome: "ERROR" }, orderBy: { createdAt: "asc" } });
  const counts: Record<Outcome, number> = { APPLIED: 0, LINKED: 0, STALE: 0, DUPLICATE: 0, ERROR: 0 };
  for (const ev of failed) {
    await client.sourceEvent.delete({ where: { id: ev.id } });
    const r = await ingest(client, { conn, platform, settings }, ev.payload);
    counts[r.outcome]++;
  }
  return counts;
}

export async function recentErrors(user: SessionUser, connectionId: string) {
  requirePerm(user, "integration.view");
  return db.sourceEvent.findMany({ where: { connectionId, outcome: "ERROR" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, sourceRecordId: true, error: true, createdAt: true } });
}

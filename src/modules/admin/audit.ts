// Nhật ký thao tác (Phase 11.1, /quan-tri/nhat-ky): lọc theo người / entity / kỳ / mã bản ghi, phân trang ở server (D-48),
// xem trước/sau với trường đổi được đánh dấu. Nhật ký chỉ thêm (D-16) — không có hàm sửa/xóa.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, rootDb } from "@/lib/db";
import { requirePerm, type SessionUser } from "@/lib/session";

export const AUDIT_PAGE = 50;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
export const auditFilter = z.object({
  actor: z.string().trim().max(40).optional().catch(undefined).transform((v) => v || undefined),
  entity: z.string().trim().max(60).optional().catch(undefined).transform((v) => v || undefined),
  entityId: z.string().trim().max(80).optional().catch(undefined).transform((v) => v || undefined),
  action: z.string().trim().max(60).optional().catch(undefined).transform((v) => v || undefined),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type AuditFilter = z.infer<typeof auditFilter>;

/** Khóa cấp một thay đổi giữa trước và sau (so theo JSON). Hàm thuần — có test. */
export function changedKeys(before: unknown, after: unknown): string[] {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const b = obj(before), a = obj(after);
  if (!b || !a) return JSON.stringify(before ?? null) === JSON.stringify(after ?? null) ? [] : ["(toàn bộ)"];
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null)).sort();
}

export async function listAuditLog(u: SessionUser, f: AuditFilter) {
  requirePerm(u, "admin.audit");
  // Kỳ theo ngày UTC [từ, đến+1) như mọi bộ lọc ngày khác.
  const at: Prisma.DateTimeFilter = {};
  if (f.from) at.gte = new Date(`${f.from}T00:00:00Z`);
  if (f.to) at.lt = new Date(new Date(`${f.to}T00:00:00Z`).getTime() + 86_400_000);
  const where: Prisma.AuditLogWhereInput = {
    ...(f.actor ? { actorId: f.actor } : {}), ...(f.entity ? { entity: f.entity } : {}), ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(f.action ? { action: f.action } : {}), ...(f.from || f.to ? { at } : {}),
  };
  const [rows, total, entities, actorIds] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: [{ at: "desc" }, { id: "desc" }], skip: (f.page - 1) * AUDIT_PAGE, take: AUDIT_PAGE }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    db.membership.findMany({ where: { workspaceId: u.workspaceId }, select: { userId: true } }), // Membership không tự gắn workspace
  ]);
  const users = await rootDb.user.findMany({ where: { id: { in: [...new Set([...rows.map((r) => r.actorId), ...actorIds.map((m) => m.userId)])] } }, select: { id: true, name: true } });
  const name = new Map(users.map((x) => [x.id, x.name]));
  return {
    total, page: f.page, pageSize: AUDIT_PAGE,
    entities: entities.map((e) => e.entity),
    actors: [...new Set(actorIds.map((m) => m.userId))].map((id) => ({ id, name: name.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name, "vi")),
    rows: rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actorId: r.actorId, actor: name.get(r.actorId) ?? r.actorId, entity: r.entity, entityId: r.entityId, action: r.action, reason: r.reason, before: r.before, after: r.after, changed: changedKeys(r.before, r.after) })),
  };
}

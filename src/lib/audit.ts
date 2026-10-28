// Nhật ký chỉ thêm (D-16). Gọi trong cùng transaction với thay đổi để không có thay đổi nào thiếu dấu vết.
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Client = Pick<typeof db, "auditLog">;

export type AuditEntry = {
  actorId: string;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

export async function audit(client: Client, e: AuditEntry) {
  return await client.auditLog.create({
    data: {
      actorId: e.actorId,
      entity: e.entity,
      entityId: e.entityId,
      action: e.action,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason,
    } as Prisma.AuditLogUncheckedCreateInput,
  });
}

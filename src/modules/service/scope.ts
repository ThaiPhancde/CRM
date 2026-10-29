// Phạm vi ticket (docs/permissions.md mục 2–3, D-50). Vai rộng nhất thắng.
// Quản lý, Trưởng nhóm: mọi ticket; Sales: của mình + chưa giao của nhóm; Vận đơn: ticket giao chậm/đổi trả.
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

const has = (u: SessionUser, ...roles: SessionUser["roles"]) => u.roles.some((r) => roles.includes(r));

export function ticketWhere(u: SessionUser): Prisma.TicketWhereInput {
  if (has(u, "MANAGER", "SALES_LEAD")) return {};
  const or: Prisma.TicketWhereInput[] = [];
  if (has(u, "SALES")) or.push({ ownerId: u.id }, ...(u.teamId ? [{ teamId: u.teamId, ownerId: null }] : []));
  if (has(u, "FULFILLMENT")) or.push({ type: { in: ["GIAO_CHAM", "DOI_TRA"] } }, { ownerId: u.id });
  return or.length ? { OR: or } : { id: "__none__" };
}

/** Ticket được giao/chuyển: Quản lý mọi ticket, Trưởng nhóm ticket của nhóm mình hoặc chưa có nhóm. */
export function ticketAssignWhere(u: SessionUser): Prisma.TicketWhereInput {
  if (has(u, "MANAGER")) return {};
  return u.teamId ? { OR: [{ teamId: u.teamId }, { teamId: null }] } : { id: "__none__" };
}

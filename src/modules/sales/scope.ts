// Phạm vi dữ liệu Phase 4 (docs/permissions.md mục 3, D-45). Lọc ở service, không ở UI; vai trò rộng nhất của người dùng thắng.
// - Quản lý: cả workspace. Marketing: xem mọi lead (không sửa).
// - Trưởng nhóm sales: lead/việc của nhóm mình (Team).
// - Sales: lead của mình + lead chưa giao của nhóm; việc của mình; khách/đơn chỉ khi có lead/việc liên quan tới mình.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const has = (u: SessionUser, ...roles: SessionUser["roles"]) => u.roles.some((r) => roles.includes(r));

/** Lead được xem. */
export function leadViewWhere(u: SessionUser): Prisma.LeadWhereInput {
  if (has(u, "MANAGER", "MARKETING")) return {};
  return leadEditWhere(u);
}

/** Lead được sửa/ghi tương tác (Marketing không sửa). */
export function leadEditWhere(u: SessionUser): Prisma.LeadWhereInput {
  if (has(u, "MANAGER")) return {};
  if (has(u, "SALES_LEAD") && u.teamId) return { teamId: u.teamId };
  return { OR: [{ ownerId: u.id }, ...(u.teamId ? [{ teamId: u.teamId, ownerId: null }] : [])] };
}

/** Lead được chuyển phụ trách: Quản lý mọi lead, Trưởng nhóm lead của nhóm mình. */
export function leadAssignWhere(u: SessionUser): Prisma.LeadWhereInput {
  if (has(u, "MANAGER")) return {};
  return u.teamId ? { teamId: u.teamId } : { id: "__none__" };
}

/** Thành viên người dùng được giao lead/việc cho: Quản lý mọi người trong workspace, Trưởng nhóm người trong nhóm, còn lại chỉ mình. */
export function assigneeWhere(u: SessionUser): Prisma.MembershipWhereInput {
  const base = { workspaceId: u.workspaceId, active: true };
  if (has(u, "MANAGER")) return base;
  if (has(u, "SALES_LEAD") && u.teamId) return { ...base, teamId: u.teamId };
  return { ...base, userId: u.id };
}

/** Nhiệm vụ được xem/sửa. */
export function taskWhere(u: SessionUser): Prisma.TaskWhereInput {
  if (has(u, "MANAGER")) return {};
  if (has(u, "SALES_LEAD") && u.teamId)
    return { OR: [{ assigneeId: u.id }, { assignee: { memberships: { some: { workspaceId: u.workspaceId, teamId: u.teamId } } } }] };
  return { assigneeId: u.id };
}

/**
 * Khách được xem (lead, việc hoặc ticket giao cho mình — D-45, D-50). Chỉ người CHỈ có vai Sales bị hẹp (các vai khác có customer.view đều xem cả workspace — ma trận mục 2).
 * ponytail: lọc qua quan hệ lead/task mỗi truy vấn; nhiều khách thì lưu bảng phân công khách riêng.
 */
export function customerScopeWhere(u: SessionUser): Prisma.CustomerWhereInput {
  if (has(u, "MANAGER", "SALES_LEAD", "MARKETING", "FULFILLMENT", "FINANCE_VIEW", "PURCHASING_VIEW")) return {};
  return { OR: [{ leads: { some: leadEditWhere(u) } }, { tasks: { some: { assigneeId: u.id } } }, { tickets: { some: { ownerId: u.id } } }] };
}

/**
 * Đơn được xem: Sales chỉ đơn của khách trong phạm vi. Lấy danh sách khách được phép TRƯỚC rồi lọc `customerId IN (…)`:
 * điều kiện quan hệ lồng (đơn → khách → lead) bị Postgres đánh giá trên mọi đơn — 0,8 s với 600k đơn (D-48, docs/performance.md).
 */
export async function orderScopeWhere(u: SessionUser): Promise<Prisma.OrderWhereInput> {
  if (!Object.keys(customerScopeWhere(u)).length) return {};
  // Hợp 3 truy vấn có index (lead / việc / ticket của mình) thay cho 3 EXISTS lồng trên mọi khách — 0,58 s → xem docs/performance.md.
  const [l, t, k] = await Promise.all([
    db.lead.findMany({ where: { AND: [leadEditWhere(u), { customerId: { not: null } }] }, select: { customerId: true }, distinct: ["customerId"] }),
    db.task.findMany({ where: { assigneeId: u.id, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"] }),
    db.ticket.findMany({ where: { ownerId: u.id, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"] }),
  ]);
  return { customerId: { in: [...new Set([...l, ...t, ...k].map((x) => x.customerId!))] } };
}

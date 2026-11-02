// Quyền dữ liệu của khách (Phase 11.1, GDPR/PDPA): xuất toàn bộ dữ liệu một khách (JSON) và xóa dữ liệu cá nhân theo yêu cầu.
// "Xóa" = ẩn danh hóa trong một transaction: bỏ tên/SĐT/email/địa chỉ/nội dung hội thoại ở mọi bảng, GIỮ đơn + số tiền (chỉ số doanh thu,
// báo cáo không đổi). Hồ sơ đã gộp vào khách này cũng bị xóa. Chạy lại → không đổi gì. Audit ghi lý do + số bản ghi, không ghi PII.
// Giới hạn đã biết: nhật ký audit cũ (chỉ thêm, D-16) và câu hỏi AI người dùng tự gõ có thể còn tên khách — ghi ở docs/deploy-checklist.md.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { requirePerm, type SessionUser } from "@/lib/session";

export const ERASED_NAME = "Đã xóa dữ liệu theo yêu cầu";
const REDACTED = "[Đã xóa nội dung theo yêu cầu của khách]";
const pseudo = (s: string) => `erased:${createHash("sha256").update(s).digest("hex").slice(0, 16)}`;

/** Khách + mọi hồ sơ đã gộp vào khách đó (cùng một người). */
async function personIds(id: string) {
  const c = await db.customer.findFirst({ where: { id }, select: { id: true, mergedIntoId: true, erasedAt: true, displayName: true } });
  if (!c) throw new HttpError(404, "Không tìm thấy khách");
  if (c.mergedIntoId) throw new ValidationError({ customerId: "Hồ sơ này đã gộp vào khách khác — thao tác trên hồ sơ giữ lại" });
  const merged = await db.customer.findMany({ where: { mergedIntoId: id }, select: { id: true } });
  return { customer: c, ids: [id, ...merged.map((m) => m.id)] };
}

/** Xuất toàn bộ dữ liệu của khách (đơn, liên hệ, nhu cầu, tương tác, ticket, điểm, chỉ số) — để trả lời yêu cầu truy cập dữ liệu. */
export async function exportCustomerData(u: SessionUser, customerId: string) {
  requirePerm(u, "customer.privacy");
  const { ids } = await personIds(customerId);
  const where = { customerId: { in: ids } };
  const leadIds = (await db.lead.findMany({ where, select: { id: true } })).map((l) => l.id);
  const [customers, identities, addresses, preferences, orders, leads, activities, tickets, touchpoints, scores, metrics] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids } } }),
    db.customerIdentity.findMany({ where }),
    db.address.findMany({ where }),
    db.contactPreference.findMany({ where, orderBy: { changedAt: "asc" } }),
    db.order.findMany({ where, orderBy: { bookedAt: "asc" }, include: { items: true, payments: true, refunds: true, shipments: { include: { events: true } }, settlementLines: true } }),
    db.lead.findMany({ where }),
    // Tương tác gắn khách hoặc gắn nhu cầu mua của khách (hội thoại trước khi có hồ sơ khách).
    db.activity.findMany({ where: { OR: [where, { leadId: { in: leadIds } }] }, orderBy: { occurredAt: "asc" } }),
    db.ticket.findMany({ where, include: { events: { orderBy: { createdAt: "asc" } } } }),
    db.touchpoint.findMany({ where }),
    db.score.findMany({ where }),
    db.customerMetric.findMany({ where }),
  ]);
  await db.$transaction(async (tx) => audit(tx, { actorId: u.id, entity: "Customer", entityId: customerId, action: "privacy.export", after: { records: orders.length + leads.length + activities.length + tickets.length } }));
  return { exportedAt: new Date().toISOString(), customerId, customers, identities, addresses, preferences, orders, leads, activities, tickets, touchpoints, scores, metrics };
}

export const eraseSchema = z.object({
  customerId: z.string().trim().min(1),
  reason: z.string().trim().min(5, "Ghi lý do / số yêu cầu (tối thiểu 5 ký tự)").max(500, "Tối đa 500 ký tự"),
  confirm: z.string().trim(),
});

/** Xóa dữ liệu cá nhân của khách theo yêu cầu. Người dùng phải gõ đúng "XOA" để xác nhận. Đã xóa trước đó → trả { replayed: true }. */
export async function eraseCustomerData(u: SessionUser, input: unknown, now = new Date()) {
  requirePerm(u, "customer.privacy");
  const d = parse(eraseSchema, input);
  if (d.confirm.toUpperCase() !== "XOA") throw new ValidationError({ confirm: "Gõ XOA để xác nhận" });
  const { customer, ids } = await personIds(d.customerId);
  if (customer.erasedAt) return { replayed: true, counts: {} as Record<string, number> };
  const where = { customerId: { in: ids } };

  // Địa chỉ liên hệ của khách (để gỡ khỏi hàng đợi gửi tin — Outbox không gắn khóa ngoại tới khách).
  const [custs, idents, leadsBefore] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids } }, select: { primaryPhoneE164: true, primaryEmail: true } }),
    db.customerIdentity.findMany({ where, select: { id: true, phoneE164: true, emailNormalized: true, sourceCustomerId: true } }),
    db.lead.findMany({ where, select: { id: true, contactPhoneE164: true, contactEmail: true } }),
  ]);
  const contacts = [...new Set([...custs.flatMap((c) => [c.primaryPhoneE164, c.primaryEmail]), ...idents.flatMap((i) => [i.phoneE164, i.emailNormalized]), ...leadsBefore.flatMap((l) => [l.contactPhoneE164, l.contactEmail])].filter((x): x is string => !!x))];
  const leadIds = leadsBefore.map((l) => l.id);
  const orderIds = (await db.order.findMany({ where, select: { id: true } })).map((o) => o.id);
  const ticketIds = (await db.ticket.findMany({ where, select: { id: true } })).map((t) => t.id);

  const counts = await db.$transaction(async (tx) => {
    const c: Record<string, number> = {};
    c.customers = (await tx.customer.updateMany({ where: { id: { in: ids } }, data: { displayName: ERASED_NAME, primaryPhoneE164: null, primaryEmail: null, tags: [], erasedAt: now } })).count;
    for (const i of idents)
      await tx.customerIdentity.update({ where: { id: i.id }, data: { phoneE164: null, emailNormalized: null, sourceCustomerId: i.sourceCustomerId ? pseudo(i.sourceCustomerId) : null } });
    c.identities = idents.length;
    c.addresses = (await tx.address.deleteMany({ where })).count;
    c.orders = (await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { customerName: null, customerPhone: null, customerEmail: null, customerSourceId: null } })).count;
    // Bản ghi gốc từ nền tảng chứa tên/SĐT/địa chỉ khách → thay bằng dấu đã xóa (giữ khóa sự kiện để chống nhận trùng).
    c.sourceEvents = (await tx.sourceEvent.updateMany({ where: { orderId: { in: orderIds } }, data: { payload: { redacted: true, at: now.toISOString() } } })).count;
    c.leads = (await tx.lead.updateMany({ where: { id: { in: leadIds } }, data: { contactName: ERASED_NAME, contactPhoneE164: null, contactEmail: null } })).count;
    c.activities = (await tx.activity.updateMany({ where: { OR: [where, { leadId: { in: leadIds } }] }, data: { body: REDACTED } })).count;
    c.tickets = (await tx.ticket.updateMany({ where: { id: { in: ticketIds } }, data: { subject: REDACTED } })).count;
    c.ticketEvents = (await tx.ticketEvent.updateMany({ where: { ticketId: { in: ticketIds } }, data: { body: REDACTED, meta: Prisma.DbNull } })).count;
    c.outbox = contacts.length ? (await tx.outbox.updateMany({ where: { recipient: { in: contacts } }, data: { recipient: "[đã xóa]", body: REDACTED, subject: null } })).count : 0;
    await audit(tx, { actorId: u.id, entity: "Customer", entityId: d.customerId, action: "privacy.erase", reason: d.reason, after: c });
    return c;
  });
  return { replayed: false, counts };
}

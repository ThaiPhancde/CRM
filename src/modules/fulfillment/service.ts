// Vận đơn (Phase 10, D-58): đơn giao thất bại cần can thiệp + thao tác giao lại / hủy / chuyển ticket.
// "Cần can thiệp" = vận đơn đang FAILED, đơn chưa hủy, và chưa có DeliveryAction cho lần thất bại gần nhất
// (DeliveryAction.failedAt ≥ Shipment.failedAt). Thất bại lần nữa sau khi giao lại → failedAt mới → hiện lại.
// CRM không ghi ngược POS / hãng (D-13): giao lại và hủy là yêu cầu ghi Outbox (SIMULATED khi EXTERNAL_WRITES_ENABLED=false).
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { enqueueOutbox } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { piiFor } from "@/lib/pii";
import { requirePerm, type SessionUser } from "@/lib/session";
import { createTicket } from "@/modules/service/tickets";
import { customerScopeWhere } from "@/modules/sales/scope";
import { FAILURE_REASON_CODES, FAILURE_REASONS, reasonLabel, type Fault } from "./reasons";

export const INTERVENTION_PAGE = 50;
export const interventionFilter = z.object({
  reason: z.enum(FAILURE_REASON_CODES as [string, ...string[]]).optional().catch(undefined),
  fault: z.enum(["customer", "carrier", "other"]).optional().catch(undefined),
  carrier: z.string().trim().max(60).optional().catch(undefined).transform((v) => v || undefined),
  store: z.string().trim().max(40).optional().catch(undefined).transform((v) => v || undefined),
  market: z.string().trim().max(40).optional().catch(undefined).transform((v) => v || undefined),
  q: z.string().trim().max(60).optional().catch(undefined).transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type InterventionFilter = z.infer<typeof interventionFilter>;

/** Đơn cần can thiệp chỉ cho vai có phạm vi cả team — danh sách đọc thẳng SQL, không lọc theo khách được giao. */
function requireTeamScope(u: SessionUser, perm: "fulfillment.view" | "fulfillment.manage") {
  requirePerm(u, perm);
  if (Object.keys(customerScopeWhere(u)).length) throw new HttpError(403, "Cần phạm vi cả team");
}

/** Điều kiện "đang cần can thiệp" (alias s = Shipment, o = Order). Dùng chung cho danh sách, đếm, kiểm khi thao tác. */
const OPEN = Prisma.sql`s."status" = 'FAILED' AND o."status" <> 'CANCELLED' AND s."failedAt" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "DeliveryAction" a WHERE a."orderId" = s."orderId" AND a."failedAt" >= s."failedAt")`;

function where(u: SessionUser, f: Omit<InterventionFilter, "page">, withReason = true) {
  const reasons = f.reason ? [f.reason] : f.fault ? FAILURE_REASON_CODES.filter((c) => FAILURE_REASONS[c].fault === f.fault) : null;
  const parts = [Prisma.sql`s."workspaceId" = ${u.workspaceId}`, OPEN];
  if (withReason && reasons) parts.push(Prisma.sql`COALESCE(s."failureReason", 'other') IN (${Prisma.join(reasons)})`);
  if (f.carrier) parts.push(Prisma.sql`s."carrier" = ${f.carrier}`);
  if (f.store) parts.push(Prisma.sql`o."storeId" = ${f.store}`);
  if (f.market) parts.push(Prisma.sql`o."marketId" = ${f.market}`);
  if (f.q) parts.push(Prisma.sql`(o."orderNumber" ILIKE ${`%${f.q}%`} OR s."trackingNo" ILIKE ${`%${f.q}%`})`);
  return Prisma.join(parts, " AND ");
}

export async function listInterventions(u: SessionUser, f: InterventionFilter) {
  requireTeamScope(u, "fulfillment.view");
  const w = where(u, f);
  const [rows, [{ n }], byReason] = await Promise.all([
    // Thất bại lâu nhất lên đầu (khách chờ lâu nhất). Một đơn nhiều vận đơn thất bại → mỗi vận đơn một dòng.
    db.$queryRaw<{ orderId: string; failedAt: Date; reason: string | null; carrier: string | null; trackingNo: string | null }[]>`
      SELECT s."orderId", s."failedAt", s."failureReason" AS reason, s."carrier", s."trackingNo"
      FROM "Shipment" s JOIN "Order" o ON o."id" = s."orderId" WHERE ${w}
      ORDER BY s."failedAt" ASC, s."id" LIMIT ${INTERVENTION_PAGE} OFFSET ${(f.page - 1) * INTERVENTION_PAGE}`,
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Shipment" s JOIN "Order" o ON o."id" = s."orderId" WHERE ${w}`,
    db.$queryRaw<{ reason: string; n: number }[]>`
      SELECT COALESCE(s."failureReason", 'other') AS reason, COUNT(*)::int AS n FROM "Shipment" s JOIN "Order" o ON o."id" = s."orderId"
      WHERE ${where(u, f, false)} GROUP BY 1 ORDER BY 2 DESC`,
  ]);
  const ids = [...new Set(rows.map((r) => r.orderId))];
  const [orders, actions] = await Promise.all([
    db.order.findMany({
      where: { id: { in: ids } },
      select: { id: true, orderNumber: true, bookedAt: true, currency: true, netAmount: true, customerId: true, customerName: true, customerPhone: true,
        store: { select: { name: true } }, market: { select: { code: true } }, customer: { select: { displayName: true, primaryPhoneE164: true } } },
    }),
    db.deliveryAction.groupBy({ by: ["orderId"], where: { orderId: { in: ids } }, _count: true }),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const prior = new Map(actions.map((a) => [a.orderId, a._count]));
  const pii = piiFor(u);
  const money = can(u.roles, "finance.view");
  return {
    total: n, page: f.page, pageSize: INTERVENTION_PAGE,
    byReason: byReason.map((r) => ({ reason: r.reason, label: reasonLabel(r.reason), fault: (FAILURE_REASONS[r.reason as keyof typeof FAILURE_REASONS]?.fault ?? "other") as Fault, n: r.n })),
    rows: rows.map((r) => {
      const o = byId.get(r.orderId)!;
      return {
        orderId: r.orderId, orderNumber: o.orderNumber, store: o.store.name, market: o.market?.code ?? null, bookedAt: o.bookedAt.toISOString(),
        customerId: o.customerId, customerName: o.customer?.displayName ?? o.customerName, phone: pii.phone(o.customer?.primaryPhoneE164 ?? o.customerPhone),
        amount: money ? o.netAmount.toString() : null, currency: o.currency,
        failedAt: r.failedAt.toISOString(), reason: r.reason ?? "other", reasonLabel: reasonLabel(r.reason ?? "other"),
        fault: (FAILURE_REASONS[(r.reason ?? "other") as keyof typeof FAILURE_REASONS]?.fault ?? "other") as Fault,
        carrier: r.carrier, trackingNo: r.trackingNo, priorActions: prior.get(r.orderId) ?? 0,
      };
    }),
  };
}

export const DELIVERY_ACTIONS = ["REATTEMPT", "CANCEL", "TICKET"] as const;
export const deliveryActionSchema = z.object({
  orderId: z.string().trim().min(1, "Thiếu đơn"),
  kind: z.enum(DELIVERY_ACTIONS, { message: "Chọn cách xử lý" }),
  note: z.string().trim().max(1000, "Tối đa 1000 ký tự").optional().transform((v) => v || undefined),
  priority: z.enum(["THAP", "TRUNG", "CAO", "KHAN"]).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

/** Xử lý một đơn giao thất bại. Bấm lại cùng khóa → trả kết quả cũ. Đơn đã được xử lý cho lần thất bại này → 409. */
export async function actOnDelivery(u: SessionUser, input: unknown, now = new Date()) {
  requireTeamScope(u, "fulfillment.manage");
  const d = parse(deliveryActionSchema, input);
  const prev = await db.deliveryAction.findFirst({ where: { idempotencyKey: d.idempotencyKey }, select: { id: true, ticketId: true } });
  if (prev) return { id: prev.id, ticketId: prev.ticketId, replayed: true };
  if (d.kind === "CANCEL" && !d.note) throw new ValidationError({ note: "Ghi lý do hủy" });

  const [open] = await db.$queryRaw<{ failedAt: Date; reason: string | null; carrier: string | null; trackingNo: string | null }[]>`
    SELECT s."failedAt", s."failureReason" AS reason, s."carrier", s."trackingNo" FROM "Shipment" s JOIN "Order" o ON o."id" = s."orderId"
    WHERE s."workspaceId" = ${u.workspaceId} AND s."orderId" = ${d.orderId} AND ${OPEN} ORDER BY s."failedAt" DESC LIMIT 1`;
  if (!open) throw new HttpError(409, "Đơn không còn cần can thiệp (đã có người xử lý hoặc trạng thái giao đã đổi).");
  const order = await db.order.findFirstOrThrow({ where: { id: d.orderId }, select: { id: true, orderNumber: true, customerId: true, store: { select: { name: true } } } });
  const label = reasonLabel(open.reason);

  let ticketId: string | undefined;
  if (d.kind === "TICKET") {
    const carrierFault = FAILURE_REASONS[(open.reason ?? "other") as keyof typeof FAILURE_REASONS]?.fault === "carrier";
    const t = await createTicket(u, {
      type: carrierFault ? "GIAO_CHAM" : "KHAC", priority: d.priority ?? "TRUNG",
      subject: `Giao thất bại ${order.orderNumber}: ${label}`,
      body: [`Vận đơn ${open.trackingNo ?? "—"} (${open.carrier ?? "—"}) thất bại: ${label}.`, d.note].filter(Boolean).join("\n"),
      orderId: order.id, idempotencyKey: `delivery:${d.idempotencyKey}`,
    }, now);
    ticketId = t.id;
  }
  try {
    return await db.$transaction(async (tx) => {
      const a = await tx.deliveryAction.create({
        data: { orderId: order.id, kind: d.kind, failedAt: open.failedAt, reasonCode: open.reason, note: d.note, ticketId, idempotencyKey: d.idempotencyKey, createdById: u.id, createdAt: now } as Prisma.DeliveryActionUncheckedCreateInput,
      });
      if (d.kind === "REATTEMPT")
        await enqueueOutbox(tx as never, { channel: "CARRIER", recipient: open.carrier ?? "hãng vận chuyển", subject: `Yêu cầu giao lại ${open.trackingNo ?? order.orderNumber}`, body: `Giao lại đơn ${order.orderNumber}, vận đơn ${open.trackingNo ?? "—"}. Lần trước: ${label}.${d.note ? ` Ghi chú: ${d.note}` : ""}`, entity: "DeliveryAction", entityId: a.id, key: `delivery-action:${a.id}` });
      if (d.kind === "CANCEL")
        await enqueueOutbox(tx as never, { channel: "POS", recipient: order.store.name, subject: `Yêu cầu hủy đơn ${order.orderNumber}`, body: `Hủy đơn ${order.orderNumber} sau giao thất bại (${label}). Lý do: ${d.note}`, entity: "DeliveryAction", entityId: a.id, key: `delivery-action:${a.id}` });
      await audit(tx, { actorId: u.id, entity: "Order", entityId: order.id, action: `delivery.${d.kind.toLowerCase()}`, after: { kind: d.kind, failedAt: open.failedAt, reason: open.reason, note: d.note, ticketId } });
      return { id: a.id, ticketId: ticketId ?? null, replayed: false };
    });
  } catch (e) {
    // Cùng khóa (bấm đúp) → trả bản đầu. Khác khóa nhưng cùng lần thất bại (hai người cùng xử lý) → 409.
    // ponytail: nhánh TICKET đã tạo ticket trước khi va chạm → ticket vẫn còn (hữu ích, có gắn đơn); hiếm, không hoàn tác.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const a = await db.deliveryAction.findFirst({ where: { idempotencyKey: d.idempotencyKey } });
      if (a) return { id: a.id, ticketId: a.ticketId, replayed: true };
      throw new HttpError(409, "Người khác vừa xử lý lần giao thất bại này.");
    }
    throw e;
  }
}

/** Lịch sử xử lý giao hàng của một đơn (trang đơn). */
export async function deliveryActions(orderId: string) {
  const rows = await db.deliveryAction.findMany({ where: { orderId }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, failedAt: true, reasonCode: true, note: true, ticketId: true, createdAt: true, createdById: true } });
  const users = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  return rows.map((r) => ({ ...r, failedAt: r.failedAt.toISOString(), createdAt: r.createdAt.toISOString(), reasonLabel: reasonLabel(r.reasonCode), by: users.get(r.createdById) ?? "—" }));
}

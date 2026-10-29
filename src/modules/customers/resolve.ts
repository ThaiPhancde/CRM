// Hợp nhất khách (D-08, HLD §6.1). Dùng chung cho lúc nhập đơn (ingest) và chạy bù đơn cũ (resolveAllCustomers).
// Bằng chứng TỰ GỘP: cùng mã khách ở cùng kết nối nguồn, hoặc cùng SĐT E.164. Email chỉ tự gộp khi nguồn xác minh
// (chưa nguồn nào xác minh) → trùng email chưa xác minh chỉ tạo hàng đợi xác minh. Tên, IP không bao giờ là bằng chứng.
import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/phone";

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
type Client = Tx | Db;

export type CustomerInput = {
  connectionId: string;
  platform: string;
  sourceId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  country?: string | null;
  at: Date;
};

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Gắn đơn vào khách hợp nhất. `reassign=false` (nguồn phụ không chủ nhóm đơn) chỉ bổ sung danh tính cho khách đang gắn. */
export async function resolveCustomer(tx: Client, input: CustomerInput, orderId: string, reassign = true): Promise<string> {
  const phone = normalizePhone(input.phone, input.country)?.e164 ?? null;
  const email = normalizeEmail(input.email);
  const order = await tx.order.findFirstOrThrow({ where: { id: orderId }, select: { customerId: true } });

  // Đơn chưa có khách thì nguồn nào cũng được gắn; đã có khách thì chỉ nguồn chủ nhóm đơn mới gắn lại.
  const assign = reassign || !order.customerId;
  let customerId: string | null = assign ? null : order.customerId;
  const reviewWith = new Set<string>();
  const reasons: Record<string, unknown> = {};

  if (!customerId) {
    const live = { customer: { mergedIntoId: null } };
    const byId = input.sourceId
      ? await tx.customerIdentity.findFirst({ where: { connectionId: input.connectionId, sourceCustomerId: input.sourceId, ...live }, select: { customerId: true } })
      : null;
    const byPhone = phone ? await tx.customerIdentity.findMany({ where: { phoneE164: phone, ...live }, select: { customerId: true }, distinct: ["customerId"] }) : [];
    const verifiedEmail = email && input.emailVerified
      ? await tx.customerIdentity.findMany({ where: { emailNormalized: email, emailVerified: true, ...live }, select: { customerId: true }, distinct: ["customerId"] })
      : [];
    const auto = [...new Set([byId?.customerId, ...byPhone.map((x) => x.customerId), ...verifiedEmail.map((x) => x.customerId)].filter(Boolean) as string[])];
    if (auto.length) {
      // Mã khách nguồn là bằng chứng mạnh nhất; còn lại lấy hồ sơ có trước.
      customerId = byId?.customerId ?? (await tx.customer.findFirstOrThrow({ where: { id: { in: auto } }, orderBy: { createdAt: "asc" }, select: { id: true } })).id;
      // Nhiều hồ sơ cùng bằng chứng tự gộp (vd. mã nguồn trỏ A, SĐT trỏ B): không gộp ngầm, đưa vào hàng đợi.
      for (const other of auto) if (other !== customerId) reviewWith.add(other);
      if (reviewWith.size) reasons.sameStrongEvidence = { phone: !!byPhone.length, sourceId: !!byId };
    }
  }

  if (!customerId) {
    const c = await tx.customer.create({
      data: { displayName: input.name?.trim() || phone || email || "Khách chưa có tên", primaryPhoneE164: phone, primaryEmail: email, marketId: await marketId(tx, input.country) } as Prisma.CustomerUncheckedCreateInput,
    });
    customerId = c.id;
    // Email trùng nhưng chưa xác minh → chỉ nghi ngờ.
    if (email) {
      const sameEmail = await tx.customerIdentity.findMany({ where: { emailNormalized: email, customerId: { not: customerId }, customer: { mergedIntoId: null } }, select: { customerId: true }, distinct: ["customerId"] });
      for (const s of sameEmail) reviewWith.add(s.customerId);
      if (sameEmail.length) reasons.sameEmailUnverified = email;
    }
  }

  await upsertIdentity(tx, customerId, input, phone, email);
  if (input.country) await ensureAddress(tx, customerId, input.country);

  if (assign && order.customerId !== customerId) {
    await tx.order.update({ where: { id: orderId }, data: { customerId } });
    if (order.customerId) await refreshCustomerStats(tx, order.customerId);
  }
  await refreshCustomerStats(tx, customerId);

  for (const other of reviewWith) {
    const [a, b] = [customerId, other].sort();
    try {
      await tx.customerReview.create({ data: { customerAId: a, customerBId: b, reasons: reasons as Prisma.InputJsonValue } as Prisma.CustomerReviewUncheckedCreateInput });
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  return customerId;
}

async function marketId(tx: Client, country?: string | null) {
  if (!country) return null;
  return (await tx.market.findFirst({ where: { code: country }, select: { id: true } }))?.id ?? null;
}

async function upsertIdentity(tx: Client, customerId: string, input: CustomerInput, phone: string | null, email: string | null) {
  if (input.sourceId) {
    const existing = await tx.customerIdentity.findFirst({ where: { connectionId: input.connectionId, sourceCustomerId: input.sourceId } });
    if (existing) {
      // Không ghi đè dữ liệu cũ bằng bản cũ hơn.
      if (!existing.sourceUpdatedAt || input.at >= existing.sourceUpdatedAt) {
        // Danh tính giữ nguyên khách của nó (chuyển khách chỉ qua gộp/tách có ghi nhật ký).
        await tx.customerIdentity.update({
          where: { id: existing.id },
          data: { phoneE164: phone ?? existing.phoneE164, emailNormalized: email ?? existing.emailNormalized, sourceUpdatedAt: input.at },
        });
      }
      return;
    }
    try {
      await tx.customerIdentity.create({
        data: { customerId, platform: input.platform, connectionId: input.connectionId, sourceCustomerId: input.sourceId, phoneE164: phone, emailNormalized: email, emailVerified: !!input.emailVerified, sourceUpdatedAt: input.at } as Prisma.CustomerIdentityUncheckedCreateInput,
      });
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
    return;
  }
  // Nguồn không có mã khách: giữ SĐT/email làm danh tính (một dòng cho mỗi bộ giá trị mới).
  if (!phone && !email) return;
  const same = await tx.customerIdentity.findFirst({ where: { customerId, connectionId: input.connectionId, sourceCustomerId: null, phoneE164: phone, emailNormalized: email } });
  if (!same) {
    await tx.customerIdentity.create({
      data: { customerId, platform: input.platform, connectionId: input.connectionId, phoneE164: phone, emailNormalized: email, emailVerified: !!input.emailVerified, sourceUpdatedAt: input.at } as Prisma.CustomerIdentityUncheckedCreateInput,
    });
  }
}

async function ensureAddress(tx: Client, customerId: string, country: string) {
  const has = await tx.address.findFirst({ where: { customerId, kind: "SHIPPING", countryCode: country } });
  if (!has) {
    const first = !(await tx.address.findFirst({ where: { customerId } }));
    await tx.address.create({ data: { customerId, kind: "SHIPPING", countryCode: country, raw: { country }, normalized: { country }, isDefault: first } as unknown as Prisma.AddressUncheckedCreateInput });
  }
}

/** Số đơn, lần mua đầu/cuối, REV-03 12 tháng (giao thành công − hoàn, quy USD theo tỷ giá chốt của từng đơn). */
export async function refreshCustomerStats(tx: Client, customerId: string, now = new Date()) {
  const orders = await tx.order.findMany({
    where: { customerId, status: { not: "CANCELLED" } },
    select: { bookedAt: true, deliveredAt: true, fxRate: true, refundedAmount: true, items: { select: { qtyDelivered: true, unitPrice: true } } },
  });
  const since = new Date(now.getTime() - 365 * 86400000);
  let value = new Prisma.Decimal(0);
  let delivered = 0;
  for (const o of orders) {
    const goods = o.items.reduce((s, i) => s.add(i.unitPrice.mul(i.qtyDelivered)), new Prisma.Decimal(0));
    if (goods.gt(0)) delivered++;
    if (o.deliveredAt && o.deliveredAt >= since) value = value.add(goods.sub(o.refundedAmount).mul(o.fxRate));
  }
  const times = orders.map((o) => o.bookedAt.getTime());
  await tx.customer.update({
    where: { id: customerId },
    data: {
      orderCount: orders.length,
      deliveredOrders: delivered,
      firstOrderAt: times.length ? new Date(Math.min(...times)) : null,
      lastOrderAt: times.length ? new Date(Math.max(...times)) : null,
      valueUsd12m: value.toDecimalPlaces(4),
      statsAt: now,
    },
  });
}

/** Chạy bù: gắn khách cho mọi đơn chưa có khách, theo thứ tự đặt (đơn cũ trước). */
export async function resolveAllCustomers(client: Db) {
  let done = 0;
  for (;;) {
    const batch = await client.order.findMany({
      // Chỉ đơn có liên kết chính (luôn đúng sau Phase 2); điều kiện này cũng chặn vòng lặp vô hạn.
      where: { customerId: null, links: { some: { isPrimary: true } } },
      orderBy: { bookedAt: "asc" },
      take: 200,
      include: { links: { where: { isPrimary: true }, select: { connectionId: true, platform: true, sourceUpdatedAt: true } } },
    });
    if (!batch.length) return done;
    for (const o of batch) {
      const link = o.links[0];
      if (!link) continue;
      await client.$transaction((tx) =>
        resolveCustomer(tx, { connectionId: link.connectionId, platform: link.platform, sourceId: o.customerSourceId, name: o.customerName, phone: o.customerPhone, email: o.customerEmail, country: o.shipCountry, at: link.sourceUpdatedAt }, o.id),
      );
      done++;
    }
  }
}

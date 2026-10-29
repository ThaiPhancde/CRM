// Sinh dữ liệu lớn để đo tải (D-48). CHỈ chạy trên DB riêng crm_load — từ chối nếu DATABASE_URL không trỏ vào DB tên *_load.
// Khối lượng mục tiêu một team / 12 tháng (SCALE=1): 200k khách, 600k đơn (1,2M dòng hàng, 1,5M sự kiện giao), 180k lead
// (≈500/ngày), 1,5M tương tác, 150k việc, 300k thông báo. SCALE=0.1 để thử nhanh.
// Chạy: DATABASE_URL=<…/crm_load> SCALE=1 npx tsx scripts/load/generate.ts
import { PrismaClient, type Prisma } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/\/[a-z0-9_]+_load(\?|$)/i.test(url)) throw new Error("Chỉ chạy trên DB *_load (đặt DATABASE_URL tới crm_load)");
const db = new PrismaClient();
const S = Number(process.env.SCALE ?? 1);
const N = { customers: 200_000 * S, orders: 600_000 * S, leads: 180_000 * S, activitiesPerLead: 8, tasks: 150_000 * S, notifications: 300_000 * S, sales: 20 };
const DAY = 86_400_000;
const NOW = new Date("2026-10-29T03:00:00Z").getTime();

// Ngẫu nhiên tất định (LCG) để chạy lại ra cùng dữ liệu.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

async function batch<T>(label: string, total: number, make: (i: number) => T, insert: (rows: T[]) => Promise<unknown>, size = 5000) {
  const t = Date.now();
  for (let start = 0; start < total; start += size) {
    const rows: T[] = [];
    for (let i = start; i < Math.min(total, start + size); i++) rows.push(make(i));
    await insert(rows);
  }
  console.log(`${label}: ${total.toLocaleString("vi-VN")} dòng, ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

async function main() {
  const ws = await db.workspace.upsert({ where: { code: `LOAD-${S}` }, update: {}, create: { code: `LOAD-${S}`, name: `Team tải lớn x${S}` } });
  if (await db.order.count({ where: { workspaceId: ws.id } })) {
    console.log("Đã có dữ liệu tải — bỏ qua sinh (xóa DB crm_load để sinh lại).");
    return;
  }
  const w = ws.id;
  const team = await db.team.create({ data: { workspaceId: w, code: "SALES", name: "Sales tải lớn" } });
  const brand = await db.brand.create({ data: { workspaceId: w, code: "LOADB", name: "Brand tải" } });
  const market = await db.market.create({ data: { workspaceId: w, code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } });
  const store = await db.store.create({ data: { workspaceId: w, brandId: brand.id, code: "LOAD-PK", name: "Shop tải", platform: "pancake", markets: { connect: [{ id: market.id }] } } });
  const conn = await db.connection.create({ data: { workspaceId: w, storeId: store.id, platform: "pancake", mode: "replay" } });
  await db.fxRate.create({ data: { workspaceId: w, currency: "AED", rateToBase: "7161.23", validFrom: new Date("2025-01-01") } });
  await db.setting.create({ data: { workspaceId: w, key: "leadRouting", value: { rules: [{ team: "SALES" }], maxOpenPerUser: 30, firstResponseHours: 4 } } });
  const mk = (email: string, name: string, roles: ("MANAGER" | "SALES_LEAD" | "SALES")[], teamId?: string) =>
    db.user.upsert({ where: { email }, update: {}, create: { email, name, memberships: { create: { workspaceId: w, roles, teamId } } } });
  await mk(`load-mgr-${S}@load.invalid`, "Quản lý tải", ["MANAGER"]);
  await mk(`load-lead-${S}@load.invalid`, "Trưởng nhóm tải", ["SALES_LEAD"], team.id);
  const sales: string[] = [];
  for (let i = 0; i < N.sales; i++) sales.push((await mk(`load-s${i}-${S}@load.invalid`, `Sales tải ${i}`, ["SALES"], team.id)).id);

  const cid = (i: number) => `lc${w.slice(-6)}${i}`;
  const oid = (i: number) => `lo${w.slice(-6)}${i}`;
  const lid = (i: number) => `ll${w.slice(-6)}${i}`;
  const phone = (i: number) => `+9715${String(10_000_000 + i).slice(-8)}`;

  await batch("Khách", N.customers, (i) => ({
    id: cid(i), workspaceId: w, displayName: `Khách tải ${i}`, primaryPhoneE164: phone(i), marketId: market.id,
    orderCount: 3, deliveredOrders: 2, lastOrderAt: new Date(NOW - Math.floor(rnd() * 365) * DAY), valueBase12m: String(Math.floor(rnd() * 5_000_000)), statsAt: new Date(NOW),
  }), (r) => db.customer.createMany({ data: r as Prisma.CustomerCreateManyInput[] }));
  await batch("Danh tính khách", N.customers, (i) => ({ workspaceId: w, customerId: cid(i), platform: "pancake", connectionId: conn.id, sourceCustomerId: `pc${i}`, phoneE164: phone(i) }),
    (r) => db.customerIdentity.createMany({ data: r as Prisma.CustomerIdentityCreateManyInput[] }));

  const FS = ["UNFULFILLED", "IN_TRANSIT", "DELIVERED", "DELIVERED", "DELIVERED", "FAILED", "RETURNED"] as const;
  await batch("Đơn", N.orders, (i) => {
    const net = (50 + Math.floor(rnd() * 400)).toFixed(2);
    const booked = new Date(NOW - Math.floor(rnd() * 365 * DAY));
    return {
      id: oid(i), workspaceId: w, storeId: store.id, marketId: market.id, customerId: cid(i % N.customers), orderNumber: `L${100000 + i}`,
      status: rnd() < 0.08 ? "CANCELLED" : "CONFIRMED", paymentStatus: pick(["COD_PENDING", "COD_COLLECTED", "PAID"] as const), fulfillmentStatus: pick(FS),
      currency: "AED", grossAmount: net, discount: "0", shippingFee: "0", netAmount: net, fxRate: "7161.23", fxDate: new Date("2025-01-01"),
      netBase: (Number(net) * 7161.23).toFixed(4), bookedAt: booked, customerName: `Khách tải ${i % N.customers}`, customerPhone: phone(i % N.customers),
    };
  }, (r) => db.order.createMany({ data: r as Prisma.OrderCreateManyInput[] }));
  await batch("Dòng hàng", N.orders * 2, (i) => ({ workspaceId: w, orderId: oid(i >> 1), sourceSku: `SKU-${i % 67}`, name: `Hàng ${i % 67}`, qty: 1, qtyDelivered: 1, unitPrice: "100", lineAmount: "100" }),
    (r) => db.orderItem.createMany({ data: r as Prisma.OrderItemCreateManyInput[] }));
  await batch("Liên kết nguồn", N.orders, (i) => ({ workspaceId: w, orderId: oid(i), connectionId: conn.id, platform: "pancake", sourceRecordId: `pk${i}`, orderNumberNorm: `l${100000 + i}`, sourceStatusRaw: "3", sourceUpdatedAt: new Date(NOW - (i % 365) * DAY), isPrimary: true }),
    (r) => db.sourceOrderLink.createMany({ data: r as Prisma.SourceOrderLinkCreateManyInput[] }));
  await batch("Thanh toán", N.orders, (i) => ({ workspaceId: w, orderId: oid(i), method: "cod", amount: "100", currency: "AED", status: "SUCCESS" }),
    (r) => db.payment.createMany({ data: r as Prisma.PaymentCreateManyInput[] }));
  const sid = (i: number) => `ls${w.slice(-6)}${i}`;
  await batch("Vận đơn", N.orders, (i) => ({ id: sid(i), workspaceId: w, orderId: oid(i), status: "DELIVERED", carrier: "Aramex", trackingNo: `AR${i}` }),
    (r) => db.shipment.createMany({ data: r as Prisma.ShipmentCreateManyInput[] }));
  const EV = ["PICKED", "IN_TRANSIT", "DELIVERED"] as const;
  await batch("Sự kiện giao", N.orders * 3, (i) => ({ workspaceId: w, shipmentId: sid(Math.floor(i / 3)), type: EV[i % 3], occurredAt: new Date(NOW - (i % 300) * DAY) }),
    (r) => db.deliveryEvent.createMany({ data: r as Prisma.DeliveryEventCreateManyInput[] }));

  // Lead: ≈500/ngày trong 12 tháng; lead cũ phần lớn đã đóng, 30 ngày gần nhất còn mở nhiều.
  const STAGES_OLD = ["DA_MUA", "TU_CHOI", "MAT_LIEN_LAC", "DA_MUA"] as const;
  const STAGES_NEW = ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH", "DA_MUA", "TU_CHOI"] as const;
  await batch("Lead", N.leads, (i) => {
    const age = Math.floor((i / N.leads) * 365);
    const created = new Date(NOW - (365 - age) * DAY + Math.floor(rnd() * DAY));
    const recent = NOW - created.getTime() < 30 * DAY;
    const stage = recent ? pick(STAGES_NEW) : pick(STAGES_OLD);
    const open = ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH"].includes(stage);
    return {
      id: lid(i), workspaceId: w, contactName: `Lead tải ${i}`, contactPhoneE164: phone((i * 7) % (N.customers * 2)), source: pick(["inbox", "ads", "website"]),
      brandId: brand.id, marketId: market.id, stage, lostReason: stage === "TU_CHOI" || stage === "MAT_LIEN_LAC" ? "Tải: không mua" : null,
      teamId: team.id, ownerId: rnd() < 0.97 ? pick(sales) : null, customerId: i % 3 === 0 ? cid(i % N.customers) : null,
      createdAt: created, firstResponseDueAt: new Date(created.getTime() + 4 * 3600_000), firstRespondedAt: stage === "MOI" ? null : new Date(created.getTime() + 3600_000),
      closedAt: open ? null : new Date(created.getTime() + 3 * DAY), nextActionAt: open && stage !== "MOI" ? new Date(NOW + (Math.floor(rnd() * 5) - 2) * DAY) : null,
    };
  }, (r) => db.lead.createMany({ data: r as Prisma.LeadCreateManyInput[] }));
  await batch("Phân công", N.leads, (i) => ({ workspaceId: w, leadId: lid(i), toUserId: pick(sales), teamId: team.id, reason: "Tự động" }),
    (r) => db.assignment.createMany({ data: r as Prisma.AssignmentCreateManyInput[] }));
  await batch("Tương tác", N.leads * N.activitiesPerLead, (i) => {
    const l = Math.floor(i / N.activitiesPerLead);
    return { workspaceId: w, type: i % 4 === 0 ? "CALL" : "MESSAGE", direction: i % 2 ? "OUT" : "IN", channel: "WHATSAPP", leadId: lid(l), customerId: l % 3 === 0 ? cid(l % N.customers) : null, actorId: i % 2 ? pick(sales) : null, body: `Tin nhắn tải ${i}`, occurredAt: new Date(NOW - (365 - Math.floor((l / N.leads) * 365)) * DAY + (i % 8) * 3600_000) };
  }, (r) => db.activity.createMany({ data: r as Prisma.ActivityCreateManyInput[] }), 10000);
  await batch("Việc", N.tasks, (i) => ({ workspaceId: w, type: "FOLLOW_UP", title: `Việc tải ${i}`, dueAt: new Date(NOW + (Math.floor(rnd() * 60) - 50) * DAY), status: rnd() < 0.1 ? "OPEN" : "DONE", assigneeId: pick(sales), leadId: lid(i % N.leads), customerId: i % 3 === 0 ? cid(i % N.customers) : null, remindedAt: new Date(NOW) }),
    (r) => db.task.createMany({ data: r as Prisma.TaskCreateManyInput[] }));
  await batch("Thông báo", N.notifications, (i) => ({ workspaceId: w, userId: pick(sales), title: `Thông báo tải ${i}`, idempotencyKey: `load:${i}`, readAt: rnd() < 0.8 ? new Date(NOW) : null }),
    (r) => db.notification.createMany({ data: r as Prisma.NotificationCreateManyInput[] }));
  await db.$executeRawUnsafe("ANALYZE");
}

main().finally(() => db.$disconnect());

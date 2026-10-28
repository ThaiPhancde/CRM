// Shopify — mapper bản ghi gốc → đơn chuẩn.
// MỨC XÁC MINH: TL. Tên trường theo Admin GraphQL `Order` công khai (name, displayFinancialStatus, lineItems, fulfillments…)
// nhưng đã GIẢN LƯỢC (tiền dạng chuỗi thay MoneyBag, sự kiện giao hàng gộp) và chưa chạy với API thật. Phase 12 đối chiếu.
import { z } from "zod";
import { normalizedOrder, type NormalizedOrder, type Platform } from "./types";

const FIN: Record<string, NormalizedOrder["paymentStatus"]> = {
  PENDING: "PENDING", AUTHORIZED: "PENDING", PAID: "PAID", PARTIALLY_PAID: "PARTIAL",
  REFUNDED: "REFUNDED", PARTIALLY_REFUNDED: "REFUNDED", VOIDED: "PENDING",
};
const EVENT: Record<string, NormalizedOrder["shipments"][number]["events"][number]["type"]> = {
  CONFIRMED: "PICKED", IN_TRANSIT: "IN_TRANSIT", OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY", DELIVERED: "DELIVERED",
  FAILURE: "FAILED", ATTEMPTED_DELIVERY: "FAILED",
};

const raw = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  processedAt: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  displayFinancialStatus: z.string(),
  displayFulfillmentStatus: z.string(),
  currencyCode: z.string(),
  customer: z.object({ id: z.string(), firstName: z.string().nullish(), lastName: z.string().nullish(), email: z.string().nullish(), phone: z.string().nullish() }).nullish(),
  shippingAddress: z.object({ countryCodeV2: z.string(), phone: z.string().nullish() }).nullish(),
  lineItems: z.array(z.object({ sku: z.string(), title: z.string(), quantity: z.number(), originalUnitPrice: z.string(), fulfilledQuantity: z.number().optional(), returnedQuantity: z.number().optional() })),
  totalDiscounts: z.string().default("0"),
  totalShipping: z.string().default("0"),
  tags: z.array(z.string()).default([]),
  note: z.string().nullish(),
  transactions: z.array(z.object({ kind: z.string(), status: z.string(), gateway: z.string(), amount: z.string(), processedAt: z.string().nullish() })).default([]),
  refunds: z.array(z.object({ createdAt: z.string(), totalRefunded: z.string(), note: z.string().nullish() })).default([]),
  fulfillments: z.array(z.object({
    trackingCompany: z.string().nullish(),
    trackingNumber: z.string().nullish(),
    events: z.array(z.object({ status: z.string(), happenedAt: z.string() })),
  })).default([]),
});

/** Tag dạng "<nền tảng>:<mã>" coi là tham chiếu chéo, ví dụ "ref:PK-20931" → "pk-20931". */
const refsIn = (tags: string[]) => tags.filter((t) => t.includes(":")).map((t) => t.split(":")[1].trim().toLowerCase()).filter(Boolean);

export const shopify: Platform = {
  code: "shopify",
  label: "Shopify",
  verification: "TL",
  capabilities: { read: ["order"], write: [], incremental: "both" },
  peek(r) {
    const p = raw.pick({ id: true, updatedAt: true }).safeParse(r);
    return p.success ? { sourceRecordId: p.data.id, sourceUpdatedAt: new Date(p.data.updatedAt) } : null;
  },
  map(r) {
    const o = raw.parse(r);
    const paymentStatus = FIN[o.displayFinancialStatus];
    if (!paymentStatus) throw new Error(`Trạng thái thanh toán Shopify chưa ánh xạ: ${o.displayFinancialStatus}`);
    const name = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ");
    return normalizedOrder.parse({
      recordType: "order",
      sourceRecordId: o.id,
      sourceUpdatedAt: o.updatedAt,
      sourceStatusRaw: `${o.displayFinancialStatus}/${o.displayFulfillmentStatus}${o.cancelledAt ? "/CANCELLED" : ""}`,
      orderNumber: o.name,
      refs: refsIn(o.tags),
      currency: o.currencyCode,
      shipCountry: o.shippingAddress?.countryCodeV2,
      bookedAt: o.createdAt,
      // Shopify: đơn trả trước được coi là xác nhận khi đã xử lý thanh toán.
      confirmedAt: o.processedAt ?? undefined,
      cancelledAt: o.cancelledAt ?? undefined,
      status: o.cancelledAt ? "CANCELLED" : o.processedAt ? "CONFIRMED" : "BOOKED",
      paymentStatus,
      customer: { sourceId: o.customer?.id, name: name || undefined, phone: o.customer?.phone ?? o.shippingAddress?.phone ?? undefined, email: o.customer?.email ?? undefined },
      items: o.lineItems.map((i) => ({ sourceSku: i.sku, name: i.title, qty: i.quantity, unitPrice: i.originalUnitPrice, qtyDelivered: i.fulfilledQuantity ?? 0, qtyReturned: i.returnedQuantity ?? 0 })),
      discount: o.totalDiscounts,
      shippingFee: o.totalShipping,
      payments: o.transactions.filter((t) => t.kind === "SALE" && t.status === "SUCCESS").map((t) => ({ method: t.gateway, amount: t.amount, status: "paid", paidAt: t.processedAt ?? undefined })),
      refunds: o.refunds.map((x) => ({ amount: x.totalRefunded, at: x.createdAt, reason: x.note ?? undefined })),
      shipments: o.fulfillments.map((f) => ({
        carrier: f.trackingCompany ?? undefined,
        trackingNo: f.trackingNumber ?? undefined,
        events: f.events.map((e) => {
          const type = EVENT[e.status];
          if (!type) throw new Error(`Sự kiện giao hàng Shopify chưa ánh xạ: ${e.status}`);
          return { type, at: e.happenedAt };
        }),
      })),
    });
  },
};

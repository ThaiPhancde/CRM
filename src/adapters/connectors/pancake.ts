// Pancake POS — mapper bản ghi gốc → đơn chuẩn.
// MỨC XÁC MINH: CXM. Chưa có tài liệu API chính thức được xác minh (docs/integrations.md mục 1). Hình dạng bản ghi dưới đây là
// ĐỊNH DẠNG PHÁT LẠI GIẢ ĐỊNH cho demo; Phase 12 phải đối chiếu tài liệu/đối tác rồi sửa riêng file này (mapper + test).
import { z } from "zod";
import { normalizedOrder, type NormalizedOrder, type Platform } from "./types";

// Mã trạng thái giả định của định dạng phát lại.
const STATUS: Record<number, { label: string; status: NormalizedOrder["status"] }> = {
  0: { label: "moi", status: "BOOKED" },
  1: { label: "da_xac_nhan", status: "CONFIRMED" },
  2: { label: "dang_giao", status: "CONFIRMED" },
  3: { label: "da_giao", status: "CONFIRMED" },
  4: { label: "hoan", status: "CONFIRMED" },
  5: { label: "huy", status: "CANCELLED" },
  6: { label: "giao_loi", status: "CONFIRMED" },
};
const EVENT: Record<string, NormalizedOrder["shipments"][number]["events"][number]["type"]> = {
  picked: "PICKED", in_transit: "IN_TRANSIT", delivering: "OUT_FOR_DELIVERY", delivered: "DELIVERED",
  failed: "FAILED", returned: "RETURNED", cod_collected: "COD_COLLECTED",
};

const raw = z.object({
  id: z.string(),
  order_code: z.string(),
  status: z.number().int(),
  inserted_at: z.string(),
  updated_at: z.string(),
  confirmed_at: z.string().nullish(),
  currency: z.string(),
  is_cod: z.boolean(),
  customer: z.object({ id: z.string().nullish(), name: z.string().nullish(), phone_number: z.string().nullish(), email: z.string().nullish() }),
  shipping_address: z.object({ country_code: z.string() }).nullish(),
  items: z.array(z.object({ sku: z.string(), name: z.string(), quantity: z.number(), price: z.string(), delivered_quantity: z.number().optional(), returned_quantity: z.number().optional() })),
  total_discount: z.string().default("0"),
  shipping_fee: z.string().default("0"),
  cod_amount: z.string().nullish(),
  payments: z.array(z.object({ method: z.string(), amount: z.string(), paid_at: z.string().nullish() })).default([]),
  refunds: z.array(z.object({ amount: z.string(), at: z.string(), reason: z.string().nullish() })).default([]),
  partner: z.object({ name: z.string(), tracking_code: z.string().nullish(), events: z.array(z.object({ status: z.string(), at: z.string(), reason: z.string().nullish() })) }).nullish(),
  note: z.string().nullish(),
});

/** Mã tham chiếu đơn ở nền tảng khác trong ghi chú, ví dụ "Shopify #1042" → "1042". */
const refsIn = (note?: string | null) => [...(note ?? "").matchAll(/#\s?([A-Za-z0-9-]{3,})/g)].map((m) => m[1].toLowerCase());

export const pancake: Platform = {
  code: "pancake",
  label: "Pancake POS",
  verification: "CXM",
  capabilities: { read: ["order"], write: [], incremental: "polling" },
  peek(r) {
    const p = raw.pick({ id: true, updated_at: true }).safeParse(r);
    return p.success ? { sourceRecordId: p.data.id, sourceUpdatedAt: new Date(p.data.updated_at) } : null;
  },
  map(r) {
    const o = raw.parse(r);
    const st = STATUS[o.status];
    if (!st) throw new Error(`Mã trạng thái Pancake chưa ánh xạ: ${o.status}`);
    const events = (o.partner?.events ?? []).map((e) => {
      const type = EVENT[e.status];
      if (!type) throw new Error(`Sự kiện giao hàng Pancake chưa ánh xạ: ${e.status}`);
      return { type, at: e.at, reasonCode: e.reason ?? undefined };
    });
    const paid = o.payments.length > 0;
    const collected = events.some((e) => e.type === "COD_COLLECTED");
    const paymentStatus: NormalizedOrder["paymentStatus"] = o.refunds.length
      ? "REFUNDED"
      : o.is_cod ? (collected ? "COD_COLLECTED" : "COD_PENDING") : paid ? "PAID" : "PENDING";
    return normalizedOrder.parse({
      recordType: "order",
      sourceRecordId: o.id,
      sourceUpdatedAt: o.updated_at,
      sourceStatusRaw: `${o.status}:${st.label}`,
      orderNumber: o.order_code,
      refs: refsIn(o.note),
      currency: o.currency,
      shipCountry: o.shipping_address?.country_code,
      bookedAt: o.inserted_at,
      confirmedAt: o.confirmed_at ?? undefined,
      cancelledAt: st.status === "CANCELLED" ? o.updated_at : undefined,
      status: st.status,
      paymentStatus,
      customer: { sourceId: o.customer.id ?? undefined, name: o.customer.name ?? undefined, phone: o.customer.phone_number ?? undefined, email: o.customer.email ?? undefined },
      items: o.items.map((i) => ({ sourceSku: i.sku, name: i.name, qty: i.quantity, unitPrice: i.price, qtyDelivered: i.delivered_quantity ?? 0, qtyReturned: i.returned_quantity ?? 0 })),
      discount: o.total_discount,
      shippingFee: o.shipping_fee,
      payments: o.payments.map((p) => ({ method: p.method, amount: p.amount, status: "paid", paidAt: p.paid_at ?? undefined })),
      refunds: o.refunds.map((x) => ({ amount: x.amount, at: x.at, reason: x.reason ?? undefined })),
      shipments: o.partner ? [{ carrier: o.partner.name, trackingNo: o.partner.tracking_code ?? undefined, codAmount: o.is_cod ? (o.cod_amount ?? undefined) : undefined, events }] : [],
    });
  },
};

// Hợp đồng chung của mọi connector (D-28): adapter chỉ đổi bản ghi gốc của nền tảng → NormalizedOrder.
// Phần chống trùng, cập nhật muộn, liên kết hai nguồn nằm ở src/modules/orders/ingest.ts, không ở adapter.
import { z } from "zod";

const money = z.string().regex(/^-?\d+(\.\d+)?$/, "số tiền dạng chuỗi thập phân");
const date = z.coerce.date();

export const deliveryEventTypes = ["PICKED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED", "COD_COLLECTED"] as const;

export const normalizedOrder = z.object({
  recordType: z.literal("order"),
  sourceRecordId: z.string().min(1),
  sourceUpdatedAt: date,
  /// Trạng thái nguyên bản của nguồn (giữ để truy vết, HLD §4).
  sourceStatusRaw: z.string(),
  orderNumber: z.string().min(1),
  /// Mã tham chiếu tới đơn ở nền tảng khác mà mapper tìm thấy (ghi chú, tag…). Dùng cho linkRules.
  refs: z.array(z.string()).default([]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  shipCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
  bookedAt: date,
  confirmedAt: date.optional(),
  cancelledAt: date.optional(),
  status: z.enum(["BOOKED", "CONFIRMED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIAL", "REFUNDED", "COD_PENDING", "COD_COLLECTED"]),
  customer: z.object({
    sourceId: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  items: z.array(z.object({
    sourceSku: z.string().min(1),
    name: z.string(),
    qty: z.number().int().positive(),
    unitPrice: money,
    qtyDelivered: z.number().int().min(0).default(0),
    qtyReturned: z.number().int().min(0).default(0),
  }).refine((i) => i.qtyDelivered <= i.qty && i.qtyReturned <= i.qtyDelivered, "số giao/hoàn vượt số đặt")).min(1),
  discount: money.default("0"),
  shippingFee: money.default("0"),
  payments: z.array(z.object({ method: z.string(), amount: money, status: z.string(), paidAt: date.optional() })).default([]),
  refunds: z.array(z.object({ amount: money, at: date, reason: z.string().optional() })).default([]),
  shipments: z.array(z.object({
    carrier: z.string().optional(),
    trackingNo: z.string().optional(),
    codAmount: money.optional(),
    events: z.array(z.object({ type: z.enum(deliveryEventTypes), at: date, reasonCode: z.string().optional() })).default([]),
  })).default([]),
});
export type NormalizedOrder = z.infer<typeof normalizedOrder>;

/** Một bản ghi gốc nhận từ nguồn, kèm thời điểm hệ thống nhìn thấy nó (để phát lại đúng thứ tự, kể cả bản đến muộn). */
export type RawEvent = { visibleAt: Date; record: unknown };

export type Capabilities = { read: string[]; write: string[]; incremental: "polling" | "webhook" | "both" };

/** Một nền tảng = một mapper (dùng chung cho replay và live) + nguồn dữ liệu live (khung, Phase 12). */
export type Platform = {
  code: string;
  label: string;
  capabilities: Capabilities;
  /** Bản ghi gốc → đơn chuẩn. Ném lỗi khi bản ghi không đủ để chuẩn hóa. */
  map(raw: unknown): NormalizedOrder;
  /** Khóa duy nhất của bản ghi gốc ở nguồn, dùng khi map lỗi để vẫn ghi SourceEvent truy vết được. */
  peek(raw: unknown): { sourceRecordId: string; sourceUpdatedAt: Date } | null;
  /** Mức xác minh API thật: XM đã chạy thật · TL theo tài liệu công khai · CXM chưa có tài liệu (docs/integrations.md). */
  verification: "XM" | "TL" | "CXM";
};

/** Chuẩn hóa mã để so liên kết: bỏ #, khoảng trắng; chữ thường. */
export const normRef = (s: string) => s.toLowerCase().replace(/[#\s]/g, "");

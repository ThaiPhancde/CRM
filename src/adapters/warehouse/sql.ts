// SQL chỉ số viết MỘT lần, sinh cho hai phương ngữ (D-05): PostgreSQL (demo, chạy thật) và BigQuery (Phase 12).
// Chỉ dùng phần chung: CTE, CASE, COALESCE, NTILE() OVER, CAST, ||. Khác biệt gom vào `Dialect` (tên bảng/cột, tham số, phép tính ngày).
export type DialectName = "postgres" | "bigquery";

export type Dialect = {
  name: DialectName;
  /** Bảng: Postgres "Order"; BigQuery `dataset.Order`. */
  t(table: string): string;
  /** Cột: Postgres "customerId"; BigQuery customerId. */
  c(col: string): string;
  /** Tham số có tên @x → Postgres $n (theo thứ tự) / BigQuery @x. */
  bind(sql: string, params: Record<string, unknown>): { sql: string; values: unknown[] };
  /** Số ngày (thực) từ b tới a. */
  daysBetween(a: string, b: string): string;
  /** Mốc thời gian x lùi n ngày. */
  minusDays(x: string, n: number): string;
  plusDays(x: string, n: number): string;
  ts(x: string): string;
};

export function dialect(name: DialectName, dataset = "crm"): Dialect {
  if (name === "postgres") {
    return {
      name,
      t: (x) => `"${x}"`,
      c: (x) => `"${x}"`,
      bind(sql, params) {
        const order: string[] = [];
        const out = sql.replace(/@([a-zA-Z]\w*)/g, (_, k: string) => {
          if (!(k in params)) throw new Error(`Thiếu tham số @${k}`);
          if (!order.includes(k)) order.push(k);
          return `$${order.indexOf(k) + 1}`;
        });
        return { sql: out, values: order.map((k) => params[k]) };
      },
      daysBetween: (a, b) => `(EXTRACT(EPOCH FROM (${a} - ${b})) / 86400.0)`,
      minusDays: (x, n) => `(${x} - INTERVAL '${n} days')`,
      plusDays: (x, n) => `(${x} + INTERVAL '${n} days')`,
      // Cột Prisma lưu UTC (timestamp không múi giờ); tham số phải quy về UTC, không theo múi giờ phiên DB (máy dev +7).
      ts: (x) => `(CAST(${x} AS TIMESTAMPTZ) AT TIME ZONE 'UTC')`,
    };
  }
  return {
    name,
    t: (x) => `\`${dataset}.${x}\``,
    c: (x) => x,
    bind: (sql, params) => ({ sql, values: [params] }),
    daysBetween: (a, b) => `(TIMESTAMP_DIFF(${a}, ${b}, SECOND) / 86400.0)`,
    minusDays: (x, n) => `TIMESTAMP_SUB(${x}, INTERVAL ${n} DAY)`,
    plusDays: (x, n) => `TIMESTAMP_ADD(${x}, INTERVAL ${n} DAY)`,
    ts: (x) => `CAST(${x} AS TIMESTAMP)`,
  };
}

/** Lý do giao thất bại thuộc về khách (Q-27 mặc định) — lỗi hãng vận chuyển không tính vào rủi ro khách (HLD §7.3). */
export const CUSTOMER_FAILURE_REASONS = ["customer_refused", "unreachable", "wrong_address"];

/**
 * Chỉ số khách kỳ R12M tới @asOf cho một team (@ws). Trả một dòng/khách có ít nhất một đơn (CustomerMetric).
 * Định nghĩa theo docs/metrics.md: REV-01 đặt (không hủy, theo bookedAt), REV-02 xác nhận (theo confirmedAt), REV-03 phần đã giao − hoàn
 * (theo deliveredAt), REV-04 thanh toán thành công − hoàn (COD đã đối soát có ở Phase 10), RFM ngũ phân vị trong team.
 */
export function customerMetricsSelect(d: Dialect): string {
  const { t, c } = d;
  const asOf = d.ts("@asOf");
  const since = d.minusDays(asOf, 365);
  const reasons = CUSTOMER_FAILURE_REASONS.map((r) => `'${r}'`).join(", ");
  return `
WITH cust AS (
  SELECT ${c("id")} AS id, ${c("primaryPhoneE164")} AS phone FROM ${t("Customer")}
  WHERE ${c("workspaceId")} = @ws AND ${c("mergedIntoId")} IS NULL
),
ord AS (
  SELECT o.${c("id")} AS id, o.${c("customerId")} AS customer_id, o.${c("status")} AS status, o.${c("bookedAt")} AS booked_at,
         COALESCE(o.${c("confirmedAt")}, o.${c("bookedAt")}) AS confirmed_at, o.${c("deliveredAt")} AS delivered_at,
         o.${c("fxRate")} AS fx, o.${c("netBase")} AS net_base, o.${c("refundedAmount")} AS refunded, o.${c("fulfillmentStatus")} AS fstatus
  FROM ${t("Order")} o JOIN cust ON cust.id = o.${c("customerId")}
  WHERE o.${c("workspaceId")} = @ws AND o.${c("bookedAt")} <= ${asOf}
),
fx_now AS (
  SELECT f.${c("currency")} AS currency, f.${c("rateToBase")} AS rate FROM ${t("FxRate")} f
  WHERE f.${c("workspaceId")} = @ws AND f.${c("validFrom")} = (
    SELECT MAX(f2.${c("validFrom")}) FROM ${t("FxRate")} f2 WHERE f2.${c("workspaceId")} = @ws AND f2.${c("currency")} = f.${c("currency")} AND f2.${c("validFrom")} <= ${asOf})
),
goods AS (
  SELECT i.${c("orderId")} AS order_id,
         SUM(i.${c("qtyDelivered")} * i.${c("unitPrice")}) AS delivered_value,
         SUM(i.${c("qtyDelivered")} * v.${c("costPrice")} * fx_now.rate) AS cost_base,
         SUM(CASE WHEN i.${c("qtyDelivered")} > 0 AND (v.${c("costPrice")} IS NULL OR fx_now.rate IS NULL) THEN 1 ELSE 0 END) AS missing_cost
  FROM ${t("OrderItem")} i JOIN ord ON ord.id = i.${c("orderId")}
  LEFT JOIN ${t("Variant")} v ON v.${c("id")} = i.${c("variantId")}
  LEFT JOIN fx_now ON fx_now.currency = v.${c("costCurrency")}
  GROUP BY i.${c("orderId")}
),
pay AS (
  SELECT p.${c("orderId")} AS order_id, SUM(p.${c("amount")}) AS paid FROM ${t("Payment")} p JOIN ord ON ord.id = p.${c("orderId")}
  WHERE UPPER(p.${c("status")}) IN ('SUCCESS', 'PAID', 'COMPLETED') AND COALESCE(p.${c("paidAt")}, ord.booked_at) > ${since} AND COALESCE(p.${c("paidAt")}, ord.booked_at) <= ${asOf}
  GROUP BY p.${c("orderId")}
),
ref AS (
  SELECT r.${c("orderId")} AS order_id, SUM(r.${c("amount")}) AS refunded FROM ${t("Refund")} r JOIN ord ON ord.id = r.${c("orderId")}
  WHERE r.${c("refundedAt")} > ${since} AND r.${c("refundedAt")} <= ${asOf}
  GROUP BY r.${c("orderId")}
),
cfail AS (
  SELECT DISTINCT s.${c("orderId")} AS order_id FROM ${t("Shipment")} s
  JOIN ${t("DeliveryEvent")} e ON e.${c("shipmentId")} = s.${c("id")}
  JOIN ord ON ord.id = s.${c("orderId")}
  WHERE e.${c("type")} = 'FAILED' AND e.${c("reasonCode")} IN (${reasons})
),
per_order AS (
  SELECT ord.*, COALESCE(g.delivered_value, 0) AS delivered_value, g.cost_base, COALESCE(g.missing_cost, 0) AS missing_cost,
         COALESCE(pay.paid, 0) AS paid, COALESCE(ref.refunded, 0) AS refunded_win,
         CASE WHEN cfail.order_id IS NULL THEN 0 ELSE 1 END AS customer_failed,
         CASE WHEN ord.delivered_at IS NOT NULL AND COALESCE(g.delivered_value, 0) > 0 THEN 1 ELSE 0 END AS valid
  FROM ord LEFT JOIN goods g ON g.order_id = ord.id LEFT JOIN pay ON pay.order_id = ord.id LEFT JOIN ref ON ref.order_id = ord.id
  LEFT JOIN cfail ON cfail.order_id = ord.id
),
agg AS (
  SELECT customer_id,
    SUM(CASE WHEN status <> 'CANCELLED' AND booked_at > ${since} THEN 1 ELSE 0 END) AS orders,
    SUM(CASE WHEN valid = 1 AND delivered_at > ${since} THEN 1 ELSE 0 END) AS delivered_orders,
    SUM(CASE WHEN status = 'CONFIRMED' AND confirmed_at > ${since} THEN 1 ELSE 0 END) AS confirmed_orders,
    SUM(CASE WHEN customer_failed = 1 AND status = 'CONFIRMED' AND confirmed_at > ${since} THEN 1 ELSE 0 END) AS failed_by_customer,
    SUM(CASE WHEN status <> 'CANCELLED' AND booked_at > ${since} THEN net_base ELSE 0 END) AS rev01,
    SUM(CASE WHEN status = 'CONFIRMED' AND confirmed_at > ${since} THEN net_base ELSE 0 END) AS rev02,
    SUM(CASE WHEN valid = 1 AND delivered_at > ${since} THEN (delivered_value - refunded) * fx ELSE 0 END) AS rev03,
    SUM((paid - refunded_win) * fx) AS rev04,
    SUM(refunded_win * fx) AS refunds,
    SUM(CASE WHEN valid = 1 AND delivered_at > ${since} THEN delivered_value * fx - COALESCE(cost_base, 0) ELSE 0 END) AS gross_profit,
    SUM(CASE WHEN valid = 1 AND delivered_at > ${since} THEN missing_cost ELSE 0 END) AS missing_cost,
    MIN(booked_at) AS first_order_at,
    MAX(CASE WHEN valid = 1 THEN delivered_at END) AS last_valid_at,
    MIN(CASE WHEN valid = 1 THEN delivered_at END) AS first_valid_at,
    SUM(valid) AS valid_lifetime
  FROM per_order GROUP BY customer_id
),
rep AS (
  SELECT p.customer_id, SUM(CASE WHEN p.delivered_at <= ${d.plusDays("a.first_valid_at", 60)} THEN 1 ELSE 0 END) AS within60
  FROM per_order p JOIN agg a ON a.customer_id = p.customer_id WHERE p.valid = 1 GROUP BY p.customer_id
),
tk AS (
  SELECT k.${c("customerId")} AS customer_id, COUNT(*) AS open_tickets,
    MAX(CASE k.${c("priority")} WHEN 'KHAN' THEN 4 WHEN 'CAO' THEN 3 WHEN 'TRUNG' THEN 2 ELSE 1 END) AS max_priority,
    MIN(k.${c("createdAt")}) AS oldest_open
  FROM ${t("Ticket")} k WHERE k.${c("workspaceId")} = @ws AND k.${c("status")} IN ('MOI', 'DANG_XU_LY', 'CHO_KHACH') AND k.${c("customerId")} IS NOT NULL
  GROUP BY k.${c("customerId")}
),
base AS (
  SELECT a.*, CASE WHEN a.last_valid_at IS NULL THEN NULL ELSE CAST(FLOOR(${d.daysBetween(asOf, "a.last_valid_at")}) AS INTEGER) END AS recency_days,
    CASE WHEN a.valid_lifetime >= 2 THEN ${d.daysBetween("a.last_valid_at", "a.first_valid_at")} / (a.valid_lifetime - 1) END AS avg_cycle_days,
    CASE WHEN COALESCE(rep.within60, 0) >= 2 THEN 1 ELSE 0 END AS repurchase60,
    COALESCE(tk.open_tickets, 0) AS open_tickets, COALESCE(tk.max_priority, 0) AS max_open_priority, tk.oldest_open
  FROM agg a LEFT JOIN rep ON rep.customer_id = a.customer_id LEFT JOIN tk ON tk.customer_id = a.customer_id
),
rfm AS (
  SELECT customer_id,
    NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
    NTILE(5) OVER (ORDER BY delivered_orders ASC) AS f_score,
    NTILE(5) OVER (ORDER BY rev03 ASC) AS m_score
  FROM base WHERE delivered_orders > 0
)
SELECT base.customer_id, base.orders, base.delivered_orders, base.failed_by_customer, base.confirmed_orders,
  base.rev01, base.rev02, base.rev03, base.rev04, base.refunds,
  CASE WHEN base.missing_cost > 0 THEN NULL ELSE base.gross_profit END AS gross_profit,
  base.first_order_at, base.last_valid_at, base.recency_days, base.avg_cycle_days, base.repurchase60,
  rfm.r_score, rfm.f_score, rfm.m_score, base.open_tickets, base.max_open_priority, base.oldest_open
FROM base LEFT JOIN rfm ON rfm.customer_id = base.customer_id`;
}

/** Ghi kết quả vào CustomerMetric phía DB (Postgres: INSERT … SELECT; BigQuery dùng MERGE ở Phase 12). */
export function customerMetricsInsert(d: Dialect): string {
  const { t, c } = d;
  const cols = ["id", "workspaceId", "customerId", "period", "asOf", "createdAt", "orders", "deliveredOrders", "failedByCustomer", "confirmedOrders", "rev01", "rev02", "rev03", "rev04", "refunds", "grossProfit", "firstOrderAt", "lastValidOrderAt", "recencyDays", "avgCycleDays", "repurchase60", "rScore", "fScore", "mScore", "openTickets", "maxOpenPriority", "oldestOpenTicketAt"];
  return `INSERT INTO ${t("CustomerMetric")} (${cols.map(c).join(", ")})
SELECT @ws || ':' || m.customer_id || ':R12M', @ws, m.customer_id, 'R12M', ${d.ts("@asOf")}, ${d.ts("@asOf")}, m.orders, m.delivered_orders, m.failed_by_customer, m.confirmed_orders,
  m.rev01, m.rev02, m.rev03, m.rev04, m.refunds, m.gross_profit, m.first_order_at, m.last_valid_at, m.recency_days, m.avg_cycle_days,
  m.repurchase60 = 1, m.r_score, m.f_score, m.m_score, m.open_tickets, m.max_open_priority, m.oldest_open
FROM (${customerMetricsSelect(d)}) m`;
}

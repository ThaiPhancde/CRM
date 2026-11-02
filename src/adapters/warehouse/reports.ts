// SQL báo cáo (Phase 9) — viết một lần cho Postgres (demo, chạy thật) và BigQuery (Phase 12), như sql.ts.
// Mỗi chỉ số lấy theo ĐÚNG mốc thời gian của nó (docs/metrics.md): REV-01 bookedAt, REV-02 confirmedAt, REV-03 deliveredAt, REV-04 ngày thu.
// Kỳ [@from, @to): @to là 00:00 UTC NGÀY SAU ngày cuối — cùng cách /don-hang lọc ngày, để tổng hai nơi khớp nhau.
import type { Dialect } from "./sql";

export type RevenueGroup = "none" | "brand" | "market" | "store" | "month" | "currency" | "brand_market";
export const PAID_STATUSES = "'SUCCESS', 'PAID', 'COMPLETED'";

/** Bộ lọc chung trên đơn: workspace + brand/store/market tùy chọn (null = mọi). */
function orderBase(d: Dialect) {
  const c = d.c;
  return `SELECT o.${c("id")} AS id, o.${c("status")} AS status, o.${c("bookedAt")} AS b, COALESCE(o.${c("confirmedAt")}, o.${c("bookedAt")}) AS cf,
    o.${c("deliveredAt")} AS dl, o.${c("fxRate")} AS fx, o.${c("netBase")} AS nb, o.${c("netAmount")} AS na, COALESCE(o.${c("refundedAmount")}, 0) AS rf,
    o.${c("currency")} AS cur, o.${c("marketId")} AS mk, o.${c("storeId")} AS st, s.${c("brandId")} AS br, o.${c("customerId")} AS cu,
    o.${c("fulfillmentStatus")} AS fs, o.${c("paymentStatus")} AS ps
  FROM ${d.t("Order")} o JOIN ${d.t("Store")} s ON s.${c("id")} = o.${c("storeId")}
  WHERE o.${c("workspaceId")} = @ws AND ${d.opt("store", `o.${c("storeId")}`)} AND ${d.opt("market", `o.${c("marketId")}`)} AND ${d.opt("brand", `s.${c("brandId")}`)}`;
}
const inRange = (d: Dialect, x: string) => `${x} >= ${d.ts("@from")} AND ${x} < ${d.ts("@to")}`;

function key(d: Dialect, g: RevenueGroup, at: string) {
  switch (g) {
    case "month": return d.month(at);
    case "brand": return "COALESCE(o.br, '—')";
    case "market": return "COALESCE(o.mk, '—')";
    case "store": return "o.st";
    case "currency": return "o.cur";
    case "brand_market": return "COALESCE(o.br, '—') || '|' || COALESCE(o.mk, '—')";
    default: return "'all'";
  }
}

/**
 * REV-01..04 + số đơn theo nhóm. Cột o01/o03 = nguyên tệ (có nghĩa khi nhóm theo tiền tệ); v0x = VND quy đổi theo tỷ giá chốt của đơn (D-44).
 * REV-03 = (Σ qtyDelivered × unitPrice − hoàn) × tỷ giá, đơn có deliveredAt trong kỳ — giống công thức CustomerMetric (sql.ts).
 */
export function revenueSql(d: Dialect, g: RevenueGroup) {
  const c = d.c;
  const zero = (n: number) => Array(n).fill("0").join(", ");
  return `WITH o AS (${orderBase(d)}),
g AS (
  SELECT i.${c("orderId")} AS oid, SUM(i.${c("qtyDelivered")} * i.${c("unitPrice")}) AS dv
  FROM ${d.t("OrderItem")} i JOIN o ON o.id = i.${c("orderId")} WHERE o.dl IS NOT NULL AND ${inRange(d, "o.dl")}
  GROUP BY i.${c("orderId")}
),
r AS (
  SELECT ${key(d, g, "o.b")} AS k, o.nb AS v01, o.na AS o01, 1 AS n01, 0 AS v02, 0 AS n02, 0 AS v03, 0 AS o03, 0 AS n03, 0 AS v04, 0 AS rfd FROM o WHERE o.status <> 'CANCELLED' AND ${inRange(d, "o.b")}
  UNION ALL SELECT ${key(d, g, "o.cf")}, 0, 0, 0, o.nb, 1, ${zero(5)} FROM o WHERE o.status = 'CONFIRMED' AND ${inRange(d, "o.cf")}
  UNION ALL SELECT ${key(d, g, "o.dl")}, 0, 0, 0, 0, 0, (g.dv - o.rf) * o.fx, g.dv - o.rf, 1, 0, 0 FROM o JOIN g ON g.oid = o.id WHERE g.dv > 0
  UNION ALL SELECT ${key(d, g, `COALESCE(p.${c("paidAt")}, o.b)`)}, ${zero(8)}, p.${c("amount")} * o.fx, 0 FROM ${d.t("Payment")} p JOIN o ON o.id = p.${c("orderId")}
    WHERE UPPER(p.${c("status")}) IN (${PAID_STATUSES}) AND ${inRange(d, `COALESCE(p.${c("paidAt")}, o.b)`)}
  UNION ALL SELECT ${key(d, g, `x.${c("refundedAt")}`)}, ${zero(8)}, 0 - x.${c("amount")} * o.fx, x.${c("amount")} * o.fx FROM ${d.t("Refund")} x JOIN o ON o.id = x.${c("orderId")}
    WHERE ${inRange(d, `x.${c("refundedAt")}`)}
)
SELECT k AS ${c("key")}, SUM(v01) AS ${c("rev01")}, SUM(o01) AS ${c("orig01")}, SUM(n01) AS ${c("orders")}, SUM(v02) AS ${c("rev02")}, SUM(n02) AS ${c("confirmed")},
  SUM(v03) AS ${c("rev03")}, SUM(o03) AS ${c("orig03")}, SUM(n03) AS ${c("delivered")}, SUM(v04) AS ${c("rev04")}, SUM(rfd) AS ${c("refunds")}
FROM r GROUP BY k ORDER BY k LIMIT 500`;
}
// Thứ tự cột trong các nhánh UNION: k, v01, o01, n01, v02, n02, v03, o03, n03, v04, rfd.

/** Vận đơn theo thị trường (OPS-01..03, COD), kỳ theo confirmedAt của đơn CONFIRMED. */
export function fulfillmentSql(d: Dialect) {
  return `WITH o AS (${orderBase(d)})
SELECT COALESCE(o.mk, '—') AS ${d.c("key")}, COUNT(*) AS ${d.c("confirmed")},
  SUM(CASE WHEN o.fs = 'DELIVERED' THEN 1 ELSE 0 END) AS ${d.c("delivered")},
  SUM(CASE WHEN o.fs = 'PARTIAL' THEN 1 ELSE 0 END) AS ${d.c("partial")},
  SUM(CASE WHEN o.fs = 'FAILED' THEN 1 ELSE 0 END) AS ${d.c("failed")},
  SUM(CASE WHEN o.fs = 'RETURNED' THEN 1 ELSE 0 END) AS ${d.c("returned")},
  SUM(CASE WHEN o.fs IN ('UNFULFILLED', 'IN_TRANSIT') THEN 1 ELSE 0 END) AS ${d.c("pending")},
  AVG(CASE WHEN o.dl IS NOT NULL THEN ${d.daysBetween("o.dl", "o.cf")} END) AS ${d.c("avgDays")},
  SUM(CASE WHEN o.ps = 'COD_COLLECTED' THEN 1 ELSE 0 END) AS ${d.c("codCollected")},
  SUM(CASE WHEN o.ps = 'COD_COLLECTED' THEN o.nb ELSE 0 END) AS ${d.c("codValue")}
FROM o WHERE o.status = 'CONFIRMED' AND ${inRange(d, "o.cf")}
GROUP BY COALESCE(o.mk, '—') ORDER BY 2 DESC LIMIT 100`;
}

/** Lý do giao thất bại (OPS-04) trong kỳ theo thời điểm sự kiện. */
export function failureReasonsSql(d: Dialect) {
  const c = d.c;
  return `WITH o AS (${orderBase(d)})
SELECT COALESCE(e.${c("reasonCode")}, 'unknown') AS ${c("key")}, COUNT(*) AS ${c("n")}
FROM ${d.t("DeliveryEvent")} e JOIN ${d.t("Shipment")} s2 ON s2.${c("id")} = e.${c("shipmentId")} JOIN o ON o.id = s2.${c("orderId")}
WHERE e.${c("type")} = 'FAILED' AND ${inRange(d, `e.${c("occurredAt")}`)}
GROUP BY COALESCE(e.${c("reasonCode")}, 'unknown') ORDER BY 2 DESC LIMIT 10`;
}

/** Cohort theo tháng mua hợp lệ đầu tiên (giao thành công, CUS-03): số khách còn mua ở tháng thứ k (0..6); dòng k = -1 mang số khách
 *  có đơn hợp lệ thứ 2 trong 60 ngày (đếm một lần mỗi khách). Cohort bắt đầu trong kỳ. */
export function cohortSql(d: Dialect) {
  const c = d.c;
  return `WITH o AS (${orderBase(d)}),
v AS (
  SELECT o.cu AS cu, o.dl AS dl FROM o
  JOIN (SELECT i.${c("orderId")} AS oid, SUM(i.${c("qtyDelivered")}) AS q FROM ${d.t("OrderItem")} i JOIN o o2 ON o2.id = i.${c("orderId")} WHERE o2.dl IS NOT NULL GROUP BY i.${c("orderId")}) g ON g.oid = o.id
  WHERE o.dl IS NOT NULL AND g.q > 0 AND o.cu IS NOT NULL
),
f AS (SELECT cu, MIN(dl) AS first FROM v GROUP BY cu),
x AS (SELECT f.cu, ${d.month("f.first")} AS cohort, ${d.monthIndex("v.dl")} - ${d.monthIndex("f.first")} AS k,
        CASE WHEN v.dl > f.first AND v.dl <= ${d.plusDays("f.first", 60)} THEN 1 ELSE 0 END AS r60
      FROM f JOIN v ON v.cu = f.cu WHERE ${inRange(d, "f.first")})
SELECT cohort AS ${c("cohort")}, k AS ${c("k")}, COUNT(DISTINCT cu) AS ${c("customers")}, 0 AS ${c("repeat60")}
FROM x WHERE k BETWEEN 0 AND 6 GROUP BY cohort, k
UNION ALL
SELECT cohort, -1, 0, COUNT(DISTINCT CASE WHEN r60 = 1 THEN cu END) FROM x GROUP BY cohort
ORDER BY 1, 2`;
}

/** Phân bố hạng RFM (phiên bản đang dùng) + giá trị REV-03 / CM-01 12 tháng theo hạng. */
export function rfmSql(d: Dialect) {
  const c = d.c;
  return `SELECT s.${c("band")} AS ${c("key")}, COUNT(*) AS ${c("customers")}, SUM(cm.${c("rev03")}) AS ${c("rev03")}, SUM(cm.${c("grossProfit")}) AS ${c("grossProfit")},
  SUM(CASE WHEN cm.${c("grossProfit")} IS NULL AND cm.${c("rev03")} > 0 THEN 1 ELSE 0 END) AS ${c("missingCost")}
FROM ${d.t("Score")} s JOIN ${d.t("ScoreVersion")} v ON v.${c("id")} = s.${c("versionId")}
LEFT JOIN ${d.t("CustomerMetric")} cm ON cm.${c("customerId")} = s.${c("customerId")} AND cm.${c("period")} = 'R12M'
WHERE s.${c("workspaceId")} = @ws AND v.${c("active")} = TRUE AND v.${c("type")} = 'RFM' AND s.${c("customerId")} IS NOT NULL
GROUP BY s.${c("band")} ORDER BY 2 DESC`;
}

const OPEN = "'MOI', 'DANG_TU_VAN', 'CHO_QUYET_DINH'";
function leadBase(d: Dialect) {
  const c = d.c;
  return `SELECT l.${c("stage")} AS stage, l.${c("ownerId")} AS owner, l.${c("source")} AS source, l.${c("createdAt")} AS created,
    l.${c("firstRespondedAt")} AS fr, l.${c("firstResponseDueAt")} AS frd, l.${c("nextActionAt")} AS na
  FROM ${d.t("Lead")} l
  WHERE l.${c("workspaceId")} = @ws AND ${inRange(d, `l.${c("createdAt")}`)} AND ${d.opt("owner", `l.${c("ownerId")}`)} AND ${d.opt("brand", `l.${c("brandId")}`)} AND ${d.opt("market", `l.${c("marketId")}`)}`;
}

/** Phễu nhu cầu mua: đếm theo giai đoạn (lead tạo trong kỳ) — tổng hợp ở DB, không tải danh sách thẻ (D-48). */
export function leadStageSql(d: Dialect) {
  return `WITH l AS (${leadBase(d)}) SELECT stage AS ${d.c("key")}, COUNT(*) AS ${d.c("n")} FROM l GROUP BY stage`;
}

/** Kết quả theo người phụ trách: chốt, mất, quá hạn hành động, phản hồi đầu (phút, đúng hạn). groupCol = owner | source. */
export function leadByGroupSql(d: Dialect, groupCol: "owner" | "source") {
  const c = d.c;
  return `WITH l AS (${leadBase(d)})
SELECT COALESCE(${groupCol}, '—') AS ${c("key")}, COUNT(*) AS ${c("leads")},
  SUM(CASE WHEN stage = 'DA_MUA' THEN 1 ELSE 0 END) AS ${c("won")},
  SUM(CASE WHEN stage IN ('TU_CHOI', 'MAT_LIEN_LAC') THEN 1 ELSE 0 END) AS ${c("lost")},
  SUM(CASE WHEN stage IN (${OPEN}) AND na IS NOT NULL AND na < ${d.ts("@now")} THEN 1 ELSE 0 END) AS ${c("overdue")},
  SUM(CASE WHEN fr IS NOT NULL THEN 1 ELSE 0 END) AS ${c("contacted")},
  AVG(CASE WHEN fr IS NOT NULL THEN ${d.daysBetween("fr", "created")} * 1440 END) AS ${c("avgFirstMin")},
  SUM(CASE WHEN frd IS NOT NULL THEN 1 ELSE 0 END) AS ${c("withSla")},
  SUM(CASE WHEN frd IS NOT NULL AND fr IS NOT NULL AND fr <= frd THEN 1 ELSE 0 END) AS ${c("onTime")}
FROM l GROUP BY COALESCE(${groupCol}, '—') ORDER BY 2 DESC LIMIT 200`;
}

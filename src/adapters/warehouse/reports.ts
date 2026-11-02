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

/** Khóa nhóm, viết trên cột gốc (o = Order, s = Store) để mỗi nhánh tự lọc đơn theo mốc của nó (dùng chỉ mục, không CTE dùng chung). */
function key(d: Dialect, g: RevenueGroup, at: string) {
  const c = d.c;
  switch (g) {
    case "month": return d.month(at);
    case "brand": return `COALESCE(s.${c("brandId")}, '—')`;
    case "market": return `COALESCE(o.${c("marketId")}, '—')`;
    case "store": return `o.${c("storeId")}`;
    case "currency": return `o.${c("currency")}`;
    case "brand_market": return `COALESCE(s.${c("brandId")}, '—') || '|' || COALESCE(o.${c("marketId")}, '—')`;
    default: return "'all'";
  }
}
function ord(d: Dialect) {
  const c = d.c;
  return `${d.t("Order")} o JOIN ${d.t("Store")} s ON s.${c("id")} = o.${c("storeId")}`;
}
function scoped(d: Dialect) {
  const c = d.c;
  return `o.${c("workspaceId")} = @ws AND ${d.opt("store", `o.${c("storeId")}`)} AND ${d.opt("market", `o.${c("marketId")}`)} AND ${d.opt("brand", `s.${c("brandId")}`)}`;
}

/**
 * REV-01..04 + số đơn theo (nhóm × tiền tệ gốc). v0x = VND quy đổi theo tỷ giá chốt của đơn (D-44); o01/o03 = nguyên tệ.
 * Phía service gộp tiếp: theo nhóm (cộng mọi tiền tệ) và theo tiền tệ (cộng mọi nhóm) — một truy vấn cho cả hai bảng.
 * REV-03 = (Σ qtyDelivered × unitPrice − hoàn) × tỷ giá, đơn có deliveredAt trong kỳ — giống công thức CustomerMetric (sql.ts).
 * Thanh toán thiếu paidAt không tính vào REV-04 (dữ liệu nguồn luôn có paidAt cho thanh toán thành công).
 * REV-04 gồm COD đã đối soát: SettlementLine theo remittedAt (Phase 10, D-58) — COD chưa về tiền không tính.
 */
export function revenueSql(d: Dialect, g: RevenueGroup) {
  const c = d.c;
  const cf = `COALESCE(o.${c("confirmedAt")}, o.${c("bookedAt")})`;
  const cur = `o.${c("currency")}`;
  const rf = `COALESCE(o.${c("refundedAmount")}, 0)`;
  return `WITH r AS (
  SELECT ${key(d, g, `o.${c("bookedAt")}`)} AS k, ${cur} AS cur, SUM(o.${c("netBase")}) AS v01, SUM(o.${c("netAmount")}) AS o01, COUNT(*) AS n01, 0 AS v02, 0 AS n02, 0 AS v03, 0 AS o03, 0 AS n03, 0 AS v04, 0 AS rfd
    FROM ${ord(d)} WHERE ${scoped(d)} AND o.${c("status")} <> 'CANCELLED' AND ${inRange(d, `o.${c("bookedAt")}`)} GROUP BY 1, 2
  UNION ALL SELECT ${key(d, g, cf)}, ${cur}, 0, 0, 0, SUM(o.${c("netBase")}), COUNT(*), 0, 0, 0, 0, 0
    FROM ${ord(d)} WHERE ${scoped(d)} AND o.${c("status")} = 'CONFIRMED'
      AND ((o.${c("confirmedAt")} IS NOT NULL AND ${inRange(d, `o.${c("confirmedAt")}`)}) OR (o.${c("confirmedAt")} IS NULL AND ${inRange(d, `o.${c("bookedAt")}`)})) GROUP BY 1, 2
  UNION ALL SELECT ${key(d, g, `o.${c("deliveredAt")}`)}, ${cur}, 0, 0, 0, 0, 0, SUM((gi.dv - ${rf}) * o.${c("fxRate")}), SUM(gi.dv - ${rf}), COUNT(*), 0, 0
    FROM ${ord(d)} JOIN (
      SELECT i.${c("orderId")} AS oid, SUM(i.${c("qtyDelivered")} * i.${c("unitPrice")}) AS dv FROM ${d.t("OrderItem")} i
      WHERE i.${c("orderId")} IN (SELECT o2.${c("id")} FROM ${d.t("Order")} o2 WHERE o2.${c("workspaceId")} = @ws AND ${inRange(d, `o2.${c("deliveredAt")}`)})
      GROUP BY i.${c("orderId")}
    ) gi ON gi.oid = o.${c("id")}
    WHERE ${scoped(d)} AND ${inRange(d, `o.${c("deliveredAt")}`)} AND gi.dv > 0 GROUP BY 1, 2
  UNION ALL SELECT ${key(d, g, `p.${c("paidAt")}`)}, ${cur}, 0, 0, 0, 0, 0, 0, 0, 0, SUM(p.${c("amount")} * o.${c("fxRate")}), 0
    FROM ${d.t("Payment")} p JOIN ${ord(d)} ON o.${c("id")} = p.${c("orderId")}
    WHERE p.${c("workspaceId")} = @ws AND ${scoped(d)} AND UPPER(p.${c("status")}) IN (${PAID_STATUSES}) AND ${inRange(d, `p.${c("paidAt")}`)} GROUP BY 1, 2
  UNION ALL SELECT ${key(d, g, `l.${c("remittedAt")}`)}, ${cur}, 0, 0, 0, 0, 0, 0, 0, 0, SUM(l.${c("amount")} * o.${c("fxRate")}), 0
    FROM ${d.t("SettlementLine")} l JOIN ${ord(d)} ON o.${c("id")} = l.${c("orderId")}
    WHERE l.${c("workspaceId")} = @ws AND ${scoped(d)} AND ${inRange(d, `l.${c("remittedAt")}`)} GROUP BY 1, 2
  UNION ALL SELECT ${key(d, g, `x.${c("refundedAt")}`)}, ${cur}, 0, 0, 0, 0, 0, 0, 0, 0, 0 - SUM(x.${c("amount")} * o.${c("fxRate")}), SUM(x.${c("amount")} * o.${c("fxRate")})
    FROM ${d.t("Refund")} x JOIN ${ord(d)} ON o.${c("id")} = x.${c("orderId")}
    WHERE x.${c("workspaceId")} = @ws AND ${scoped(d)} AND ${inRange(d, `x.${c("refundedAt")}`)} GROUP BY 1, 2
)
SELECT k AS ${c("key")}, cur AS ${c("cur")}, SUM(v01) AS ${c("rev01")}, SUM(o01) AS ${c("orig01")}, SUM(n01) AS ${c("orders")}, SUM(v02) AS ${c("rev02")}, SUM(n02) AS ${c("confirmed")},
  SUM(v03) AS ${c("rev03")}, SUM(o03) AS ${c("orig03")}, SUM(n03) AS ${c("delivered")}, SUM(v04) AS ${c("rev04")}, SUM(rfd) AS ${c("refunds")}
FROM r GROUP BY k, cur ORDER BY 1 LIMIT 2000`;
}
// Thứ tự cột trong các nhánh UNION: k, cur, v01, o01, n01, v02, n02, v03, o03, n03, v04, rfd.

/**
 * COD theo hãng × nguyên tệ (docs/metrics.md mục 3): CASH-01 đã thu trong kỳ (collectedAt), CASH-02 đã về trong kỳ (remittedAt),
 * CASH-03 đang kẹt TẠI CUỐI KỲ = đã thu trước @to mà chưa có dòng đối soát trước @to (số tồn, không theo kỳ), chia tuổi theo ngày từ lúc thu.
 * c0x = VND quy đổi theo tỷ giá chốt của đơn (D-44); o0x = nguyên tệ. Cột: ca, cur, c01, o01, n01, c02, o02, n02, c03, o03, n03, a15, a30, a60, a61.
 */
export function codSql(d: Dialect) {
  const c = d.c;
  const age = d.daysBetween(d.ts("@to"), `sh.${c("collectedAt")}`);
  const amt = `sh.${c("codAmount")}`;
  const fx = `o.${c("fxRate")}`;
  const sh = `${d.t("Shipment")} sh JOIN ${ord(d)} ON o.${c("id")} = sh.${c("orderId")}`;
  const cod = `sh.${c("workspaceId")} = @ws AND ${scoped(d)} AND ${amt} IS NOT NULL AND sh.${c("collectedAt")} IS NOT NULL`;
  return `WITH r AS (
  SELECT COALESCE(sh.${c("carrier")}, '—') AS ca, o.${c("currency")} AS cur, SUM(${amt} * ${fx}) AS c01, SUM(${amt}) AS o01, COUNT(*) AS n01,
    0 AS c02, 0 AS o02, 0 AS n02, 0 AS c03, 0 AS o03, 0 AS n03, 0 AS a15, 0 AS a30, 0 AS a60, 0 AS a61
    FROM ${sh} WHERE ${cod} AND ${inRange(d, `sh.${c("collectedAt")}`)} GROUP BY 1, 2
  UNION ALL SELECT st.${c("carrier")}, o.${c("currency")}, 0, 0, 0, SUM(l.${c("amount")} * ${fx}), SUM(l.${c("amount")}), COUNT(*), 0, 0, 0, 0, 0, 0, 0
    FROM ${d.t("SettlementLine")} l JOIN ${d.t("Settlement")} st ON st.${c("id")} = l.${c("settlementId")} JOIN ${ord(d)} ON o.${c("id")} = l.${c("orderId")}
    WHERE l.${c("workspaceId")} = @ws AND ${scoped(d)} AND ${inRange(d, `l.${c("remittedAt")}`)} GROUP BY 1, 2
  UNION ALL SELECT COALESCE(sh.${c("carrier")}, '—'), o.${c("currency")}, 0, 0, 0, 0, 0, 0, SUM(${amt} * ${fx}), SUM(${amt}), COUNT(*),
    SUM(CASE WHEN ${age} <= 15 THEN ${amt} * ${fx} ELSE 0 END), SUM(CASE WHEN ${age} > 15 AND ${age} <= 30 THEN ${amt} * ${fx} ELSE 0 END),
    SUM(CASE WHEN ${age} > 30 AND ${age} <= 60 THEN ${amt} * ${fx} ELSE 0 END), SUM(CASE WHEN ${age} > 60 THEN ${amt} * ${fx} ELSE 0 END)
    FROM ${sh} WHERE ${cod} AND sh.${c("collectedAt")} < ${d.ts("@to")}
      AND NOT EXISTS (SELECT 1 FROM ${d.t("SettlementLine")} l WHERE l.${c("orderId")} = sh.${c("orderId")} AND l.${c("trackingNo")} = sh.${c("trackingNo")} AND l.${c("remittedAt")} < ${d.ts("@to")})
    GROUP BY 1, 2
)
SELECT ca AS ${c("carrier")}, cur AS ${c("cur")}, SUM(c01) AS ${c("cash01")}, SUM(o01) AS ${c("orig01")}, SUM(n01) AS ${c("n01")},
  SUM(c02) AS ${c("cash02")}, SUM(o02) AS ${c("orig02")}, SUM(n02) AS ${c("n02")}, SUM(c03) AS ${c("cash03")}, SUM(o03) AS ${c("orig03")}, SUM(n03) AS ${c("n03")},
  SUM(a15) AS ${c("age15")}, SUM(a30) AS ${c("age30")}, SUM(a60) AS ${c("age60")}, SUM(a61) AS ${c("age61")}
FROM r GROUP BY ca, cur ORDER BY 1, 2 LIMIT 500`;
}

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
SELECT COALESCE(e.${c("reasonCode")}, 'other') AS ${c("key")}, COUNT(*) AS ${c("n")}
FROM ${d.t("DeliveryEvent")} e JOIN ${d.t("Shipment")} s2 ON s2.${c("id")} = e.${c("shipmentId")} JOIN o ON o.id = s2.${c("orderId")}
WHERE e.${c("type")} = 'FAILED' AND ${inRange(d, `e.${c("occurredAt")}`)}
GROUP BY COALESCE(e.${c("reasonCode")}, 'other') ORDER BY 2 DESC LIMIT 10`;
}

/**
 * Cohort theo tháng mua hợp lệ đầu tiên (đơn có dòng đã giao, CUS-03): số khách còn mua ở tháng thứ k (0..6); dòng k = -1 mang số khách
 * có đơn hợp lệ thứ 2 trong 60 ngày. Cohort bắt đầu trong kỳ. Khử trùng (khách, tháng) trước khi đếm thay cho COUNT(DISTINCT) trên cả bảng.
 */
export function cohortSql(d: Dialect) {
  const c = d.c;
  const mi = (x: string) => d.monthIndex(x);
  // Nhãn 'YYYY-MM' từ số tháng (năm×12 + tháng): cú pháp chung hai phương ngữ.
  const label = (x: string) => `CAST(CAST(FLOOR((${x} - 1) / 12) AS INTEGER) AS ${d.name === "postgres" ? "TEXT" : "STRING"}) || '-' || LPAD(CAST(CAST(${x} - 12 * FLOOR((${x} - 1) / 12) AS INTEGER) AS ${d.name === "postgres" ? "TEXT" : "STRING"}), 2, '0')`;
  return `WITH v AS (
  SELECT ${d.bin(`o.${c("customerId")}`)} AS cu, o.${c("deliveredAt")} AS dl FROM ${ord(d)}
  WHERE ${scoped(d)} AND o.${c("deliveredAt")} IS NOT NULL AND o.${c("customerId")} IS NOT NULL
    AND EXISTS (SELECT 1 FROM ${d.t("OrderItem")} i WHERE i.${c("orderId")} = o.${c("id")} AND i.${c("qtyDelivered")} > 0)
),
f AS (SELECT cu, MIN(dl) AS first FROM v GROUP BY cu HAVING MIN(dl) >= ${d.ts("@from")} AND MIN(dl) < ${d.ts("@to")}),
x AS (SELECT f.cu AS cu, ${mi("f.first")} AS cm, ${mi("v.dl")} - ${mi("f.first")} AS k FROM f JOIN v ON v.cu = f.cu
      WHERE ${mi("v.dl")} - ${mi("f.first")} BETWEEN 0 AND 6 GROUP BY f.cu, ${mi("f.first")}, ${mi("v.dl")} - ${mi("f.first")}),
r60 AS (SELECT ${mi("f.first")} AS cm, COUNT(DISTINCT f.cu) AS n FROM f JOIN v ON v.cu = f.cu
        WHERE v.dl > f.first AND v.dl <= ${d.plusDays("f.first", 60)} GROUP BY ${mi("f.first")})
SELECT ${label("cm")} AS ${c("cohort")}, k AS ${c("k")}, n AS ${c("customers")}, rp AS ${c("repeat60")} FROM (
  SELECT cm, k, COUNT(*) AS n, 0 AS rp FROM x GROUP BY cm, k
  UNION ALL SELECT cm, -1, 0, n FROM r60
) t ORDER BY cm, k`;
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

// Bốn mốc COD của một đơn (docs/metrics.md mục 3.1): đặt → giao thành công → đã thu → đã về.
// Hàm thuần: nhận dữ liệu đơn + vận đơn + dòng đối soát, trả các bước để trang đơn / khách hiện giống nhau.

export type CodShipment = { trackingNo: string | null; status: string; codAmount: string | null; deliveredAt: Date | string | null; collectedAt: Date | string | null };
export type CodLine = { trackingNo: string; amount: string; remittedAt: Date | string; reference: string };
export type StepState = "done" | "partial" | "pending" | "failed" | "skipped";
export type CodStep = { key: "booked" | "delivered" | "collected" | "remitted"; label: string; metric: string; state: StepState; at: string | null; amount: string | null; note?: string };

const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());
const latest = (xs: (Date | string | null)[]) => xs.map(iso).filter((x): x is string => !!x).sort().at(-1) ?? null;
/** Cộng chuỗi thập phân không qua số thực (đủ 4 chữ số lẻ như cột Decimal(18,4)). */
export function addDec(xs: string[]): string {
  const scaled = xs.reduce((s, x) => {
    const [i, f = ""] = x.replace(/^-/, "").split(".");
    const v = BigInt(i || "0") * 10000n + BigInt((f + "0000").slice(0, 4));
    return s + (x.startsWith("-") ? -v : v);
  }, 0n);
  const neg = scaled < 0n, a = neg ? -scaled : scaled;
  const frac = (a % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${a / 10000n}${frac ? `.${frac}` : ""}`;
}

/** null khi đơn không có vận đơn thu hộ (không phải COD). */
export function codSteps(order: { bookedAt: Date | string; netAmount: string; status: string }, shipments: CodShipment[], lines: CodLine[]): CodStep[] | null {
  const cod = shipments.filter((s) => s.codAmount != null);
  if (!cod.length) return null;
  const delivered = cod.filter((s) => s.deliveredAt);
  const failed = cod.some((s) => s.status === "FAILED" || s.status === "RETURNED");
  const collected = cod.filter((s) => s.collectedAt);
  const remitted = cod.flatMap((s) => lines.filter((l) => l.trackingNo === s.trackingNo));
  const all = cod.length;
  const state = (n: number, blocked: boolean): StepState => (n === all ? "done" : n > 0 ? "partial" : blocked ? "skipped" : "pending");
  const cancelled = order.status === "CANCELLED";
  const dState: StepState = cancelled ? "skipped" : delivered.length === all ? "done" : delivered.length ? "partial" : failed ? "failed" : "pending";
  const noDelivery = dState === "failed" || dState === "skipped";
  return [
    { key: "booked", label: "Đặt", metric: "REV-01", state: cancelled ? "failed" : "done", at: iso(order.bookedAt), amount: order.netAmount, note: cancelled ? "Đơn đã hủy" : undefined },
    { key: "delivered", label: "Giao thành công", metric: "REV-03", state: dState, at: latest(delivered.map((s) => s.deliveredAt)), amount: null,
      note: dState === "failed" ? "Giao thất bại / hoàn — không có mốc thu và về tiền" : undefined },
    { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: state(collected.length, noDelivery), at: latest(collected.map((s) => s.collectedAt)),
      amount: collected.length ? addDec(collected.map((s) => s.codAmount!)) : null },
    { key: "remitted", label: "Đã về (đối soát)", metric: "CASH-02 · REV-04", state: state(remitted.length, noDelivery), at: latest(remitted.map((l) => l.remittedAt)),
      amount: remitted.length ? addDec(remitted.map((l) => l.amount)) : null, note: remitted.length ? `Bảng ${[...new Set(remitted.map((l) => l.reference))].join(", ")}` : undefined },
  ];
}

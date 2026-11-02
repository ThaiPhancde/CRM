// Đối soát COD (Phase 10, D-58): dán bảng của hãng → xem trước từng dòng → áp dụng. Mốc "đã về" (remitted) → CASH-02, REV-04.
// Một vận đơn chỉ đối soát một lần (unique đơn + mã vận đơn ở DB); dán lại cùng bảng → "Không đổi". Dòng lỗi không chặn dòng khác.
// Không về tiền khi chưa có mốc đã thu (COD_COLLECTED) — đúng thứ tự 4 mốc.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getWarehouse } from "@/adapters/warehouse";
import { codSql } from "@/adapters/warehouse/reports";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, parse } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";
import { toReportCurrency, type ReportFilter } from "@/modules/reports/period";
import { params } from "@/modules/reports/revenue";
import { codSteps } from "./milestones";
import { parseAmount, parseDay, parseSettlementPaste, PasteError, type PasteRow } from "./paste";

const D = Prisma.Decimal;
/** Cộng chính xác giá trị SQL (chuỗi numeric) — không qua số thực trước khi cộng. */
const dec = (vals: unknown[]) => vals.reduce((a: Prisma.Decimal, v) => a.add(new D(String(v ?? 0))), new D(0)).toNumber();
const day = (d: Date) => d.toISOString().slice(0, 10);
const dmy = (d: Date) => `${day(d).slice(8, 10)}/${day(d).slice(5, 7)}/${day(d).slice(0, 4)}`;

export const settlementInput = z.object({
  carrier: z.string().trim().min(1, "Chọn hãng vận chuyển").max(60),
  reference: z.string().trim().min(1, "Nhập mã bảng đối soát").max(60, "Tối đa 60 ký tự"),
  text: z.string().max(200_000, "Bảng quá dài"),
});

export type SettlementLineResult = {
  rowNo: number; ref: string; orderId: string | null; orderNumber: string | null; status: "ready" | "done" | "unchanged" | "error";
  message: string; amount: string | null; codAmount: string | null; currency: string | null;
};
type Planned = SettlementLineResult & { key?: { orderId: string; trackingNo: string; amount: string; currency: string; codAmount: string | null; remittedAt: Date } };

type Cand = { orderId: string; orderNumber: string; currency: string; status: string; trackingNo: string | null; carrier: string | null; codAmount: Prisma.Decimal | null; collectedAt: Date | null };

/** Dòng → việc sẽ làm. Đọc DB một lần cho cả bảng (≤ 500 dòng): vận đơn theo mã + đơn theo số, dòng đối soát đã có. */
async function plan(u: SessionUser, carrier: string, reference: string, rows: PasteRow[], now: Date): Promise<Planned[]> {
  const tns = [...new Set(rows.map((r) => r.raw.tracking).filter(Boolean))] as string[];
  const ons = [...new Set(rows.map((r) => r.raw.order).filter(Boolean))] as string[];
  const ships = await db.shipment.findMany({
    where: { OR: [...(tns.length ? [{ trackingNo: { in: tns } }] : []), ...(ons.length ? [{ order: { orderNumber: { in: ons } } }] : [])] },
    select: { orderId: true, trackingNo: true, carrier: true, codAmount: true, collectedAt: true, order: { select: { orderNumber: true, currency: true, status: true } } },
  });
  const cands: Cand[] = ships.map((s) => ({ orderId: s.orderId, orderNumber: s.order.orderNumber, currency: s.order.currency, status: s.order.status, trackingNo: s.trackingNo, carrier: s.carrier, codAmount: s.codAmount, collectedAt: s.collectedAt }));
  const existing = await db.settlementLine.findMany({
    where: { orderId: { in: [...new Set(cands.map((c) => c.orderId))] } },
    select: { orderId: true, trackingNo: true, amount: true, remittedAt: true, settlement: { select: { carrier: true, reference: true } } },
  });
  const done = new Map(existing.map((e) => [`${e.orderId}|${e.trackingNo}`, e]));
  const seen = new Map<string, number>();
  const maxDay = new Date(now.getTime() + 86_400_000);

  return rows.map((row): Planned => {
    const r = row.raw;
    const base = { rowNo: row.rowNo, ref: r.tracking ?? r.order ?? "—", orderId: null, orderNumber: null, amount: null, codAmount: null, currency: null };
    const err = (message: string, extra: Partial<Planned> = {}): Planned => ({ ...base, ...extra, status: "error", message });
    const amount = parseAmount(r.amount);
    if (!amount || new D(amount).lte(0)) return err(`Số tiền "${r.amount ?? ""}" không hợp lệ`);
    const at = parseDay(r.date);
    if (!at) return err(`Ngày "${r.date ?? ""}" không đúng dạng dd/mm/yyyy hoặc yyyy-mm-dd`);
    if (at > maxDay) return err("Ngày về tiền ở tương lai");

    let m = cands.filter((c) => (!r.tracking || c.trackingNo === r.tracking) && (!r.order || c.orderNumber === r.order));
    if (!m.length) return err(r.tracking ? `Không tìm thấy vận đơn ${r.tracking}${r.order ? ` của đơn ${r.order}` : ""}` : `Không tìm thấy đơn ${r.order}`);
    const codM = m.filter((c) => c.codAmount != null);
    if (!codM.length) return err("Vận đơn không thu hộ (đơn không phải COD)");
    m = codM;
    if (!r.tracking) m = m.filter((c) => c.carrier === carrier);
    const orders = [...new Set(m.map((c) => c.orderNumber))];
    if (orders.length > 1) return err(`Mã vận đơn ${r.tracking} thuộc nhiều đơn (${orders.join(", ")}) — thêm cột ma_don`);
    if (m.length !== 1) return err(m.length ? `Đơn ${r.order} có nhiều vận đơn COD — thêm cột ma_van_don` : `Đơn ${r.order} không có vận đơn COD của ${carrier}`);
    const c = m[0];
    const info = { orderId: c.orderId, orderNumber: c.orderNumber, codAmount: c.codAmount!.toString(), currency: c.currency, amount };
    if (c.carrier !== carrier) return err(`Vận đơn thuộc ${c.carrier ?? "hãng khác"}, không phải ${carrier}`, info);
    if (r.currency && r.currency.toUpperCase() !== c.currency) return err(`Tiền tệ ${r.currency} khác tiền tệ đơn (${c.currency})`, info);
    if (!c.collectedAt) return err("Chưa có mốc đã thu COD — chưa thể ghi tiền về", info);
    if (day(at) < day(c.collectedAt)) return err(`Ngày về ${dmy(at)} trước ngày thu ${dmy(c.collectedAt)}`, info);
    const k = `${c.orderId}|${c.trackingNo}`;
    if (seen.has(k)) return err(`Trùng dòng ${seen.get(k)}`, info);
    seen.set(k, row.rowNo);
    const prev = done.get(k);
    if (prev) {
      const same = prev.settlement.carrier === carrier && prev.settlement.reference === reference && prev.amount.eq(amount) && day(prev.remittedAt) === day(at);
      return same ? { ...base, ...info, status: "unchanged", message: `Không đổi — đã ghi trong bảng ${reference}` }
        : err(`Đã đối soát trong bảng ${prev.settlement.reference} ngày ${dmy(prev.remittedAt)}`, info);
    }
    const diff = new D(amount).sub(c.codAmount!);
    const msg = diff.isZero() ? `Về đủ ${amount} ${c.currency}` : `Về ${amount} ${c.currency}, ${diff.isNeg() ? "thiếu" : "dư"} ${diff.abs().toString()} so với COD ${c.codAmount} (phí hãng?)`;
    return { ...base, ...info, status: "ready", message: msg, key: { orderId: c.orderId, trackingNo: c.trackingNo!, amount, currency: c.currency, codAmount: c.codAmount!.toString(), remittedAt: at } };
  });
}

function rowsOf(text: string) {
  try {
    return parseSettlementPaste(text);
  } catch (e) {
    if (e instanceof PasteError) throw new HttpError(400, e.message);
    throw e;
  }
}
const strip = (p: Planned[]): SettlementLineResult[] => p.map(({ key: _k, ...x }) => x);

/** Xem trước: không ghi gì. */
export async function previewSettlement(u: SessionUser, input: unknown, now = new Date()) {
  requirePerm(u, "cod.reconcile");
  const d = parse(settlementInput, input);
  return strip(await plan(u, d.carrier, d.reference, rowsOf(d.text), now));
}

/** Áp dụng: đọc lại trạng thái mới nhất, ghi các dòng sẵn sàng trong một giao dịch. Dòng va chạm đồng thời → "Không đổi". */
export async function applySettlement(u: SessionUser, input: unknown, now = new Date()) {
  requirePerm(u, "cod.reconcile");
  const d = parse(settlementInput, input);
  const planned = await plan(u, d.carrier, d.reference, rowsOf(d.text), now);
  const ready = planned.filter((p) => p.key);
  if (!ready.length) return { settlementId: null, inserted: 0, lines: strip(planned) };
  const { id, inserted } = await db.$transaction(async (tx) => {
    const st = await tx.settlement.upsert({
      where: { workspaceId_carrier_reference: { workspaceId: u.workspaceId, carrier: d.carrier, reference: d.reference } },
      create: { carrier: d.carrier, reference: d.reference, createdById: u.id } as Prisma.SettlementUncheckedCreateInput,
      update: {},
    });
    const r = await tx.settlementLine.createMany({
      data: ready.map((p) => ({ settlementId: st.id, ...p.key!, codAmount: p.key!.codAmount })) as Prisma.SettlementLineCreateManyInput[],
      skipDuplicates: true,
    });
    const total = dec(ready.map((p) => p.key!.amount));
    await audit(tx, { actorId: u.id, entity: "Settlement", entityId: st.id, action: "settlement.import", after: { carrier: d.carrier, reference: d.reference, lines: r.count, rows: planned.length, errors: planned.filter((p) => p.status === "error").length, total } });
    return { id: st.id, inserted: r.count };
  });
  const lines = strip(planned).map((p) => (p.status === "ready" ? { ...p, status: inserted === ready.length ? ("done" as const) : ("unchanged" as const) } : p));
  return { settlementId: id, inserted, lines };
}

/** Hãng có vận đơn COD (cho ô chọn ở form đối soát). */
export async function codCarriers(u: SessionUser) {
  requirePerm(u, "cod.reconcile");
  const r = await db.shipment.findMany({ where: { codAmount: { not: null }, carrier: { not: null } }, select: { carrier: true }, distinct: ["carrier"], orderBy: { carrier: "asc" } });
  return r.map((x) => x.carrier!);
}

type CodRaw = { carrier: string; cur: string; cash01: unknown; orig01: unknown; n01: unknown; cash02: unknown; orig02: unknown; n02: unknown; cash03: unknown; orig03: unknown; n03: unknown; age15: unknown; age30: unknown; age60: unknown; age61: unknown };

/** CASH-01/02/03 theo hãng (và theo nguyên tệ) qua Warehouse. Tiền quy tiền tệ báo cáo; thiếu finance.view → chỉ số lượng. */
export async function codSummary(u: SessionUser, f: ReportFilter, rateToBase: number | null) {
  // Hai nơi xem: /van-don (fulfillment.view) và báo cáo tài chính (report.finance).
  requirePerm(u, can(u.roles, "fulfillment.view") ? "fulfillment.view" : "report.finance");
  const wh = getWarehouse();
  const raw = await wh.read<CodRaw>(codSql(wh.dialect), params(u, f));
  const money = can(u.roles, "finance.view");
  const conv = (vals: unknown[]) => (money ? toReportCurrency(dec(vals), f.currency, rateToBase) : null);
  const n = (v: unknown) => Number(v ?? 0);
  const group = (by: (r: CodRaw) => string) => {
    const m = new Map<string, CodRaw[]>();
    for (const r of raw) m.set(by(r), [...(m.get(by(r)) ?? []), r]);
    return [...m.entries()].map(([key, rs]) => ({
      key, cash01: conv(rs.map((r) => r.cash01)), n01: rs.reduce((s, r) => s + n(r.n01), 0),
      cash02: conv(rs.map((r) => r.cash02)), n02: rs.reduce((s, r) => s + n(r.n02), 0),
      cash03: conv(rs.map((r) => r.cash03)), n03: rs.reduce((s, r) => s + n(r.n03), 0),
      age15: conv(rs.map((r) => r.age15)), age30: conv(rs.map((r) => r.age30)), age60: conv(rs.map((r) => r.age60)), age61: conv(rs.map((r) => r.age61)),
      // Nguyên tệ (chỉ có nghĩa khi gộp theo tiền tệ).
      orig01: money ? dec(rs.map((r) => r.orig01)) : null, orig02: money ? dec(rs.map((r) => r.orig02)) : null, orig03: money ? dec(rs.map((r) => r.orig03)) : null,
    }));
  };
  const byCarrier = group((r) => r.carrier);
  const byCurrency = group((r) => r.cur);
  const total = group(() => "all")[0] ?? null;
  return { byCarrier, byCurrency, total, showMoney: money };
}

export const OUTSTANDING_PAGE = 50;
/** COD đã thu mà chưa về tiền (CASH-03), thu lâu nhất lên đầu — để nhắc hãng. */
export async function outstandingCod(u: SessionUser, f: { carrier?: string; page: number }, now = new Date()) {
  requirePerm(u, "fulfillment.view");
  const w = Prisma.join([
    Prisma.sql`s."workspaceId" = ${u.workspaceId}`, Prisma.sql`s."codAmount" IS NOT NULL`, Prisma.sql`s."collectedAt" IS NOT NULL`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM "SettlementLine" l WHERE l."orderId" = s."orderId" AND l."trackingNo" = s."trackingNo")`,
    ...(f.carrier ? [Prisma.sql`s."carrier" = ${f.carrier}`] : []),
  ], " AND ");
  const [rows, [{ n }]] = await Promise.all([
    db.$queryRaw<{ orderId: string; orderNumber: string; trackingNo: string | null; carrier: string | null; codAmount: Prisma.Decimal; currency: string; collectedAt: Date }[]>`
      SELECT s."orderId", o."orderNumber", s."trackingNo", s."carrier", s."codAmount", o."currency", s."collectedAt"
      FROM "Shipment" s JOIN "Order" o ON o."id" = s."orderId" WHERE ${w}
      ORDER BY s."collectedAt" ASC, s."id" LIMIT ${OUTSTANDING_PAGE} OFFSET ${(f.page - 1) * OUTSTANDING_PAGE}`,
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Shipment" s WHERE ${w}`,
  ]);
  const money = can(u.roles, "finance.view");
  return {
    total: n, page: f.page, pageSize: OUTSTANDING_PAGE,
    rows: rows.map((r) => ({ ...r, codAmount: money ? r.codAmount.toString() : null, collectedAt: r.collectedAt.toISOString(), days: Math.floor((now.getTime() - r.collectedAt.getTime()) / 86_400_000) })),
  };
}

/** Bốn mốc COD của một đơn (trang đơn, trang khách). null khi đơn không phải COD. Tiền ẩn khi thiếu finance.view. */
export async function orderCodSteps(u: SessionUser, orderIds: string[]) {
  requirePerm(u, "order.view");
  if (!orderIds.length) return new Map<string, ReturnType<typeof codSteps>>();
  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, bookedAt: true, netAmount: true, status: true,
      shipments: { select: { trackingNo: true, status: true, codAmount: true, deliveredAt: true, collectedAt: true } },
      settlementLines: { select: { trackingNo: true, amount: true, remittedAt: true, settlement: { select: { reference: true } } } } },
  });
  const money = can(u.roles, "finance.view");
  return new Map(orders.map((o) => {
    const steps = codSteps({ bookedAt: o.bookedAt, netAmount: o.netAmount.toString(), status: o.status },
      o.shipments.map((s) => ({ ...s, codAmount: s.codAmount?.toString() ?? null })),
      o.settlementLines.map((l) => ({ trackingNo: l.trackingNo, amount: l.amount.toString(), remittedAt: l.remittedAt, reference: l.settlement.reference })));
    return [o.id, steps && !money ? steps.map((s) => ({ ...s, amount: null })) : steps];
  }));
}

/** Bảng đối soát gần đây (trang Đối soát). */
export async function recentSettlements(u: SessionUser, take = 10) {
  requirePerm(u, "fulfillment.view");
  const rows = await db.settlement.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, carrier: true, reference: true, createdAt: true, createdById: true, lines: { select: { amount: true, currency: true, remittedAt: true } } } });
  const users = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById).filter(Boolean))] as string[] } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  const money = can(u.roles, "finance.view");
  return rows.map((r) => {
    const byCur = new Map<string, Prisma.Decimal>();
    for (const l of r.lines) byCur.set(l.currency, (byCur.get(l.currency) ?? new D(0)).add(l.amount));
    const days = r.lines.map((l) => day(l.remittedAt)).sort();
    return {
      id: r.id, carrier: r.carrier, reference: r.reference, createdAt: r.createdAt.toISOString(), by: r.createdById ? (users.get(r.createdById) ?? "—") : "—",
      lines: r.lines.length, from: days[0] ?? null, to: days.at(-1) ?? null,
      totals: money ? [...byCur].map(([currency, v]) => ({ currency, amount: v.toString() })) : null,
    };
  });
}

// Phân khúc động (Phase 7): cây điều kiện JSON → điều kiện truy vấn khách (chỉ trường trong danh sách cho phép), xem trước, chạy = ảnh chụp.
// Lọc theo chỉ số/điểm của Phase 6 qua quan hệ Customer.metrics / Customer.scores (phiên bản điểm đang dùng).
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { bindTenant, db, type Db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { piiFor } from "@/lib/pii";
import { requirePerm, type SessionUser } from "@/lib/session";

const DAY = 86400000;
export const CMPS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "has", "not_has"] as const;
export type Cmp = (typeof CMPS)[number];
export type Rule = { field: string; cmp: Cmp; value: unknown };
export type Group = { op: "and" | "or"; rules: (Rule | Group)[] };
/** `versions`: id phiên bản điểm đang dùng theo loại — có thì lọc thẳng theo versionId (dùng chỉ mục), không có thì lọc version.active. */
type Ctx = { now: Date; money: boolean; versions?: Partial<Record<"RFM" | "TXN_RISK" | "SUPPORT_NEED", string>> };

const num = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ValidationError({ rules: `Giá trị "${String(v)}" phải là số` });
  return n;
};
const numCmp = (cmp: Cmp, v: unknown) => {
  const n = num(v);
  const m: Partial<Record<Cmp, object>> = { eq: { equals: n }, neq: { not: n }, gt: { gt: n }, gte: { gte: n }, lt: { lt: n }, lte: { lte: n } };
  if (!m[cmp]) throw new ValidationError({ rules: `Phép so sánh "${cmp}" không dùng cho số` });
  return m[cmp]!;
};
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : [String(v)]);
/** Điều kiện trên chỉ số R12M mới nhất (CustomerMetric, Phase 6). */
const metric = (w: Prisma.CustomerMetricWhereInput): Prisma.CustomerWhereInput => ({ metrics: { some: { period: "R12M", ...w } } });
/** Điều kiện trên điểm hiện hành của một loại (phiên bản đang dùng). */
const score = (type: "RFM" | "TXN_RISK" | "SUPPORT_NEED", cmp: Cmp, v: unknown, ctx: Ctx): Prisma.CustomerWhereInput => {
  const band = cmp === "in" ? { in: list(v) } : cmp === "eq" ? String(v) : null;
  const ver: Prisma.ScoreWhereInput = ctx.versions?.[type] ? { versionId: ctx.versions[type] } : { type, version: { active: true } };
  if (band != null) return { scores: { some: { ...ver, band } } };
  if (cmp === "neq") return { scores: { none: { ...ver, band: String(v) } } };
  throw new ValidationError({ rules: "Hạng chỉ so sánh bằng / khác / thuộc" });
};

export type FieldDef = { label: string; type: "number" | "enum" | "tags" | "bool"; unit?: string; money?: boolean; options?: { value: string; label: string }[]; compile(cmp: Cmp, v: unknown, ctx: Ctx): Prisma.CustomerWhereInput };

export const RFM_OPTIONS = [["CHAMPIONS", "Khách tốt nhất"], ["TRUNG_THANH", "Trung thành"], ["MOI", "Mới"], ["CO_NGUY_CO", "Có nguy cơ rời bỏ"], ["NGU_DONG", "Ngủ đông"], ["CAN_CHAM_SOC", "Cần chăm sóc"], ["CHUA_DU_DU_LIEU", "Chưa đủ dữ liệu"]].map(([value, label]) => ({ value, label }));
export const BAND_OPTIONS = [["CAO", "Cao"], ["VUA", "Vừa"], ["THAP", "Thấp"], ["CHUA_DU_DU_LIEU", "Chưa đủ dữ liệu"]].map(([value, label]) => ({ value, label }));

/** Danh sách trường cho phép. Thêm trường = thêm một dòng ở đây; không có đường nào để chèn truy vấn tùy ý. */
export const FIELDS: Record<string, FieldDef> = {
  market: { label: "Thị trường", type: "enum", compile: (cmp, v) => (cmp === "neq" ? { marketId: { not: String(v) } } : { marketId: cmp === "in" ? { in: list(v) } : String(v) }) },
  brand: { label: "Đã mua brand", type: "enum", compile: (cmp, v) => (cmp === "neq" ? { orders: { none: { store: { brandId: String(v) } } } } : { orders: { some: { store: { brandId: cmp === "in" ? { in: list(v) } : String(v) } } } }) },
  tag: { label: "Thẻ", type: "tags", compile: (cmp, v) => (cmp === "not_has" ? { NOT: { tags: { has: String(v) } } } : { tags: { has: String(v) } }) },
  language: { label: "Ngôn ngữ khách", type: "enum", options: [["vi", "Tiếng Việt"], ["en", "English"], ["ar", "العربية"], ["de", "Deutsch"]].map(([value, label]) => ({ value, label })), compile: (cmp, v) => (cmp === "neq" ? { NOT: { locale: { startsWith: String(v) } } } : { locale: { startsWith: String(v) } }) },
  orderCount: { label: "Tổng số đơn (trọn đời)", type: "number", unit: "đơn", compile: (cmp, v) => ({ orderCount: numCmp(cmp, v) }) },
  lastOrderDays: {
    label: "Số ngày từ lần đặt gần nhất", type: "number", unit: "ngày",
    // "≥ N ngày" = đặt lần cuối trước mốc (now − N ngày): đảo chiều so sánh trên lastOrderAt.
    compile: (cmp, v, ctx) => {
      const at = new Date(ctx.now.getTime() - num(v) * DAY);
      const m: Partial<Record<Cmp, object>> = { gte: { lte: at }, gt: { lt: at }, lte: { gte: at }, lt: { gt: at } };
      if (!m[cmp]) throw new ValidationError({ rules: "Số ngày chỉ so sánh lớn/nhỏ hơn" });
      return { lastOrderAt: m[cmp]! };
    },
  },
  recencyDays: { label: "Số ngày từ lần giao thành công gần nhất (R)", type: "number", unit: "ngày", compile: (cmp, v) => metric({ recencyDays: numCmp(cmp, v) }) },
  daysToNextPurchase: { label: "Số ngày tới chu kỳ mua kế tiếp", type: "number", unit: "ngày", compile: (cmp, v) => metric({ daysToNextPurchase: numCmp(cmp, v) }) },
  deliveredOrders: { label: "Đơn giao thành công 12 tháng (F)", type: "number", unit: "đơn", compile: (cmp, v) => metric({ deliveredOrders: numCmp(cmp, v) }) },
  rev03: {
    label: "REV-03 12 tháng (M)", type: "number", unit: "VND", money: true,
    compile: (cmp, v, ctx) => {
      if (!ctx.money) throw new HttpError(403, "Lọc theo giá trị tiền cần quyền xem tiền (finance.view)");
      return metric({ rev03: numCmp(cmp, v) });
    },
  },
  repurchase60: { label: "Đã mua lại trong 60 ngày", type: "bool", compile: (cmp, v) => metric({ repurchase60: (cmp === "neq") !== (v === true || v === "true") }) },
  openTickets: { label: "Ticket đang mở", type: "number", unit: "ticket", compile: (cmp, v) => metric({ openTickets: numCmp(cmp, v) }) },
  rfm: { label: "Hạng RFM", type: "enum", options: RFM_OPTIONS, compile: (cmp, v, ctx) => score("RFM", cmp, v, ctx) },
  txnRisk: { label: "Rủi ro giao dịch", type: "enum", options: BAND_OPTIONS, compile: (cmp, v, ctx) => score("TXN_RISK", cmp, v, ctx) },
  supportNeed: { label: "Nhu cầu hỗ trợ", type: "enum", options: BAND_OPTIONS, compile: (cmp, v, ctx) => score("SUPPORT_NEED", cmp, v, ctx) },
};

const ruleSchema: z.ZodType<Rule | Group> = z.lazy(() => z.union([
  z.object({ op: z.enum(["and", "or"]), rules: z.array(ruleSchema).min(1, "Nhóm điều kiện rỗng").max(20, "Tối đa 20 điều kiện mỗi nhóm") }),
  z.object({ field: z.string(), cmp: z.enum(CMPS), value: z.unknown() }),
]));
export const groupSchema = z.object({ op: z.enum(["and", "or"]), rules: z.array(ruleSchema).min(1, "Cần ít nhất một điều kiện").max(20) });

/** Phép so sánh hợp lệ theo kiểu trường — kiểm một chỗ cho mọi trường (giao diện dùng CMPS_BY_TYPE ở labels.ts, tập con của đây). */
const ALLOWED: Record<FieldDef["type"], readonly Cmp[]> = { number: ["eq", "neq", "gt", "gte", "lt", "lte"], enum: ["eq", "neq", "in"], tags: ["has", "not_has"], bool: ["eq", "neq"] };

/** Dịch cây điều kiện → điều kiện truy vấn khách. Hàm thuần (không DB) — có bảng test. Độ sâu tối đa 3. */
export function compileRules(g: Group, ctx: Ctx, depth = 0): Prisma.CustomerWhereInput {
  if (depth > 2) throw new ValidationError({ rules: "Lồng nhóm tối đa 3 cấp" });
  const parts = g.rules.map((r) => {
    if ("op" in r) return compileRules(r, ctx, depth + 1);
    const f = FIELDS[r.field];
    if (!f) throw new ValidationError({ rules: `Trường "${r.field}" không được hỗ trợ` });
    if (!ALLOWED[f.type].includes(r.cmp)) throw new ValidationError({ rules: `Phép so sánh "${r.cmp}" không dùng cho trường "${f.label}"` });
    return f.compile(r.cmp, r.value, ctx);
  });
  return g.op === "and" ? { AND: parts } : { OR: parts };
}

/** Điều kiện khách đầy đủ cho một phân khúc: khách còn hiệu lực (chưa bị gộp) + cây điều kiện. */
/** Ngữ cảnh chạy thật: kèm id phiên bản điểm đang dùng (một truy vấn). */
export async function segmentCtx(client: Pick<Db, "scoreVersion">, now: Date, money: boolean): Promise<Ctx> {
  const vs = await client.scoreVersion.findMany({ where: { active: true, type: { in: ["RFM", "TXN_RISK", "SUPPORT_NEED"] } }, select: { id: true, type: true } });
  return { now, money, versions: Object.fromEntries(vs.map((v) => [v.type, v.id])) };
}
export const segmentWhere = (rules: Group, ctx: Ctx): Prisma.CustomerWhereInput => ({ AND: [{ mergedIntoId: null }, compileRules(rules, ctx)] });

// ---- Service cho giao diện ----

/** Siêu dữ liệu cho trình dựng điều kiện: nhãn, kiểu, lựa chọn (thị trường, brand, thẻ đang dùng). Trường tiền ẩn khi thiếu quyền. */
export async function segmentFields(user: SessionUser) {
  requirePerm(user, "segment.manage");
  const money = can(user.roles, "finance.view");
  const [markets, brands, tags] = await Promise.all([
    db.market.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    db.brand.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    db.$queryRawUnsafe<{ tag: string }[]>(`SELECT DISTINCT unnest("tags") AS tag FROM "Customer" WHERE "workspaceId" = $1 LIMIT 100`, user.workspaceId),
  ]);
  const opts: Record<string, { value: string; label: string }[]> = {
    market: markets.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` })),
    brand: brands.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` })),
    tag: tags.map((t) => ({ value: t.tag, label: t.tag })),
  };
  return Object.entries(FIELDS).filter(([, f]) => !f.money || money).map(([key, f]) => ({ key, label: f.label, type: f.type, unit: f.unit ?? null, options: f.options ?? opts[key] ?? null }));
}
export type SegmentField = Awaited<ReturnType<typeof segmentFields>>[number];

/** Xem trước: số khách + 20 khách mẫu (SĐT/email che theo quyền). */
export async function previewSegment(user: SessionUser, rulesInput: unknown, now = new Date()) {
  requirePerm(user, "segment.manage");
  const rules = parse(groupSchema, rulesInput) as Group;
  const where = segmentWhere(rules, await segmentCtx(db, now, can(user.roles, "finance.view")));
  const pii = piiFor(user);
  const [count, sample] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, take: 20, orderBy: { lastOrderAt: { sort: "desc", nulls: "last" } }, select: { id: true, displayName: true, primaryPhoneE164: true, lastOrderAt: true, market: { select: { code: true } } } }),
  ]);
  return { count, sample: sample.map((c) => ({ id: c.id, name: c.displayName, phone: pii.phone(c.primaryPhoneE164), market: c.market?.code ?? null, lastOrderAt: c.lastOrderAt?.toISOString() ?? null })) };
}

export const saveSegmentSchema = z.object({
  id: z.string().optional().transform((v) => v || undefined),
  name: z.string().trim().min(2, "Nhập tên (tối thiểu 2 ký tự)").max(120),
  description: z.string().trim().max(500).optional().transform((v) => v || undefined),
  rules: groupSchema,
});

export async function saveSegment(user: SessionUser, input: unknown, now = new Date()) {
  requirePerm(user, "segment.manage");
  const d = parse(saveSegmentSchema, input);
  compileRules(d.rules as Group, { now, money: can(user.roles, "finance.view") }); // kiểm hợp lệ + quyền trường tiền trước khi lưu
  return db.$transaction(async (tx) => {
    const before = d.id ? await tx.segment.findFirst({ where: { id: d.id } }) : null;
    if (d.id && !before) throw new HttpError(404, "Không tìm thấy phân khúc");
    const seg = d.id
      ? await tx.segment.update({ where: { id: d.id }, data: { name: d.name, description: d.description ?? null, rules: d.rules as Prisma.InputJsonValue } })
      : await tx.segment.create({ data: { name: d.name, description: d.description, rules: d.rules as Prisma.InputJsonValue, createdById: user.id } as never });
    await audit(tx, { actorId: user.id, entity: "Segment", entityId: seg.id, action: d.id ? "update" : "create", before: before ? { name: before.name, rules: before.rules } : undefined, after: { name: seg.name, rules: seg.rules } });
    return seg;
  });
}

/**
 * Chạy phân khúc: lấy danh sách khách theo điều kiện hiện tại, lưu SegmentRun (ảnh chụp điều kiện + số khách) và danh sách khách
 * của lần chạy này; xóa danh sách của các lần trước (giữ metadata) để bảng không phình (D-55). Hệ thống chạy với quyền đầy đủ.
 */
export async function runSegmentFor(client: Db, segmentId: string, ranById: string | null, now = new Date()) {
  const t = Date.now();
  const seg = await client.segment.findFirst({ where: { id: segmentId } });
  if (!seg) throw new HttpError(404, "Không tìm thấy phân khúc");
  const where = segmentWhere(seg.rules as Group, await segmentCtx(client, now, true));
  // Một truy vấn lấy toàn bộ id (phân trang bằng cursor sẽ chạy lại điều kiện nặng mỗi trang).
  // ponytail: giữ id trong bộ nhớ (~50 byte/khách, 200k khách ≈ 10 MB); quá lớn thì chuyển INSERT … SELECT bằng SQL thô.
  const ids = (await client.customer.findMany({ where, select: { id: true } })).map((c) => c.id);
  const run = await client.segmentRun.create({ data: { segmentId, rules: seg.rules as Prisma.InputJsonValue, count: ids.length, ms: 0, ranById } as never });
  for (let i = 0; i < ids.length; i += 10000) await client.segmentMember.createMany({ data: ids.slice(i, i + 10000).map((customerId) => ({ runId: run.id, customerId })) as never });
  const old = await client.segmentRun.findMany({ where: { segmentId, id: { not: run.id } }, select: { id: true } });
  if (old.length) await client.segmentMember.deleteMany({ where: { runId: { in: old.map((o) => o.id) } } });
  const ms = Date.now() - t;
  await client.segmentRun.update({ where: { id: run.id }, data: { ms } });
  await client.segment.update({ where: { id: segmentId }, data: { lastRunAt: now, lastCount: ids.length } });
  return { runId: run.id, count: ids.length, ms };
}

export async function runSegment(user: SessionUser, segmentId: string, now = new Date()) {
  requirePerm(user, "segment.manage");
  return runSegmentFor(db, segmentId, user.id, now);
}

export async function listSegments(user: SessionUser) {
  requirePerm(user, "segment.manage");
  const rows = await db.segment.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { journeys: true, campaigns: true } } } });
  return rows.map((s) => ({ id: s.id, name: s.name, description: s.description, rules: s.rules as Group, active: s.active, lastRunAt: s.lastRunAt?.toISOString() ?? null, lastCount: s.lastCount, journeys: s._count.journeys, campaigns: s._count.campaigns, updatedAt: s.updatedAt.toISOString() }));
}

export async function getSegment(user: SessionUser, id: string) {
  requirePerm(user, "segment.manage");
  bindTenant(user);
  const s = await db.segment.findFirst({ where: { id }, include: { runs: { orderBy: { createdAt: "desc" }, take: 10 }, journeys: { select: { id: true, name: true, status: true } } } });
  if (!s) throw new HttpError(404, "Không tìm thấy phân khúc");
  return {
    id: s.id, name: s.name, description: s.description, rules: s.rules as Group, active: s.active, lastRunAt: s.lastRunAt?.toISOString() ?? null, lastCount: s.lastCount,
    runs: s.runs.map((r) => ({ id: r.id, count: r.count, ms: r.ms, at: r.createdAt.toISOString() })), journeys: s.journeys,
  };
}
export type SegmentDetail = Awaited<ReturnType<typeof getSegment>>;

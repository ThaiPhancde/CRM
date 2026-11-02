// Cấu hình vận hành của team (Phase 11.1, /quan-tri/cau-hinh): ngưỡng SLA ticket, phân công lead, giới hạn liên hệ (frequency cap),
// giờ làm việc theo thị trường (khung gửi tin), ngưỡng tồn thấp. Tỷ giá + ngôn ngữ/múi giờ thị trường ở Danh mục; trọng số điểm ở Điểm khách hàng.
// Mọi thay đổi: quyền admin.settings ở server, zod, audit trước/sau trong cùng transaction (D-16).
import { Prisma, type TicketPriority } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parse, ValidationError } from "@/lib/errors";
import { requirePerm, type SessionUser } from "@/lib/session";
import { DEFAULT_CAP, QUIET } from "@/modules/marketing/journeys";
import { DEFAULT_LOW_STOCK } from "@/modules/products/service";
import { loadRouting, routingSchema } from "@/modules/sales/routing";
import { DEFAULT_SLA } from "@/modules/service/tickets";
import { TICKET_PRIORITIES } from "@/modules/service/labels";

export const CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "ZALO"] as const;

export async function getConfig(u: SessionUser) {
  requirePerm(u, "admin.settings");
  const [sla, caps, markets, brands, routing, hours, low] = await Promise.all([
    db.slaPolicy.findMany({ orderBy: [{ brandId: "asc" }, { priority: "asc" }] }),
    db.contactCap.findMany({ orderBy: [{ channel: "asc" }] }),
    db.market.findMany({ select: { id: true, code: true, name: true, timezone: true, locale: true }, orderBy: { code: "asc" } }),
    db.brand.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    loadRouting(db),
    db.setting.findFirst({ where: { key: "workingHours" } }),
    db.setting.findFirst({ where: { key: "inventory.lowStock" } }),
  ]);
  const wh = (hours?.value ?? {}) as Record<string, { from: number; to: number }>;
  const ls = (low?.value ?? {}) as Record<string, number>;
  const slaOf = (brandId: string | null, p: TicketPriority) => sla.find((x) => x.brandId === brandId && x.priority === p);
  return {
    brands, markets,
    /** Mọi brand (null) + từng brand × 4 mức; dòng chưa cấu hình hiện mặc định D-50. */
    sla: [null, ...brands.map((b) => b.id)].flatMap((brandId) => TICKET_PRIORITIES.map((priority) => {
      const r = slaOf(brandId, priority);
      return { brandId, priority, firstResponseHours: r?.firstResponseHours ?? (brandId ? null : DEFAULT_SLA[priority].firstResponseHours), resolveHours: r?.resolveHours ?? (brandId ? null : DEFAULT_SLA[priority].resolveHours), custom: !!r };
    })),
    routing: { firstResponseHours: routing.firstResponseHours, maxOpenPerUser: routing.maxOpenPerUser, autoCloseDays: routing.autoCloseDays, dedupeDays: routing.dedupeDays, rules: routing.rules },
    caps: CHANNELS.map((channel) => {
      const r = caps.find((c) => c.channel === channel && c.brandId === null);
      return { channel, maxCount: r?.maxCount ?? DEFAULT_CAP.maxCount, windowDays: r?.windowDays ?? DEFAULT_CAP.windowDays, custom: !!r };
    }),
    brandCaps: caps.filter((c) => c.brandId).map((c) => ({ channel: c.channel, brandId: c.brandId!, maxCount: c.maxCount, windowDays: c.windowDays })),
    hours: { default: wh["*"] ?? QUIET, byMarket: markets.map((m) => ({ code: m.code, name: m.name, timezone: m.timezone, locale: m.locale, from: wh[m.code]?.from ?? null, to: wh[m.code]?.to ?? null })) },
    lowStock: { default: typeof ls["*"] === "number" ? ls["*"] : DEFAULT_LOW_STOCK, byMarket: markets.map((m) => ({ code: m.code, value: typeof ls[m.code] === "number" ? ls[m.code] : null })) },
  };
}

const hours = z.coerce.number({ message: "Nhập số giờ" }).positive("Phải lớn hơn 0").max(720, "Tối đa 720 giờ");
/** Ô trống hoặc chỉ khoảng trắng = "để trống" (không thành 0). */
const blank = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const optInt = (max: number) => z.preprocess(blank, z.union([z.literal("").transform(() => null), z.coerce.number().int("Số nguyên").min(0, "Không âm").max(max, `Tối đa ${max}`)]).nullable().optional());

/** Upsert Setting + audit (giữ một dòng / key / team). */
async function saveSetting(u: SessionUser, key: string, value: Prisma.InputJsonValue, entity = "Setting") {
  return db.$transaction(async (tx) => {
    const prev = await tx.setting.findFirst({ where: { key } });
    if (prev) await tx.setting.update({ where: { id: prev.id }, data: { value } });
    else await tx.setting.create({ data: { key, value } as Prisma.SettingUncheckedCreateInput });
    await audit(tx, { actorId: u.id, entity, entityId: key, action: "update", before: prev?.value ?? null, after: value });
  });
}

export const slaSchema = z.object({
  brandId: z.string().trim().optional().transform((v) => v || null),
  priority: z.enum(TICKET_PRIORITIES, { message: "Chọn mức" }),
  firstResponseHours: hours,
  resolveHours: hours,
}).refine((d) => d.resolveHours >= d.firstResponseHours, { path: ["resolveHours"], message: "Hạn xử lý phải ≥ hạn phản hồi đầu" });

/** Ngưỡng SLA: một dòng / (brand hoặc mọi brand, mức). Chỉ áp cho ticket tạo sau khi đổi (ticket cũ giữ hạn đã tính). */
export async function saveSla(u: SessionUser, input: unknown) {
  requirePerm(u, "admin.settings");
  const d = parse(slaSchema, input);
  if (d.brandId && !(await db.brand.findFirst({ where: { id: d.brandId } }))) throw new ValidationError({ brandId: "Brand không thuộc team" });
  return db.$transaction(async (tx) => {
    const prev = await tx.slaPolicy.findFirst({ where: { brandId: d.brandId, priority: d.priority } });
    const data = { firstResponseHours: d.firstResponseHours, resolveHours: d.resolveHours };
    const row = prev ? await tx.slaPolicy.update({ where: { id: prev.id }, data }) : await tx.slaPolicy.create({ data: { brandId: d.brandId, priority: d.priority, ...data } as Prisma.SlaPolicyUncheckedCreateInput });
    await audit(tx, { actorId: u.id, entity: "SlaPolicy", entityId: row.id, action: prev ? "update" : "create", before: prev, after: row });
    return row;
  });
}

export const routingNumbers = z.object({
  firstResponseHours: hours,
  maxOpenPerUser: z.coerce.number().int("Số nguyên").min(1, "Ít nhất 1").max(500, "Tối đa 500"),
  autoCloseDays: z.coerce.number().int("Số nguyên").min(0, "Không âm").max(365, "Tối đa 365"),
  dedupeDays: z.coerce.number().int("Số nguyên").min(0, "Không âm").max(90, "Tối đa 90"),
});
/** Thông số phân công lead (giữ nguyên quy tắc brand/market → nhóm). */
export async function saveRouting(u: SessionUser, input: unknown) {
  requirePerm(u, "admin.settings");
  const d = parse(routingNumbers, input);
  const cur = await loadRouting(db);
  await saveSetting(u, "leadRouting", routingSchema.parse({ ...cur, ...d }) as unknown as Prisma.InputJsonValue);
}

export const capSchema = z.object({
  channel: z.enum(CHANNELS, { message: "Chọn kênh" }),
  maxCount: z.coerce.number().int("Số nguyên").min(0, "Không âm").max(50, "Tối đa 50"),
  windowDays: z.coerce.number().int("Số nguyên").min(1, "Ít nhất 1 ngày").max(90, "Tối đa 90"),
});
/** Giới hạn liên hệ mặc định của kênh (mọi brand). maxCount 0 = không gửi kênh này. */
export async function saveCap(u: SessionUser, input: unknown) {
  requirePerm(u, "admin.settings");
  const d = parse(capSchema, input);
  return db.$transaction(async (tx) => {
    const prev = await tx.contactCap.findFirst({ where: { channel: d.channel, brandId: null } });
    const row = prev ? await tx.contactCap.update({ where: { id: prev.id }, data: { maxCount: d.maxCount, windowDays: d.windowDays } })
      : await tx.contactCap.create({ data: { channel: d.channel, maxCount: d.maxCount, windowDays: d.windowDays } as Prisma.ContactCapUncheckedCreateInput });
    await audit(tx, { actorId: u.id, entity: "ContactCap", entityId: row.id, action: prev ? "update" : "create", before: prev, after: row });
    return row;
  });
}

const hour = (label: string) => z.preprocess(blank, z.union([z.literal("").transform(() => null), z.coerce.number().int(`${label}: số nguyên`).min(0, `${label}: 0–24`).max(24, `${label}: 0–24`)]).nullable().optional());
export const hoursSchema = z.object({ market: z.string().trim().min(1), from: hour("Từ giờ"), to: hour("Đến giờ") })
  .refine((d) => (d.from == null) === (d.to == null), { path: ["to"], message: "Nhập cả giờ bắt đầu và kết thúc, hoặc để trống cả hai" })
  .refine((d) => d.from == null || d.to! - d.from >= 2, { path: ["to"], message: "Khung gửi tối thiểu 2 giờ" });
/** Giờ làm việc (khung được gửi tin) theo thị trường, giờ địa phương. market "*" = mặc định; để trống = dùng mặc định. */
export async function saveHours(u: SessionUser, input: unknown) {
  requirePerm(u, "admin.settings");
  const d = parse(hoursSchema, input);
  if (d.market !== "*" && !(await db.market.findFirst({ where: { code: d.market } }))) throw new ValidationError({ market: "Thị trường không thuộc team" });
  if (d.market === "*" && d.from == null) throw new ValidationError({ from: "Khung mặc định không được để trống" });
  const cur = ((await db.setting.findFirst({ where: { key: "workingHours" } }))?.value ?? {}) as Record<string, { from: number; to: number }>;
  const next = { ...cur };
  if (d.from == null) delete next[d.market]; else next[d.market] = { from: d.from, to: d.to! };
  await saveSetting(u, "workingHours", next);
}

export const lowStockSchema = z.object({ market: z.string().trim().min(1), value: optInt(100_000) });
/** Ngưỡng tồn thấp theo thị trường (đơn vị). market "*" = mặc định; để trống = dùng mặc định. */
export async function saveLowStock(u: SessionUser, input: unknown) {
  requirePerm(u, "admin.settings");
  const d = parse(lowStockSchema, input);
  if (d.market !== "*" && !(await db.market.findFirst({ where: { code: d.market } }))) throw new ValidationError({ market: "Thị trường không thuộc team" });
  if (d.market === "*" && d.value == null) throw new ValidationError({ value: "Ngưỡng mặc định không được để trống" });
  const cur = ((await db.setting.findFirst({ where: { key: "inventory.lowStock" } }))?.value ?? {}) as Record<string, number>;
  const next = { ...cur };
  if (d.value == null) delete next[d.market]; else next[d.market] = d.value;
  await saveSetting(u, "inventory.lowStock", next);
}

// Quản trị workspace: thành viên + danh mục (brand, store, market, team, tỷ giá). Mọi hàm kiểm quyền ở server,
// validate bằng zod, ghi audit trong cùng transaction (D-16). Gọi từ server action hoặc route — không tin dữ liệu client.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, rootDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { ROLES } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";

const code = z.string().trim().min(1, "Bắt buộc").max(30, "Tối đa 30 ký tự")
  .regex(/^[A-Za-z0-9_-]+$/, "Chỉ chữ, số, - và _").transform((s) => s.toUpperCase());
const name = z.string().trim().min(1, "Bắt buộc").max(120, "Tối đa 120 ký tự");
const active = z.coerce.boolean().default(true);

/** Lỗi validate gom theo trường để form hiện inline. */
export class ValidationError extends HttpError {
  constructor(public fields: Record<string, string>) {
    super(400, "Dữ liệu chưa hợp lệ");
  }
}
function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  throw new ValidationError(fields);
}
function duplicate(e: unknown, field: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError({ [field]: "Đã tồn tại trong team này" });
  throw e;
}

// ---- Thành viên ----------------------------------------------------------------------------------

export async function listMembers(user: SessionUser) {
  requirePerm(user, "admin.users");
  // Membership không lọc tự động (bảng phân quyền toàn hệ thống) → lọc tường minh theo workspace của người gọi.
  return rootDb.membership.findMany({
    where: { workspaceId: user.workspaceId },
    include: { user: true, team: true },
    orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
  });
}

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  name,
  roles: z.array(z.enum(ROLES)).min(1, "Chọn ít nhất một vai trò"),
  teamId: z.string().optional().transform((v) => v || null),
});

export async function addMember(user: SessionUser, input: unknown) {
  requirePerm(user, "admin.users");
  const d = parse(memberSchema, input);
  if (d.teamId && !(await db.team.findFirst({ where: { id: d.teamId } }))) throw new ValidationError({ teamId: "Nhóm không thuộc team này" });
  return rootDb.$transaction(async (tx) => {
    const u = await tx.user.upsert({ where: { email: d.email }, update: {}, create: { email: d.email, name: d.name } });
    const exists = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: user.workspaceId, userId: u.id } } });
    if (exists) throw new ValidationError({ email: "Người này đã là thành viên" });
    const m = await tx.membership.create({ data: { workspaceId: user.workspaceId, userId: u.id, roles: d.roles, teamId: d.teamId } });
    await tx.auditLog.create({ data: { workspaceId: user.workspaceId, actorId: user.id, entity: "Membership", entityId: m.id, action: "create", after: { email: d.email, roles: d.roles } } });
    return m;
  });
}

const updateMemberSchema = z.object({
  id: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1, "Chọn ít nhất một vai trò"),
  teamId: z.string().optional().transform((v) => v || null),
  active,
});

export async function updateMember(user: SessionUser, input: unknown) {
  requirePerm(user, "admin.users");
  const d = parse(updateMemberSchema, input);
  const m = await rootDb.membership.findFirst({ where: { id: d.id, workspaceId: user.workspaceId } });
  if (!m) throw new HttpError(404, "Không tìm thấy thành viên");
  if (m.userId === user.id && (!d.active || !d.roles.includes("MANAGER"))) {
    throw new ValidationError({ roles: "Không tự khóa hoặc tự bỏ quyền Quản lý của chính mình" });
  }
  if (d.teamId && !(await db.team.findFirst({ where: { id: d.teamId } }))) throw new ValidationError({ teamId: "Nhóm không thuộc team này" });
  return rootDb.$transaction(async (tx) => {
    const after = await tx.membership.update({ where: { id: m.id }, data: { roles: d.roles, teamId: d.teamId, active: d.active } });
    await tx.auditLog.create({
      data: { workspaceId: user.workspaceId, actorId: user.id, entity: "Membership", entityId: m.id, action: "update",
        before: { roles: m.roles, teamId: m.teamId, active: m.active }, after: { roles: d.roles, teamId: d.teamId, active: d.active } },
    });
    return after;
  });
}

// ---- Danh mục ------------------------------------------------------------------------------------

export async function getCatalog(user: SessionUser) {
  requirePerm(user, "catalog.view");
  const [brands, stores, markets, teams, fxRates] = await Promise.all([
    db.brand.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { stores: true } } } }),
    db.store.findMany({ orderBy: { code: "asc" }, include: { brand: true, markets: true } }),
    db.market.findMany({ orderBy: { code: "asc" } }),
    db.team.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { members: true } } } }),
    db.fxRate.findMany({ orderBy: [{ currency: "asc" }, { validFrom: "desc" }] }),
  ]);
  return { brands, stores, markets, teams, fxRates };
}

const id = z.string().optional().transform((v) => v || undefined);

const schemas = {
  brand: z.object({ id, code, name, active }),
  team: z.object({ id, code, name, active }),
  market: z.object({
    id, name, active,
    code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Mã quốc gia 2 chữ (ISO), ví dụ AE"),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Mã tiền tệ 3 chữ (ISO 4217), ví dụ AED"),
    paymentMode: z.enum(["PREPAID", "COD"]),
    timezone: z.string().trim().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Múi giờ IANA không hợp lệ, ví dụ Asia/Dubai"),
    locale: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Ví dụ ar-AE"),
  }),
  store: z.object({
    id, code, name, active,
    brandId: z.string().min(1, "Chọn brand"),
    // D-28: mã adapter tự do (chữ thường), không giới hạn danh sách cứng.
    platform: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,30}$/, "Mã nền tảng chữ thường, ví dụ shopify"),
    externalId: z.string().trim().max(120).optional().transform((v) => v || null),
    marketIds: z.array(z.string()).min(1, "Chọn ít nhất một thị trường"),
  }),
  fxRate: z.object({
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Mã tiền tệ 3 chữ"),
    rateToUsd: z.string().trim().regex(/^\d+(\.\d{1,8})?$/, "Số dương, tối đa 8 chữ số thập phân")
      .refine((v) => Number(v) > 0, "Phải lớn hơn 0"),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dạng YYYY-MM-DD"),
  }),
};

export type CatalogKind = keyof typeof schemas;

/** Tạo/sửa một mục danh mục. Không xóa: ngừng dùng bằng active=false để không gãy dữ liệu đã tham chiếu. */
export async function saveCatalog(user: SessionUser, kind: CatalogKind, input: unknown) {
  requirePerm(user, "admin.settings");
  const log = (entityId: string, action: string, before: unknown, after: unknown) =>
    audit(db, { actorId: user.id, entity: kind, entityId, action, before, after });

  try {
    if (kind === "fxRate") {
      // Tỷ giá chỉ thêm mốc mới, không sửa mốc cũ (giữ lịch sử quy đổi của đơn đã chốt — D-09).
      const d = parse(schemas.fxRate, input);
      const row = await db.fxRate.create({ data: { currency: d.currency, rateToUsd: d.rateToUsd, validFrom: new Date(d.validFrom) } as never });
      await log(row.id, "create", null, d);
      return row;
    }
    if (kind === "store") {
      const d = parse(schemas.store, input);
      if (!(await db.brand.findFirst({ where: { id: d.brandId } }))) throw new ValidationError({ brandId: "Brand không thuộc team này" });
      const markets = await db.market.findMany({ where: { id: { in: d.marketIds } } });
      if (markets.length !== new Set(d.marketIds).size) throw new ValidationError({ marketIds: "Thị trường không thuộc team này" });
      const data = { code: d.code, name: d.name, active: d.active, brandId: d.brandId, platform: d.platform, externalId: d.externalId };
      if (d.id) {
        const before = await db.store.findFirst({ where: { id: d.id }, include: { markets: true } });
        if (!before) throw new HttpError(404, "Không tìm thấy");
        const row = await db.store.update({ where: { id: d.id }, data: { ...data, markets: { set: d.marketIds.map((m) => ({ id: m })) } } });
        await log(row.id, "update", { ...before, markets: before.markets.map((m) => m.code) }, { ...data, markets: markets.map((m) => m.code) });
        return row;
      }
      const row = await db.store.create({ data: { ...data, markets: { connect: d.marketIds.map((m) => ({ id: m })) } } as never });
      await log(row.id, "create", null, { ...data, markets: markets.map((m) => m.code) });
      return row;
    }
    const d = parse(schemas[kind], input) as { id?: string } & Record<string, unknown>;
    const { id: rowId, ...data } = d;
    const model = db[kind] as unknown as {
      findFirst(a: object): Promise<object | null>;
      update(a: object): Promise<{ id: string }>;
      create(a: object): Promise<{ id: string }>;
    };
    if (rowId) {
      const before = await model.findFirst({ where: { id: rowId } });
      if (!before) throw new HttpError(404, "Không tìm thấy");
      const row = await model.update({ where: { id: rowId }, data });
      await log(row.id, "update", before, data);
      return row;
    }
    const row = await model.create({ data });
    await log(row.id, "create", null, data);
    return row;
  } catch (e) {
    duplicate(e, kind === "fxRate" ? "validFrom" : "code");
  }
}

export async function listAudit(user: SessionUser, take = 100) {
  requirePerm(user, "admin.audit");
  return db.auditLog.findMany({ orderBy: { at: "desc" }, take });
}

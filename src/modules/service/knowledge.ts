// Tri thức (Phase 5): bài theo brand/market/ngôn ngữ, có phiên bản (chỉ thêm). Người đọc chỉ thấy bản đã xuất bản;
// người soạn thấy mọi phiên bản. Tiêu đề bài = tiêu đề bản đang xuất bản (hoặc bản mới nhất khi chưa xuất bản).
import type { KnowledgeStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError, parse, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { requirePerm, type SessionUser } from "@/lib/session";

export const KB_LANGUAGES = ["vi", "en", "ar", "de"] as const;
export const KB_PAGE_SIZE = 30;

export const kbFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().catch(undefined),
  language: z.enum(KB_LANGUAGES).optional().catch(undefined),
  brand: z.string().trim().max(40).optional().catch(undefined),
  market: z.string().trim().max(40).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
});
export type KbFilter = z.infer<typeof kbFilterSchema>;

export function parseKbFilter(sp: Record<string, string | string[] | undefined>): KbFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return kbFilterSchema.parse({ q: one("q"), status: one("status"), language: one("language"), brand: one("brand"), market: one("market"), page: one("page") });
}

const editor = (u: SessionUser) => can(u.roles, "knowledge.edit");

export async function listArticles(user: SessionUser, f: KbFilter) {
  requirePerm(user, "knowledge.view");
  const and: Prisma.KnowledgeArticleWhereInput[] = [editor(user) ? (f.status ? { status: f.status } : { status: { not: "ARCHIVED" } }) : { status: "PUBLISHED" }];
  if (f.language) and.push({ language: f.language });
  if (f.brand) and.push({ OR: [{ brandId: f.brand }, { brandId: null }] });
  if (f.market) and.push({ OR: [{ marketId: f.market }, { marketId: null }] });
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { tags: { has: f.q.toLowerCase() } }] });
  const w = { AND: and };
  const [total, rows, brands, markets] = await Promise.all([
    db.knowledgeArticle.count({ where: w }),
    db.knowledgeArticle.findMany({ where: w, orderBy: [{ updatedAt: "desc" }], skip: (f.page - 1) * KB_PAGE_SIZE, take: KB_PAGE_SIZE }),
    db.brand.findMany({ select: { id: true, code: true } }),
    db.market.findMany({ select: { id: true, code: true } }),
  ]);
  const b = new Map(brands.map((x) => [x.id, x.code]));
  const m = new Map(markets.map((x) => [x.id, x.code]));
  return {
    total, page: f.page, pageSize: KB_PAGE_SIZE, canEdit: editor(user),
    rows: rows.map((a) => ({
      id: a.id, title: a.title, language: a.language, status: a.status, brand: a.brandId ? b.get(a.brandId) ?? null : null, market: a.marketId ? m.get(a.marketId) ?? null : null,
      latestVersion: a.latestVersion, publishedVersion: a.publishedVersion, tags: a.tags, updatedAt: a.updatedAt.toISOString(),
      /** Có bản nháp mới hơn bản đang xuất bản. */
      hasDraft: a.publishedVersion != null && a.latestVersion > a.publishedVersion,
    })),
  };
}

/** Chi tiết bài + một phiên bản (mặc định: bản xuất bản với người đọc, bản mới nhất với người soạn). */
export async function getArticle(user: SessionUser, id: string, version?: number) {
  requirePerm(user, "knowledge.view");
  const a = await db.knowledgeArticle.findFirst({ where: { id, ...(editor(user) ? {} : { status: "PUBLISHED" }) }, include: { versions: { orderBy: { version: "desc" }, select: { version: true, title: true, createdAt: true, createdById: true } } } });
  if (!a) throw new HttpError(404, "Không tìm thấy bài tri thức");
  const want = editor(user) ? (version ?? a.latestVersion) : a.publishedVersion!;
  const v = await db.knowledgeVersion.findFirst({ where: { articleId: a.id, version: want } });
  if (!v) throw new HttpError(404, "Không có phiên bản này");
  const authors = new Map((await db.user.findMany({ where: { id: { in: a.versions.map((x) => x.createdById).filter(Boolean) as string[] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return {
    id: a.id, title: a.title, language: a.language, status: a.status, brandId: a.brandId, marketId: a.marketId, tags: a.tags,
    latestVersion: a.latestVersion, publishedVersion: a.publishedVersion,
    version: { version: v.version, title: v.title, body: v.body, createdAt: v.createdAt.toISOString() },
    versions: editor(user) ? a.versions.map((x) => ({ version: x.version, title: x.title, createdAt: x.createdAt.toISOString(), author: x.createdById ? authors.get(x.createdById) ?? null : null })) : [],
    canEdit: editor(user), canPublish: can(user.roles, "knowledge.publish"),
  };
}
export type ArticleDetail = Awaited<ReturnType<typeof getArticle>>;

const optId = z.string().trim().optional().transform((v) => v || undefined);
export const saveArticleSchema = z.object({
  id: optId,
  title: z.string().trim().min(3, "Nhập tiêu đề (tối thiểu 3 ký tự)").max(200, "Tối đa 200 ký tự"),
  body: z.string().trim().min(10, "Nội dung tối thiểu 10 ký tự").max(50000, "Tối đa 50.000 ký tự"),
  language: z.enum(KB_LANGUAGES, { message: "Chọn ngôn ngữ" }),
  brandId: optId,
  marketId: optId,
  tags: z.string().trim().max(300).optional().transform((v) => (v ? [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10) : [])),
});

/** Tạo bài (bản 1, nháp) hoặc thêm phiên bản mới. Bài đã xuất bản vẫn hiện bản cũ cho người đọc tới khi xuất bản bản mới. */
export async function saveArticle(user: SessionUser, input: unknown) {
  requirePerm(user, "knowledge.edit");
  const d = parse(saveArticleSchema, input);
  if (d.brandId && !(await db.brand.findFirst({ where: { id: d.brandId } }))) throw new ValidationError({ brandId: "Brand không thuộc team này" });
  if (d.marketId && !(await db.market.findFirst({ where: { id: d.marketId } }))) throw new ValidationError({ marketId: "Thị trường không thuộc team này" });
  return db.$transaction(async (tx) => {
    if (!d.id) {
      const a = await tx.knowledgeArticle.create({ data: { title: d.title, language: d.language, brandId: d.brandId, marketId: d.marketId, tags: d.tags, createdById: user.id } as Prisma.KnowledgeArticleUncheckedCreateInput });
      await tx.knowledgeVersion.create({ data: { articleId: a.id, version: 1, title: d.title, body: d.body, createdById: user.id } as never });
      await audit(tx, { actorId: user.id, entity: "KnowledgeArticle", entityId: a.id, action: "create", after: { title: d.title, version: 1 } });
      return { id: a.id, version: 1 };
    }
    const a = await tx.knowledgeArticle.findFirst({ where: { id: d.id } });
    if (!a) throw new HttpError(404, "Không tìm thấy bài tri thức");
    const version = a.latestVersion + 1;
    await tx.knowledgeVersion.create({ data: { articleId: a.id, version, title: d.title, body: d.body, createdById: user.id } as never });
    await tx.knowledgeArticle.update({
      where: { id: a.id },
      data: { latestVersion: version, language: d.language, brandId: d.brandId ?? null, marketId: d.marketId ?? null, tags: d.tags, ...(a.publishedVersion == null ? { title: d.title } : {}), ...(a.status === "ARCHIVED" ? { status: "DRAFT" } : {}) },
    });
    await audit(tx, { actorId: user.id, entity: "KnowledgeArticle", entityId: a.id, action: "version", after: { title: d.title, version } });
    return { id: a.id, version };
  });
}

/** Xuất bản một phiên bản (mặc định bản mới nhất) hoặc lưu trữ bài. */
export async function setArticleStatus(user: SessionUser, input: { id: string; status: KnowledgeStatus; version?: number }) {
  requirePerm(user, input.status === "PUBLISHED" ? "knowledge.publish" : "knowledge.edit");
  const a = await db.knowledgeArticle.findFirst({ where: { id: input.id } });
  if (!a) throw new HttpError(404, "Không tìm thấy bài tri thức");
  const version = input.status === "PUBLISHED" ? (input.version ?? a.latestVersion) : a.publishedVersion;
  const v = version ? await db.knowledgeVersion.findFirst({ where: { articleId: a.id, version } }) : null;
  if (input.status === "PUBLISHED" && !v) throw new ValidationError({ version: "Không có phiên bản này" });
  return db.$transaction(async (tx) => {
    const after = await tx.knowledgeArticle.update({
      where: { id: a.id },
      data: input.status === "PUBLISHED" ? { status: "PUBLISHED", publishedVersion: v!.version, title: v!.title } : { status: input.status },
    });
    await audit(tx, { actorId: user.id, entity: "KnowledgeArticle", entityId: a.id, action: input.status.toLowerCase(), before: { status: a.status, publishedVersion: a.publishedVersion }, after: { status: after.status, publishedVersion: after.publishedVersion } });
    return after;
  });
}

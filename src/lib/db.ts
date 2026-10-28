// Truy cập database. Nhiều workspace (= team), tách hoàn toàn (D-03, D-29) — mượn mẫu T-53 của Purchasing System.
// - `db`: client của ứng dụng. Mọi truy vấn bảng có cột workspaceId tự lọc/gán theo workspace của ngữ cảnh hiện tại;
//   THIẾU ngữ cảnh → ném lỗi (không bao giờ trả dữ liệu của mọi workspace).
//   Ngữ cảnh gắn bằng bindTenant(user) — gọi đồng bộ ở đầu dịch vụ (requirePerm) hoặc ngay sau pageUser ở trang.
// - `rootDb`: không lọc — chỉ cho seed/script/test/worker và bảng toàn hệ thống (User, Workspace, Membership).
// - `workspaceDb(id)`: client gắn cứng một workspace (test, script, worker theo từng workspace).
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const rootDb = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = rootDb;

type Ctx = { workspaceId: string };
const tenantAls = new AsyncLocalStorage<Ctx>();

/** Gắn workspace cho phần còn lại của luồng xử lý hiện tại (gọi ĐỒNG BỘ, trước lần await đầu tiên). */
export function bindTenant(user: { workspaceId: string }) {
  tenantAls.enterWith({ workspaceId: user.workspaceId });
}
/** await bên trong: PrismaPromise chỉ chạy khi được await, trả thẳng ra ngoài sẽ chạy sau khi đã rời ngữ cảnh. */
export const runInWorkspace = <T>(workspaceId: string, fn: () => Promise<T>) => tenantAls.run({ workspaceId }, async () => await fn());
export const currentWorkspaceId = () => tenantAls.getStore()?.workspaceId ?? null;

const MODELS = Prisma.dmmf.datamodel.models;
export const TENANT_MODELS = new Set(
  MODELS.filter((m) => m.name !== "Membership" && m.fields.some((f) => f.name === "workspaceId")).map((m) => m.name),
);
const RELATIONS = new Map(
  MODELS.map((m) => [m.name, new Map(m.fields.filter((f) => f.kind === "object").map((f) => [f.name, f.type]))]),
);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !Prisma.Decimal.isDecimal(v);

/** Gán workspaceId cho dữ liệu ghi, kể cả bản ghi tạo lồng (create / createMany / connectOrCreate / upsert). */
function stamp(model: string, data: unknown, workspaceId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => stamp(model, d, workspaceId));
  if (!isObj(data)) return data;
  const out: Obj = { ...data };
  if (TENANT_MODELS.has(model)) {
    if (out.workspaceId !== undefined && out.workspaceId !== workspaceId) throw new Error(`Ghi ${model} sang workspace khác bị chặn`);
    if (isObj(out.workspace)) throw new Error(`Ghi ${model} qua quan hệ workspace bị chặn`);
    out.workspaceId = workspaceId;
  }
  for (const [field, target] of RELATIONS.get(model) ?? []) {
    const w = out[field];
    if (!isObj(w)) continue;
    const n: Obj = { ...w };
    if (n.create !== undefined) n.create = stamp(target, n.create, workspaceId);
    if (isObj(n.createMany)) n.createMany = { ...n.createMany, data: stamp(target, (n.createMany as Obj).data, workspaceId) };
    if (n.connectOrCreate !== undefined) {
      const coc = (x: unknown) => (isObj(x) ? { ...x, create: stamp(target, x.create, workspaceId) } : x);
      n.connectOrCreate = Array.isArray(n.connectOrCreate) ? n.connectOrCreate.map(coc) : coc(n.connectOrCreate);
    }
    if (n.upsert !== undefined) {
      const up = (x: unknown) =>
        isObj(x) ? { ...x, create: stamp(target, x.create, workspaceId), update: stamp(target, x.update, workspaceId) } : x;
      n.upsert = Array.isArray(n.upsert) ? n.upsert.map(up) : up(n.upsert);
    }
    out[field] = n;
  }
  return out;
}

const WHERE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany", "upsert",
]);
const DATA_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn"]);

function scope(model: string, operation: string, args: Obj, workspaceId: string): Obj {
  const a: Obj = { ...args };
  if (WHERE_OPS.has(operation)) a.where = { ...(isObj(a.where) ? a.where : {}), workspaceId };
  if (DATA_OPS.has(operation)) a.data = stamp(model, a.data, workspaceId);
  if (operation === "upsert") {
    a.create = stamp(model, a.create, workspaceId);
    a.update = stamp(model, a.update, workspaceId);
  }
  return a;
}

function scoped(fixed?: string) {
  return rootDb.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const workspaceId = fixed ?? tenantAls.getStore()?.workspaceId;
          if (!workspaceId) throw new Error(`Thiếu ngữ cảnh workspace khi truy vấn ${model}.${operation}`);
          return query(scope(model, operation, (args ?? {}) as Obj, workspaceId) as typeof args);
        },
      },
    },
  });
}

export const db = scoped();
export type Db = typeof db;

const fixedClients = new Map<string, Db>();
/** Client gắn cứng một workspace, không phụ thuộc ngữ cảnh (test, script, worker). */
export function workspaceDb(workspaceId: string): Db {
  let c = fixedClients.get(workspaceId);
  if (!c) fixedClients.set(workspaceId, (c = scoped(workspaceId)));
  return c;
}

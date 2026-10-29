// Dữ liệu test: mỗi lần chạy dùng mã riêng (RUN) nên chạy lặp không đụng nhau, không cần xóa.
import { loadEnvFile } from "node:process";
import type { Role } from "@prisma/client";

try {
  loadEnvFile(".env");
} catch {}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function makeWorkspace(tag: string) {
  const { rootDb } = await import("@/lib/db");
  return rootDb.workspace.create({ data: { code: `T-${tag}-${RUN}`, name: `Test ${tag} ${RUN}` } });
}

export async function makeUser(tag: string, opts: { workspaceId?: string; roles?: Role[]; teamId?: string; isCompanyAdmin?: boolean; active?: boolean } = {}) {
  const { rootDb } = await import("@/lib/db");
  return rootDb.user.create({
    data: {
      email: `${tag}-${RUN}@test.invalid`,
      name: `User ${tag}`,
      isCompanyAdmin: opts.isCompanyAdmin ?? false,
      active: opts.active ?? true,
      memberships: opts.workspaceId ? { create: { workspaceId: opts.workspaceId, roles: opts.roles ?? [], teamId: opts.teamId } } : undefined,
    },
  });
}

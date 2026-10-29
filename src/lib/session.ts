// Phiên đăng nhập: cookie httpOnly chứa JWT HS256 ký bằng SESSION_SECRET (mẫu Purchasing System).
// Dùng chung cho đăng nhập thử và Google SSO sau này — chỉ khác bước cấp phiên.
import { SignJWT, jwtVerify } from "jose";
import { can, type Permission, type Role } from "./permissions";
import { bindTenant, rootDb } from "./db";
import { HttpError } from "./errors";

export const SESSION_COOKIE = "crm_session";
export const WORKSPACE_COOKIE = "crm_workspace";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự");
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`).sign(key());
}

/** userId nếu token hợp lệ, ngược lại null (sai chữ ký, hết hạn, rỗng). */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const secure = () => (process.env.NODE_ENV === "production" ? "; Secure" : "");
export const sessionCookie = (token: string) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure()}`;
export const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
/** Workspace đang chọn chỉ là lựa chọn; mỗi request vẫn kiểm người dùng có được vào (loadUser). */
export const workspaceCookie = (id: string) =>
  `${WORKSPACE_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure()}`;
export const clearWorkspaceCookie = `${WORKSPACE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export type SessionWorkspace = { id: string; code: string; name: string };
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  /** Vai trò trong workspace đang làm việc. */
  roles: Role[];
  /** Nhóm (Team) trong workspace đang làm việc — phạm vi lead/task của Sales và Trưởng nhóm (Phase 4). */
  teamId: string | null;
  workspaceId: string;
  workspace: SessionWorkspace;
  /** Workspace được vào (quản trị công ty: mọi workspace đang hoạt động). */
  workspaces: SessionWorkspace[];
  isCompanyAdmin: boolean;
};

/**
 * Nạp người dùng + chọn workspace: workspace yêu cầu (cookie) nếu được vào, không thì workspace gán sớm nhất.
 * Tài khoản khóa, hoặc không thuộc workspace nào đang hoạt động (và không phải quản trị công ty) → null.
 * Quản trị công ty vào mọi workspace; ở workspace không có membership thì mang vai trò Quản lý (D-29).
 */
export async function loadUser(userId: string | null, workspaceId?: string | null): Promise<SessionUser | null> {
  if (!userId) return null;
  const u = await rootDb.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { active: true, workspace: { active: true } },
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!u || !u.active) return null;
  const pick = (w: SessionWorkspace) => ({ id: w.id, code: w.code, name: w.name });
  const workspaces = u.isCompanyAdmin
    ? (await rootDb.workspace.findMany({ where: { active: true }, orderBy: { name: "asc" } })).map(pick)
    : u.memberships.map((m) => pick(m.workspace)).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  if (!workspaces.length) return null;
  const home = u.memberships[0]?.workspaceId;
  const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces.find((w) => w.id === home) ?? workspaces[0];
  const m = u.memberships.find((x) => x.workspaceId === workspace.id);
  const roles: Role[] = m ? m.roles : u.isCompanyAdmin ? ["MANAGER"] : [];
  return { id: u.id, name: u.name, email: u.email, roles, teamId: m?.teamId ?? null, workspaceId: workspace.id, workspace, workspaces, isCompanyAdmin: u.isCompanyAdmin };
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
}

/** Người dùng của request API; 401 nếu chưa đăng nhập. bindTenant ở đây chạy sau await nên KHÔNG truyền ra route —
 *  route phải gọi bindTenant(user) ngay sau `await requireUser(req)`, hoặc chỉ truy vấn qua dịch vụ có requirePerm. */
export async function requireUser(req: Request): Promise<SessionUser> {
  const header = req.headers.get("cookie");
  const user = await loadUser(await verifySession(readCookie(header, SESSION_COOKIE)), readCookie(header, WORKSPACE_COOKIE));
  if (!user) throw new HttpError(401, "Chưa đăng nhập");
  bindTenant(user);
  return user;
}

/** Kiểm quyền ở server VÀ gắn workspace của người dùng làm ngữ cảnh truy vấn cho phần còn lại của dịch vụ. */
export function requirePerm(user: SessionUser, perm: Permission): void {
  bindTenant(user);
  if (!can(user.roles, perm)) throw new HttpError(403, "Không có quyền");
}

export function requireCompanyAdmin(user: SessionUser): void {
  bindTenant(user);
  if (!user.isCompanyAdmin) throw new HttpError(403, "Chỉ quản trị công ty");
}

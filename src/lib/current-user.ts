// Người dùng hiện tại cho Server Component / Server Action (đọc cookie qua next/headers).
// LƯU Ý: ngữ cảnh workspace (AsyncLocalStorage) không truyền ngược qua await. Trang truy vấn `db` trực tiếp phải gọi
// bindTenant(user) NGAY SAU `await pageUser(...)`; dịch vụ có requirePerm tự gắn nên không cần.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can, type Permission } from "./permissions";
import { loadUser, SESSION_COOKIE, verifySession, WORKSPACE_COOKIE, type SessionUser } from "./session";

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return loadUser(await verifySession(jar.get(SESSION_COOKIE)?.value), jar.get(WORKSPACE_COOKIE)?.value);
}

/** Người dùng hiện tại; chưa đăng nhập → /dang-nhap. */
export async function currentUserOrRedirect(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/dang-nhap");
  return user;
}

/** Bảo vệ trang theo quyền ở server. Không có quyền → 404 (không lộ trang tồn tại). */
export async function pageUser(perm: Permission): Promise<SessionUser> {
  const user = await currentUserOrRedirect();
  if (!can(user.roles, perm)) notFound();
  return user;
}

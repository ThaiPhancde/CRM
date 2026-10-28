"use server";
// Đăng nhập thử (D-14): chỉ chạy khi DEMO_LOGIN=true — kiểm ở server, không chỉ ẩn nút.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { rootDb } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { SESSION_COOKIE, signSession, WORKSPACE_COOKIE, loadUser } from "@/lib/session";

const opts = (maxAge: number) => ({ path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge });

export async function demoLogin(formData: FormData) {
  if (process.env.DEMO_LOGIN !== "true") throw new Error("Đăng nhập thử đang tắt");
  const userId = String(formData.get("userId") ?? "");
  const u = await rootDb.user.findUnique({ where: { id: userId } });
  if (!u || !u.active || !(await loadUser(u.id))) redirect("/dang-nhap?loi=1");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(u.id), opts(60 * 60 * 12));
  jar.delete(WORKSPACE_COOKIE); // lựa chọn workspace thuộc phiên trước
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
  redirect("/dang-nhap");
}

export async function switchWorkspace(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/dang-nhap");
  const id = String(formData.get("workspaceId") ?? "");
  // Chỉ là lựa chọn; loadUser kiểm lại quyền vào workspace ở mỗi request.
  if (user.workspaces.some((w) => w.id === id)) (await cookies()).set(WORKSPACE_COOKIE, id, opts(60 * 60 * 24 * 365));
  redirect("/");
}

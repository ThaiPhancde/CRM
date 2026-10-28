// Bọc server action: lấy người dùng, gọi dịch vụ, chuyển lỗi thành ActionResult (lỗi validate theo trường, 403/409 thành câu dễ hiểu).
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/form";
import { currentUser } from "./current-user";
import { HttpError, toHttpError } from "./errors";
import type { SessionUser } from "./session";

/** Dữ liệu vừa gửi (bỏ trường nội bộ của React) để form hiện lại khi lỗi. */
export function sent(fd: FormData | null): Record<string, string | string[]> {
  const o: Record<string, string | string[]> = {};
  if (!fd) return o;
  for (const k of new Set(fd.keys())) {
    if (k.startsWith("$")) continue;
    const all = fd.getAll(k).map(String);
    o[k] = all.length > 1 ? all : all[0];
  }
  return o;
}

export async function runAction(
  fd: FormData | null,
  fn: (user: SessionUser) => Promise<string | void>,
  paths: string[],
  ok: string,
): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." };
  try {
    const msg = await fn(user);
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: msg || ok };
  } catch (e) {
    const values = sent(fd);
    const fields = (e as { fields?: Record<string, string> }).fields;
    if (fields) return { ok: false, message: (e as Error).message, fields, values };
    const err = e instanceof HttpError ? e : toHttpError(e);
    return { ok: false, message: err.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : err.message, values };
  }
}

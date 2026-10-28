"use server";
// Server action cho trang quản trị: chỉ chuyển FormData → service. Quyền, validate, audit nằm ở service.
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/current-user";
import { HttpError, toHttpError } from "@/lib/errors";
import { addMember, saveCatalog, updateMember, ValidationError, type CatalogKind } from "@/modules/admin/service";
import type { ActionResult } from "@/components/form";
import type { SessionUser } from "@/lib/session";

/** Dữ liệu vừa gửi (bỏ trường nội bộ của React) để form hiện lại khi lỗi. */
function sent(fd: FormData): Record<string, string | string[]> {
  const o: Record<string, string | string[]> = {};
  for (const k of new Set(fd.keys())) {
    if (k.startsWith("$")) continue;
    const all = fd.getAll(k).map(String);
    o[k] = all.length > 1 ? all : all[0];
  }
  return o;
}

function formObject(fd: FormData, arrays: string[] = []) {
  const o: Record<string, unknown> = sent(fd);
  for (const a of arrays) o[a] = fd.getAll(a).map(String);
  // Checkbox bỏ chọn thì trình duyệt không gửi: form sửa có _hasActive nên vắng `active` nghĩa là false.
  if (fd.has("_hasActive")) o.active = fd.has("active");
  delete o._hasActive;
  return o;
}

async function run(fd: FormData, fn: (user: SessionUser) => Promise<unknown>, path: string, ok: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." };
  try {
    await fn(user);
    revalidatePath(path);
    return { ok: true, message: ok };
  } catch (e) {
    const values = sent(fd);
    if (e instanceof ValidationError) return { ok: false, message: e.message, fields: e.fields, values };
    const err = e instanceof HttpError ? e : toHttpError(e);
    return { ok: false, message: err.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : err.message, values };
  }
}

export async function addMemberAction(_: ActionResult | null, fd: FormData) {
  return run(fd, (u) => addMember(u, formObject(fd, ["roles"])), "/quan-tri/nguoi-dung", "Đã thêm thành viên.");
}

export async function updateMemberAction(_: ActionResult | null, fd: FormData) {
  return run(fd, (u) => updateMember(u, formObject(fd, ["roles"])), "/quan-tri/nguoi-dung", "Đã lưu thay đổi.");
}

export async function saveCatalogAction(_: ActionResult | null, fd: FormData) {
  const kind = String(fd.get("kind")) as CatalogKind;
  return run(fd, (u) => {
    const o = formObject(fd, ["marketIds"]);
    delete o.kind;
    return saveCatalog(u, kind, o);
  }, "/quan-tri/danh-muc", "Đã lưu.");
}

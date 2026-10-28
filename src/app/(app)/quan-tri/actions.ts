"use server";
// Server action cho trang quản trị: chỉ chuyển FormData → service. Quyền, validate, audit nằm ở service.
import { runAction, sent } from "@/lib/action";
import { addMember, saveCatalog, updateMember, type CatalogKind } from "@/modules/admin/service";
import type { ActionResult } from "@/components/form";

function formObject(fd: FormData, arrays: string[] = []) {
  const o: Record<string, unknown> = sent(fd);
  for (const a of arrays) o[a] = fd.getAll(a).map(String);
  // Checkbox bỏ chọn thì trình duyệt không gửi: form sửa có _hasActive nên vắng `active` nghĩa là false.
  if (fd.has("_hasActive")) o.active = fd.has("active");
  delete o._hasActive;
  return o;
}

export async function addMemberAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await addMember(u, formObject(fd, ["roles"]))), ["/quan-tri/nguoi-dung"], "Đã thêm thành viên.");
}

export async function updateMemberAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await updateMember(u, formObject(fd, ["roles"]))), ["/quan-tri/nguoi-dung"], "Đã lưu thay đổi.");
}

export async function saveCatalogAction(_: ActionResult | null, fd: FormData) {
  const kind = String(fd.get("kind")) as CatalogKind;
  return runAction(fd, async (u) => {
    const o = formObject(fd, ["marketIds"]);
    delete o.kind;
    await saveCatalog(u, kind, o);
  }, ["/quan-tri/danh-muc"], "Đã lưu.");
}

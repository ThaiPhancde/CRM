"use server";
// Server action tri thức — FormData → service (quyền, phiên bản, audit ở service).
import { runAction, sent } from "@/lib/action";
import { saveArticle, setArticleStatus } from "@/modules/service/knowledge";
import type { ActionResult } from "@/components/form";

const PATHS = ["/tri-thuc"];

/** FormData: id (bỏ trống = bài mới), title, body (markdown), language, brandId, marketId, tags (phân cách dấu phẩy) */
export async function saveArticleAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await saveArticle(u, sent(fd));
    return r.version === 1 ? "Đã tạo bài (bản nháp 1)." : `Đã lưu phiên bản ${r.version}.`;
  }, PATHS, "Đã lưu.");
}
/** FormData: id, status (PUBLISHED | ARCHIVED | DRAFT), version (tùy chọn khi xuất bản) */
export async function setArticleStatusAction(_: ActionResult | null, fd: FormData) {
  const status = String(fd.get("status"));
  if (!["PUBLISHED", "ARCHIVED", "DRAFT"].includes(status)) return { ok: false, message: "Trạng thái không hợp lệ" };
  const version = Number(fd.get("version")) || undefined;
  return runAction(null, async (u) => void (await setArticleStatus(u, { id: String(fd.get("id")), status: status as "PUBLISHED", version })), PATHS, status === "PUBLISHED" ? "Đã xuất bản." : status === "ARCHIVED" ? "Đã lưu trữ bài." : "Đã chuyển về nháp.");
}

"use server";
// Server action nhiệm vụ + thông báo — FormData → service (quyền, phạm vi, idempotency ở service).
import type { TaskStatus } from "@prisma/client";
import { runAction, sent } from "@/lib/action";
import { markNotificationsRead } from "@/modules/sales/queue";
import { createTask, setTaskStatus } from "@/modules/sales/tasks";
import type { ActionResult } from "@/components/form";

const PATHS = ["/nhiem-vu", "/hang-doi", "/nhu-cau"];

/** FormData: type, title, note, dueAt (datetime-local), assigneeId, leadId, customerId, orderId, idempotencyKey */
export async function createTaskAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await createTask(u, sent(fd));
    return r.replayed ? "Việc này đã được tạo trước đó." : undefined;
  }, PATHS, "Đã tạo việc.");
}
/** FormData: id, status (OPEN | DONE | CANCELLED) */
export async function setTaskStatusAction(_: ActionResult | null, fd: FormData) {
  const status = String(fd.get("status")) as TaskStatus;
  if (!["OPEN", "DONE", "CANCELLED"].includes(status)) return { ok: false, message: "Trạng thái không hợp lệ" };
  return runAction(null, async (u) => void (await setTaskStatus(u, String(fd.get("id")), status)), PATHS, status === "DONE" ? "Đã hoàn thành việc." : status === "CANCELLED" ? "Đã hủy việc." : "Đã mở lại việc.");
}
/** FormData: id (bỏ trống = đánh dấu tất cả đã đọc) */
export async function markReadAction(_: ActionResult | null, fd: FormData) {
  const id = String(fd.get("id") ?? "") || undefined;
  return runAction(null, async (u) => void (await markNotificationsRead(u, id)), ["/hang-doi"], "Đã đánh dấu đã đọc.");
}

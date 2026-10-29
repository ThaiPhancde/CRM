"use server";
// Server action ticket — FormData → service (quyền, phạm vi, SLA, audit ở service).
import { runAction, sent } from "@/lib/action";
import { assignTicket, createTicket, replyTicket, setTicketPriority, setTicketStatus } from "@/modules/service/tickets";
import type { ActionResult } from "@/components/form";

const PATHS = ["/cham-soc", "/hang-doi", "/nhiem-vu"];

/** FormData: type, priority, subject, body, customerId, orderId, ownerId, idempotencyKey */
export async function createTicketAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await createTicket(u, sent(fd));
    return r.replayed ? "Ticket này đã được tạo trước đó." : undefined;
  }, PATHS, "Đã tạo ticket và giao người phụ trách.");
}
/** FormData: id, kind (REPLY | NOTE), body, idempotencyKey */
export async function replyTicketAction(_: ActionResult | null, fd: FormData) {
  const reply = fd.get("kind") === "REPLY";
  return runAction(fd, async (u) => void (await replyTicket(u, sent(fd))), PATHS, reply ? "Đã gửi trả lời (giả lập — chưa gửi ra ngoài)." : "Đã ghi chú nội bộ.");
}
/** FormData: id, status, note */
export async function setTicketStatusAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await setTicketStatus(u, sent(fd))), PATHS, "Đã cập nhật trạng thái.");
}
/** FormData: id, priority */
export async function setTicketPriorityAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await setTicketPriority(u, sent(fd))), PATHS, "Đã đổi mức ưu tiên và tính lại hạn.");
}
/** FormData: id, toUserId, reason */
export async function assignTicketAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await assignTicket(u, sent(fd))), PATHS, "Đã chuyển người phụ trách.");
}

"use server";
// Server action nhu cầu mua — chỉ chuyển FormData → service (quyền, phạm vi, validate, audit ở service). Giao diện gọi qua useActionState.
import { runAction, sent } from "@/lib/action";
import { bulkLeads, changeStage, claimLead, createLead, logActivity, reassignLead } from "@/modules/sales/leads";
import type { ActionResult } from "@/components/form";

const PATHS = ["/nhu-cau", "/hang-doi", "/nhiem-vu"];

/** FormData: contactName, phone, email, language, source, brandId, marketId, interest, budgetAmount, budgetCurrency, note, idempotencyKey */
export async function createLeadAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await createLead(u, sent(fd));
    if (r.merged) return "Khách đang có nhu cầu mở — đã ghi thêm vào lead cũ thay vì tạo lead mới.";
    return r.replayed ? "Lead này đã được tạo trước đó." : undefined;
  }, PATHS, "Đã tạo nhu cầu mua và giao người phụ trách.");
}
/** FormData: id, stage, lostReason, nextActionAt (datetime-local) */
export async function changeStageAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await changeStage(u, sent(fd))), PATHS, "Đã cập nhật giai đoạn.");
}
/** FormData: leadId, type, direction, channel, body, outcome, durationSec, occurredAt, idempotencyKey */
export async function logActivityAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await logActivity(u, sent(fd))), PATHS, "Đã ghi tương tác.");
}
/** FormData: id, toUserId, reason */
export async function reassignLeadAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await reassignLead(u, sent(fd))), PATHS, "Đã chuyển người phụ trách.");
}
/** FormData: id */
export async function claimLeadAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => void (await claimLead(u, String(fd.get("id")))), PATHS, "Bạn đã nhận lead này.");
}
/** FormData: ids[] (nhiều ô chọn), action (assign | stage), toUserId, reason, stage, lostReason */
export async function bulkLeadsAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await bulkLeads(u, { ...sent(fd), ids: fd.getAll("ids").map(String) });
    return `Đã xử lý ${r.done} lead${r.failed.length ? `, ${r.failed.length} lead bỏ qua (ngoài phạm vi hoặc không hợp lệ)` : ""}.`;
  }, PATHS, "Đã xử lý.");
}

"use server";
// Server action Customer 360 — chỉ chuyển FormData → service (quyền, validate, audit ở service). Giao diện gọi qua useActionState.
import { runAction, sent } from "@/lib/action";
import { mergeFromReview, recordPreference, rejectCustomerReview, unmergeCustomers } from "@/modules/customers/service";
import type { ActionResult } from "@/components/form";

const PATHS = ["/khach-hang", "/xac-minh", "/don-hang"];

/** FormData: id (CustomerReview) */
export async function mergeCustomerAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => void (await mergeFromReview(u, String(fd.get("id")))), PATHS, "Đã gộp hai hồ sơ. Có thể tách lại ở tab Lịch sử gộp.");
}
/** FormData: id (CustomerReview) */
export async function rejectCustomerReviewAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, (u) => rejectCustomerReview(u, String(fd.get("id"))), PATHS, "Đã đánh dấu là hai khách khác nhau.");
}
/** FormData: id (MergeLog) */
export async function unmergeCustomerAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => void (await unmergeCustomers(u, String(fd.get("id")))), PATHS, "Đã tách lại hồ sơ.");
}
/** FormData: customerId, channel, purpose, optIn ("true" | ""), source */
export async function recordPreferenceAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const v = sent(fd);
    await recordPreference(u, { ...v, optIn: v.optIn === "true" });
  }, PATHS, "Đã ghi lựa chọn liên hệ.");
}

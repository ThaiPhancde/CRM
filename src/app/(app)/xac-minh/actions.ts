"use server";
import { runAction } from "@/lib/action";
import { linkReview, rejectReview, unmerge } from "@/modules/orders/links";
import type { ActionResult } from "@/components/form";

const PATHS = ["/xac-minh", "/don-hang"];

export async function linkAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => void (await linkReview(u, String(fd.get("id")))), PATHS, "Đã gộp thành một đơn. Có thể tách lại ở mục Lần gộp gần đây.");
}
export async function rejectAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, (u) => rejectReview(u, String(fd.get("id"))), PATHS, "Đã đánh dấu không phải cùng một đơn.");
}
export async function unmergeAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => void (await unmerge(u, String(fd.get("id")))), PATHS, "Đã tách lại thành hai đơn.");
}

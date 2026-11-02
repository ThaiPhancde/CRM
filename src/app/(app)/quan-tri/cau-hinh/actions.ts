"use server";
// Server action cấu hình vận hành — FormData → service (quyền admin.settings, zod, audit ở service).
import { runAction, sent } from "@/lib/action";
import { saveCap, saveHours, saveLowStock, saveRouting, saveSla } from "@/modules/admin/config";
import type { ActionResult } from "@/components/form";

const PATHS = ["/quan-tri/cau-hinh"];
/** FormData: brandId ("" = mọi brand), priority, firstResponseHours, resolveHours */
export async function saveSlaAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveSla(u, sent(fd))), PATHS, "Đã lưu ngưỡng SLA (áp cho ticket tạo từ bây giờ).");
}
/** FormData: firstResponseHours, maxOpenPerUser, autoCloseDays, dedupeDays */
export async function saveRoutingAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveRouting(u, sent(fd))), PATHS, "Đã lưu thông số phân công lead.");
}
/** FormData: channel, maxCount, windowDays */
export async function saveCapAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveCap(u, sent(fd))), PATHS, "Đã lưu giới hạn liên hệ.");
}
/** FormData: market ("*" = mặc định), from, to (để trống cả hai = dùng mặc định) */
export async function saveHoursAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveHours(u, sent(fd))), PATHS, "Đã lưu giờ làm việc.");
}
/** FormData: market ("*" = mặc định), value (để trống = dùng mặc định) */
export async function saveLowStockAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveLowStock(u, sent(fd))), PATHS, "Đã lưu ngưỡng tồn thấp.");
}

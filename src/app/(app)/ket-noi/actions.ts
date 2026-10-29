"use server";
import { runAction, sent } from "@/lib/action";
import { num } from "@/lib/format";
import { createConnection, retryErrors, setConnectionStatus, syncNow } from "@/modules/connectors/service";
import type { ActionResult } from "@/components/form";

const PATHS = ["/ket-noi", "/don-hang", "/xac-minh", "/"];

export async function createConnectionAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await createConnection(u, sent(fd))), PATHS, "Đã tạo kết nối. Bấm “Nạp lịch sử” để lấy dữ liệu.");
}

export async function syncAction(_: ActionResult | null, fd: FormData) {
  const id = String(fd.get("id"));
  const mode = fd.get("mode") === "BACKFILL" ? "BACKFILL" : "INCREMENTAL";
  return runAction(null, async (u) => {
    const r = await syncNow(u, id, mode);
    const c = r.counts;
    return `Xong: ${num(c.APPLIED)} cập nhật, ${num(c.LINKED)} liên kết, ${num(c.STALE)} bản cũ bỏ qua, ${num(c.NOT_OWNER)} không phải nguồn chủ, ${num(c.DUPLICATE)} trùng bỏ qua, ${num(c.ERROR)} lỗi${r.reviews ? `, ${r.reviews} nghi trùng chờ xác minh` : ""}.`;
  }, PATHS, "Đã đồng bộ.");
}

export async function retryAction(_: ActionResult | null, fd: FormData) {
  const id = String(fd.get("id"));
  return runAction(null, async (u) => {
    const c = await retryErrors(u, id);
    return `Chạy lại xong: ${c.APPLIED + c.LINKED} thành công, ${c.ERROR} vẫn lỗi.`;
  }, PATHS, "Đã chạy lại.");
}

export async function toggleAction(_: ActionResult | null, fd: FormData) {
  const id = String(fd.get("id"));
  const status = fd.get("status") === "PAUSED" ? "PAUSED" : "ACTIVE";
  return runAction(null, (u) => setConnectionStatus(u, id, status), PATHS, status === "PAUSED" ? "Đã tạm dừng kết nối." : "Đã bật lại kết nối.");
}

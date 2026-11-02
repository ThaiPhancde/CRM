"use server";
// Server action phân khúc — dữ liệu → service (quyền, danh sách trường cho phép, audit ở service).
import { ValidationError } from "@/lib/errors";
import { runAction } from "@/lib/action";
import { previewSegment, runSegment, saveSegment } from "@/modules/marketing/segments";
import type { ActionResult } from "@/components/form";

const PATHS = ["/phan-khuc", "/hanh-trinh"];

/** FormData: id, name, description, rules (JSON cây điều kiện). */
export async function saveSegmentAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    let rules: unknown;
    try { rules = JSON.parse(String(fd.get("rules") ?? "")); } catch { throw new ValidationError({ rules: "Điều kiện không hợp lệ" }); }
    const s = await saveSegment(u, { id: fd.get("id"), name: fd.get("name"), description: fd.get("description"), rules });
    return `Đã lưu phân khúc "${s.name}".`;
  }, PATHS, "Đã lưu.");
}
/** FormData: id */
export async function runSegmentAction(_: ActionResult | null, fd: FormData) {
  return runAction(null, async (u) => {
    const r = await runSegment(u, String(fd.get("id")));
    return `Đã chạy: ${r.count.toLocaleString("vi-VN")} khách (${r.ms < 1000 ? `${r.ms} ms` : `${(r.ms / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giây`}).`;
  }, PATHS, "Đã chạy.");
}
/** Xem trước không ghi gì — trả số khách + mẫu. */
export async function previewSegmentAction(rulesJson: string) {
  const { currentUser } = await import("@/lib/current-user");
  const u = await currentUser();
  if (!u) return { ok: false as const, message: "Phiên đăng nhập đã hết" };
  try {
    return { ok: true as const, ...(await previewSegment(u, JSON.parse(rulesJson))) };
  } catch (e) {
    const fields = (e as { fields?: Record<string, string> }).fields;
    return { ok: false as const, message: fields?.rules ?? (e as Error).message };
  }
}

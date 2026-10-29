"use server";
// Server action cấu hình điểm (score.config) — FormData → service (quyền, kiểm tổng trọng số, audit ở service).
import { runAction } from "@/lib/action";
import { createScoreVersion, recomputeNow } from "@/modules/scoring/service";
import type { ActionResult } from "@/components/form";

const PATHS = ["/quan-tri/diem", "/khach-hang", "/nhu-cau"];

/** FormData: type, note, w.<thành phần> = số nguyên (vd w.fit=25, w.intent=35 …) — tổng phải 100. */
export async function createScoreVersionAction(_: ActionResult | null, fd: FormData) {
  const weights: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("w.")) weights[k.slice(2)] = String(v);
  return runAction(fd, async (u) => {
    const v = await createScoreVersion(u, { type: fd.get("type"), note: fd.get("note"), weights });
    return `Đã tạo phiên bản ${v.version}. Điểm cũ giữ nguyên; điểm theo phiên bản mới được tính ở lượt worker kế tiếp hoặc khi bấm "Tính lại ngay".`;
  }, PATHS, "Đã tạo phiên bản.");
}
/** Không cần trường nào. */
export async function recomputeAction(_: ActionResult | null, _fd: FormData) {
  return runAction(null, async (u) => {
    const r = await recomputeNow(u);
    return `Đã dựng chỉ số và chấm điểm ${r.scored} khách (${Math.round(r.ms / 100) / 10} giây).`;
  }, PATHS, "Đã tính lại.");
}

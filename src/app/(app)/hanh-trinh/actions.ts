"use server";
// Server action hành trình — dữ liệu → service (quyền soạn/bật, kiểm bước, audit ở service).
import type { JourneyStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { redirect } from "next/navigation";
import { runAction } from "@/lib/action";
import { saveJourney, setJourneyStatus } from "@/modules/marketing/journeys";
import type { ActionResult } from "@/components/form";

const PATHS = ["/hanh-trinh", "/chien-dich"];

/** FormData: payload (JSON: id, name, description, segmentId, brandId, steps, exitRules, reentryDays). */
export async function saveJourneyAction(_: ActionResult | null, fd: FormData) {
  let id: string | undefined;
  const r = await runAction(fd, async (u) => {
    let payload: unknown;
    try { payload = JSON.parse(String(fd.get("payload") ?? "")); } catch { throw new ValidationError({ steps: "Dữ liệu hành trình không hợp lệ" }); }
    const j = await saveJourney(u, payload);
    id = j.id;
    return `Đã lưu hành trình "${j.name}".`;
  }, PATHS, "Đã lưu.");
  if (r.ok && id) redirect(`/hanh-trinh/${id}`); // ngoài runAction: redirect ném lỗi đặc biệt, không để bị bắt
  return r;
}
/** FormData: id, status (ACTIVE | PAUSED | DRAFT) */
export async function setJourneyStatusAction(_: ActionResult | null, fd: FormData) {
  const status = String(fd.get("status")) as JourneyStatus;
  if (!["ACTIVE", "PAUSED", "DRAFT"].includes(status)) return { ok: false, message: "Trạng thái không hợp lệ" };
  return runAction(null, async (u) => void (await setJourneyStatus(u, String(fd.get("id")), status)), PATHS, status === "ACTIVE" ? "Đã bật hành trình — worker đưa khách vào ở lượt kế tiếp." : status === "PAUSED" ? "Đã tạm dừng hành trình." : "Đã chuyển về nháp.");
}

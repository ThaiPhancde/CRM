"use server";
// Server action chiến dịch + điểm chạm — FormData → service (quyền, quy VND, audit ở service).
import type { CampaignStatus } from "@prisma/client";
import { runAction, sent } from "@/lib/action";
import { addTouchpoint, saveCampaign, setCampaignStatus } from "@/modules/marketing/campaigns";
import type { ActionResult } from "@/components/form";

const PATHS = ["/chien-dich"];

/** FormData: id, name, brandId, segmentId, journeyId, channel, utmCampaign, startAt, endAt (date), cost, costCurrency */
export async function saveCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await saveCampaign(u, sent(fd))), PATHS, "Đã lưu chiến dịch.");
}
/** FormData: id, status (DRAFT | RUNNING | ENDED) */
export async function setCampaignStatusAction(_: ActionResult | null, fd: FormData) {
  const status = String(fd.get("status")) as CampaignStatus;
  if (!["DRAFT", "RUNNING", "ENDED"].includes(status)) return { ok: false, message: "Trạng thái không hợp lệ" };
  return runAction(null, async (u) => void (await setCampaignStatus(u, String(fd.get("id")), status)), PATHS, "Đã cập nhật trạng thái.");
}
/** FormData: campaignId, customerId, leadId, source, medium, utmContent, cost, costCurrency, occurredAt, idempotencyKey */
export async function addTouchpointAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => void (await addTouchpoint(u, sent(fd))), PATHS, "Đã ghi điểm chạm.");
}

"use server";
// Server action Trung tâm AI — gọi chức năng ở src/modules/ai (quyền, lọc dữ liệu, ghi lần chạy ở service). Lỗi trả thành câu dễ hiểu.
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { currentUser } from "@/lib/current-user";
import { HttpError, toHttpError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { decideApproval, setBudget } from "@/modules/ai/core";
import { assistant, draftReply, naturalSearch, summarize360, summarizeConversation } from "@/modules/ai/features";
import type { ActionResult } from "@/components/form";

export type AiResult<T = unknown> = { ok: true; status: string; output: T; evidence: { id: string; kind: string; label: string; href?: string }[]; runId: string } | { ok: false; message: string };

type Ev = { id: string; kind: string; label: string; href?: string };
async function call(fn: (u: SessionUser) => Promise<{ status: string; output: unknown; evidence?: Ev[]; runId: string }>): Promise<AiResult> {
  const u = await currentUser();
  if (!u) return { ok: false, message: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." };
  try {
    const r = await fn(u);
    revalidatePath("/ai");
    return { ok: true, status: r.status, output: r.output, evidence: r.evidence ?? [], runId: r.runId };
  } catch (e) {
    const err = e instanceof HttpError ? e : toHttpError(e);
    const fields = (e as { fields?: Record<string, string> }).fields;
    return { ok: false, message: err.status === 403 ? "Bạn không có quyền dùng chức năng AI này." : fields ? Object.values(fields).join("; ") : err.message };
  }
}

export async function summarizeAction(customerId: string) { return call((u) => summarize360(u, customerId)); }
export async function searchAction(q: string) { return call((u) => naturalSearch(u, q)); }
export async function conversationAction(input: { ticketId?: string; leadId?: string }) { return call((u) => summarizeConversation(u, input)); }
export async function draftAction(input: { ticketId?: string; leadId?: string; language?: string; orderId?: string }) { return call((u) => draftReply(u, input)); }
export async function assistantAction(input: { text: string; customerId?: string }) { return call((u) => assistant(u, input)); }

/** FormData: id, approve ("1" | "0"), note */
export async function decideApprovalAction(_: ActionResult | null, fd: FormData) {
  const approve = fd.get("approve") === "1";
  return runAction(fd, async (u) => void (await decideApproval(u, { id: String(fd.get("id")), approve, note: String(fd.get("note") ?? "") || undefined })), ["/ai"], approve ? "Đã duyệt và thực hiện." : "Đã từ chối.");
}
/** FormData: monthlyUsd (trống = không giới hạn) */
export async function setBudgetAction(_: ActionResult | null, fd: FormData) {
  const v = String(fd.get("monthlyUsd") ?? "").trim();
  return runAction(fd, async (u) => void (await setBudget(u, { monthlyUsd: v === "" ? null : v })), ["/ai"], "Đã lưu ngân sách AI.");
}

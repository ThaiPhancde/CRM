"use server";
// Server action vận đơn — FormData → service (quyền, idempotency, audit ở service).
import { revalidatePath } from "next/cache";
import { runAction, sent } from "@/lib/action";
import { currentUser } from "@/lib/current-user";
import { HttpError, toHttpError } from "@/lib/errors";
import { applySettlement, previewSettlement, type SettlementLineResult } from "@/modules/fulfillment/cod";
import { actOnDelivery } from "@/modules/fulfillment/service";
import type { ActionResult } from "@/components/form";

const MSG = { REATTEMPT: "Đã ghi yêu cầu giao lại (gửi hãng ở chế độ giả lập).", CANCEL: "Đã ghi yêu cầu hủy (CRM không ghi ngược POS).", TICKET: "Đã chuyển ticket cho người phụ trách." } as Record<string, string>;

/** FormData: orderId, kind (REATTEMPT | CANCEL | TICKET), note, priority, idempotencyKey */
export async function deliveryAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await actOnDelivery(u, sent(fd));
    return r.replayed ? "Thao tác này đã được ghi trước đó." : MSG[String(fd.get("kind"))];
  }, ["/van-don"], "Đã xử lý.");
}

export type SettlementState = { ok: boolean; message?: string; applied?: boolean; inserted?: number; lines?: SettlementLineResult[]; fields?: Record<string, string> } | null;

/** FormData: carrier, reference, text, intent (preview | apply). Trả từng dòng để form hiện kết quả. */
export async function settlementAction(_: SettlementState, fd: FormData): Promise<SettlementState> {
  const u = await currentUser();
  if (!u) return { ok: false, message: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." };
  const input = { carrier: String(fd.get("carrier") ?? ""), reference: String(fd.get("reference") ?? ""), text: String(fd.get("text") ?? "") };
  try {
    if (fd.get("intent") === "apply") {
      const r = await applySettlement(u, input);
      revalidatePath("/van-don");
      return { ok: true, applied: true, inserted: r.inserted, lines: r.lines, message: r.inserted ? `Đã ghi ${r.inserted} vận đơn về tiền vào bảng ${input.reference}.` : "Không có dòng mới để ghi." };
    }
    const lines = await previewSettlement(u, input);
    const ready = lines.filter((l) => l.status === "ready").length;
    return { ok: true, lines, message: `${ready}/${lines.length} dòng sẵn sàng ghi.` };
  } catch (e) {
    const fields = (e as { fields?: Record<string, string> }).fields;
    if (fields) return { ok: false, message: (e as Error).message, fields };
    const err = e instanceof HttpError ? e : toHttpError(e);
    return { ok: false, message: err.status === 403 ? "Bạn không có quyền nhập đối soát COD." : err.message };
  }
}

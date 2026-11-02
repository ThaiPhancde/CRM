"use server";
// Server action sản phẩm — FormData → service (quyền, audit ở service).
import { runAction, sent } from "@/lib/action";
import { mapSourceSku, syncCosts } from "@/modules/products/service";
import type { ActionResult } from "@/components/form";

const PATHS = ["/san-pham"];

/** FormData: sourceSku, variantId */
export async function mapSkuAction(_: ActionResult | null, fd: FormData) {
  return runAction(fd, async (u) => {
    const r = await mapSourceSku(u, sent(fd));
    return r.lines ? `Đã gắn ${r.lines} dòng đơn vào biến thể.` : "Mã này đã khớp từ trước — không có dòng đơn nào cần gắn.";
  }, PATHS, "Đã ánh xạ.");
}
export async function syncCostsAction() {
  return runAction(null, async (u) => {
    const r = await syncCosts(u);
    return r.updated ? `Đã cập nhật giá vốn ${r.updated} biến thể theo Mua hàng.` : "Giá vốn đã khớp với Mua hàng — không có gì thay đổi.";
  }, PATHS, "Đã lấy giá vốn.");
}

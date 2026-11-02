// Tải toàn bộ dữ liệu của một khách (JSON) — trả lời yêu cầu truy cập dữ liệu (GDPR/PDPA). Quyền customer.privacy, có audit (service).
import { currentUser } from "@/lib/current-user";
import { toResponse } from "@/lib/errors";
import { exportCustomerData } from "@/modules/admin/privacy";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  try {
    const { id } = await params;
    const data = await exportCustomerData(user, id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="khach-${id}-${data.exportedAt.slice(0, 10)}.json"`, "cache-control": "no-store" },
    });
  } catch (e) {
    return toResponse(e);
  }
}

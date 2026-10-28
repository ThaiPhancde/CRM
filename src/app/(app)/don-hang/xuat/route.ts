import { requireUser } from "@/lib/session";
import { toResponse } from "@/lib/errors";
import { exportOrdersCsv, parseFilter } from "@/modules/orders/service";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const f = parseFilter(Object.fromEntries(new URL(req.url).searchParams));
    const csv = await exportOrdersCsv(user, f);
    const name = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` } });
  } catch (e) {
    return toResponse(e);
  }
}

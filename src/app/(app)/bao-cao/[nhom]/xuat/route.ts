// Xuất Excel đúng các bảng của trang báo cáo đang xem (cùng hàm service, cùng bộ lọc) + dòng thông tin kỳ/phạm vi/tiền tệ/tỷ giá/độ mới.
import ExcelJS from "exceljs";
import { HttpError, toResponse } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { runInWorkspace } from "@/lib/db";
import { parseReportFilter, todayVN } from "@/modules/reports/period";
import { REPORT_GROUP_KEYS, reportContext, reportSheets, visibleGroups, type ReportGroupKey } from "@/modules/reports/service";

export async function GET(req: Request, { params }: { params: Promise<{ nhom: string }> }) {
  try {
    const user = await requireUser(req);
    const { nhom } = await params;
    if (!(REPORT_GROUP_KEYS as readonly string[]).includes(nhom) || !visibleGroups(user).includes(nhom as ReportGroupKey)) throw new HttpError(404, "Không có báo cáo này");
    const g = nhom as ReportGroupKey;
    const f = parseReportFilter(Object.fromEntries(new URL(req.url).searchParams), todayVN(), g === "tai-chinh" ? "market" : "none");
    const buf = await runInWorkspace(user.workspaceId, async () => {
      const [ctx, { title, sheets }] = await Promise.all([reportContext(user, g, f), reportSheets(user, g, f)]);
      const wb = new ExcelJS.Workbook();
      wb.creator = "CRM LevelUp";
      for (const s of sheets) {
        const ws = wb.addWorksheet(s.name.slice(0, 31));
        ws.addRow([`${title} — ${s.name}`]).font = { bold: true, size: 13 };
        ws.addRow([`Kỳ ${f.from} → ${f.to} (ngày UTC, mỗi chỉ số theo mốc của nó) · Tiền tệ ${ctx.currency}${ctx.rate ? ` · 1 ${ctx.rate.currency} = ${ctx.rate.rateToBase} VND (hiệu lực ${ctx.rate.validFrom})` : " (tỷ giá chốt của từng đơn, D-44)"}`]);
        ws.addRow([`Phạm vi: ${ctx.scope === "self" ? "của tôi" : "team " + user.workspace.name}${ctx.showMoney ? "" : " · số tiền ẩn (thiếu quyền xem tiền)"} · Chỉ số R12M tính lúc ${ctx.freshness ?? "chưa dựng"} · Xuất ${new Date().toISOString()}`]);
        ws.addRow([]);
        const head = ws.addRow(s.columns.map((c) => c.header));
        head.font = { bold: true };
        head.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F4" } }; });
        for (const r of s.rows) ws.addRow(s.columns.map((c) => (r[c.key] == null ? null : typeof r[c.key] === "number" ? (r[c.key] as number) : String(r[c.key]))));
        s.columns.forEach((c, i) => {
          const col = ws.getColumn(i + 1);
          col.width = Math.max(12, Math.min(40, c.header.length + 4));
          if (c.money) col.numFmt = ctx.currency === "VND" ? "#,##0" : "#,##0.00";
          if (c.pct) col.numFmt = '0.0"%"';
        });
      }
      return wb.xlsx.writeBuffer();
    });
    return new Response(buf as ArrayBuffer, {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="bao-cao-${g}-${f.from}-${f.to}.xlsx"` },
    });
  } catch (e) {
    return toResponse(e);
  }
}

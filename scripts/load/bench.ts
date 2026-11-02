// Đo tải các thao tác nóng trên DB crm_load (D-48). Gọi đúng service mà trang web gọi, với vai Quản lý / Trưởng nhóm / Sales.
// Chạy: DATABASE_URL=<…/crm_load> SCALE=1 npx tsx scripts/load/bench.ts [nhãn]   → in bảng + ghi docs/perf/<nhãn>.json
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "";
if (!/\/[a-z0-9_]+_load(\?|$)/i.test(url)) throw new Error("Chỉ chạy trên DB *_load");
const S = Number(process.env.SCALE ?? 1);
const label = process.argv[2] ?? "run";
/**
 * Mục tiêu NFR (D-48): trang người dùng p50 < 500 ms, chi tiết < 300 ms, job worker một lượt < 5 s, xuất CSV < 5 s.
 * Job hằng ngày (chỉ số + điểm toàn bộ khách của team): < 2 phút. Báo cáo / dashboard (Phase 9): < 3 s.
 * Nhập đơn: ≥ 30 bản ghi/giây (1.000 bản ≤ 33 s) — tính từ khối lượng mục tiêu ~8.200 bản ghi/ngày/team, dư > 100 lần.
 */
const TARGET: Record<string, number> = { page: 500, detail: 300, job: 5000, export: 5000, write: 300, ingest: 33000, daily: 120000, report: 3000 };

async function main() {
  const { rootDb, runInWorkspace, workspaceDb } = await import("../../src/lib/db");
  const { loadUser } = await import("../../src/lib/session");
  const orders = await import("../../src/modules/orders/service");
  const customers = await import("../../src/modules/customers/service");
  const leads = await import("../../src/modules/sales/leads");
  const tasks = await import("../../src/modules/sales/tasks");
  const queue = await import("../../src/modules/sales/queue");
  const { refreshCustomerStats } = await import("../../src/modules/customers/resolve");

  const ws = await rootDb.workspace.findUniqueOrThrow({ where: { code: `LOAD-${S}` } });
  const u = async (email: string) => (await loadUser((await rootDb.user.findUniqueOrThrow({ where: { email } })).id, ws.id))!;
  const mgr = await u(`load-mgr-${S}@load.invalid`);
  const lead = await u(`load-lead-${S}@load.invalid`);
  const sales = await u(`load-s3-${S}@load.invalid`);
  const c = workspaceDb(ws.id);
  const anOrder = (await c.order.findFirstOrThrow({ orderBy: { bookedAt: "desc" }, select: { id: true } })).id;
  const aCustomer = (await c.customer.findFirstOrThrow({ where: { leads: { some: {} } }, select: { id: true } })).id;
  const aLead = (await c.lead.findFirstOrThrow({ where: { stage: "DANG_TU_VAN" }, orderBy: { createdAt: "desc" }, select: { id: true } })).id;
  const counts = { orders: await c.order.count(), customers: await c.customer.count(), leads: await c.lead.count(), activities: await c.activity.count() };
  console.log("dữ liệu:", counts);

  const rows: { name: string; kind: string; p50: number; max: number; ok: boolean }[] = [];
  async function time(name: string, kind: keyof typeof TARGET, fn: () => Promise<unknown>, runs = 3) {
    const ms: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      await runInWorkspace(ws.id, fn);
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    const p50 = ms[Math.floor(ms.length / 2)];
    rows.push({ name, kind, p50: Math.round(p50), max: Math.round(ms.at(-1)!), ok: p50 <= TARGET[kind] });
    console.log(`${p50 <= TARGET[kind] ? "OK  " : "CHẬM"} ${String(Math.round(p50)).padStart(6)} ms  ${name}`);
  }
  const of = orders.orderFilter.parse({});

  await time("Đơn: danh sách trang 1 (Quản lý)", "page", () => orders.listOrders(mgr, { ...of, page: 1 }));
  await time("Đơn: trang 500 (offset sâu)", "page", () => orders.listOrders(mgr, { ...of, page: 500 }));
  await time("Đơn: lọc trạng thái giao + thị trường", "page", () => orders.listOrders(mgr, { ...of, page: 1, fulfillment: "FAILED" }));
  await time("Đơn: tìm theo mã/tên", "page", () => orders.listOrders(mgr, { ...of, page: 1, q: "L12345" }));
  await time("Đơn: danh sách (Sales, theo phạm vi)", "page", () => orders.listOrders(sales, { ...of, page: 1 }));
  await time("Đơn: chi tiết", "detail", () => orders.getOrder(mgr, anOrder));
  await time("Đơn: xuất CSV 10.000 dòng", "export", () => orders.exportOrdersCsv(mgr, { ...of, page: 1 }), 1);
  await time("Khách: danh sách mặc định", "page", () => customers.listCustomers(mgr, customers.parseCustomerFilter({})));
  await time("Khách: sắp theo giá trị", "page", () => customers.listCustomers(mgr, customers.parseCustomerFilter({ sort: "value" })));
  await time("Khách: tìm theo SĐT", "page", () => customers.listCustomers(mgr, customers.parseCustomerFilter({ q: "9715100123" })));
  await time("Khách: danh sách (Sales, theo phạm vi)", "page", () => customers.listCustomers(sales, customers.parseCustomerFilter({})));
  await time("Khách: hồ sơ 360", "detail", () => customers.getCustomer360(mgr, aCustomer));
  await time("Lead: danh sách (Quản lý)", "page", () => leads.listLeads(mgr, leads.parseLeadFilter({})));
  await time("Lead: danh sách quá hạn", "page", () => leads.listLeads(mgr, leads.parseLeadFilter({ overdue: "1" })));
  await time("Lead: Kanban (Quản lý)", "page", () => leads.leadBoard(mgr, leads.parseLeadFilter({})));
  await time("Lead: Kanban (Trưởng nhóm)", "page", () => leads.leadBoard(lead, leads.parseLeadFilter({})));
  await time("Lead: danh sách (Sales)", "page", () => leads.listLeads(sales, leads.parseLeadFilter({})));
  await time("Lead: chi tiết", "detail", () => leads.getLead(mgr, aLead));
  await time("Hàng đợi của tôi (Sales)", "page", () => queue.myQueue(sales));
  await time("Hàng đợi của tôi (Trưởng nhóm)", "page", () => queue.myQueue(lead));
  await time("Thông báo (Sales)", "detail", () => queue.listNotifications(sales));
  await time("Việc: danh sách (Trưởng nhóm)", "page", () => tasks.listTasks(lead, tasks.parseTaskFilter({})));
  const tickets = await import("../../src/modules/service/tickets");
  const kb = await import("../../src/modules/service/knowledge");
  const aTicket = (await c.ticket.findFirst({ where: { status: "DANG_XU_LY" }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id;
  await time("Ticket: danh sách (Quản lý)", "page", () => tickets.listTickets(mgr, tickets.parseTicketFilter({})));
  await time("Ticket: đang mở + quá hạn", "page", () => tickets.listTickets(mgr, tickets.parseTicketFilter({ status: "open", overdue: "1" })));
  await time("Ticket: tìm theo tiêu đề", "page", () => tickets.listTickets(mgr, tickets.parseTicketFilter({ q: "tải 4321" })));
  await time("Ticket: danh sách (Sales)", "page", () => tickets.listTickets(sales, tickets.parseTicketFilter({})));
  if (aTicket) await time("Ticket: chi tiết", "detail", () => tickets.getTicket(mgr, aTicket));
  await time("Tri thức: danh sách", "page", () => kb.listArticles(sales, kb.parseKbFilter({})));
  await time("Worker: nhắc SLA ticket (1 lượt)", "job", () => tickets.remindTicketSla(c), 1);
  const scoring = await import("../../src/modules/scoring/engine");
  const scoreSvc = await import("../../src/modules/scoring/service");
  await time("Job hằng ngày: chỉ số R12M + điểm 3 loại toàn bộ khách", "daily", () => scoring.refreshAndScoreCustomers(c, ws.id), 1);
  await time("Worker: chấm điểm lead mở (lượt đầu)", "job", () => scoring.scoreOpenLeads(c), 1);
  await time("Worker: chấm điểm lead mở (lượt kế, không có gì mới)", "job", () => scoring.scoreOpenLeads(c), 1);
  await time("Điểm + chỉ số của một khách (hồ sơ 360)", "detail", () => scoreSvc.getCustomerScores(mgr, aCustomer));
  await time("Khách: danh sách kèm hạng RFM", "page", () => customers.listCustomers(mgr, customers.parseCustomerFilter({})));
  await time("Lead: danh sách kèm điểm ưu tiên", "page", () => leads.listLeads(mgr, leads.parseLeadFilter({})));
  // Phase 7: phân khúc → hành trình → chiến dịch. Mốc 08:00 UTC (12:00 Dubai) để bước gửi tin nằm trong khung 9–20 giờ.
  const segs = await import("../../src/modules/marketing/segments");
  const jrs = await import("../../src/modules/marketing/journeys");
  const camps = await import("../../src/modules/marketing/campaigns");
  const T7 = new Date(); T7.setUTCHours(8, 0, 0, 0);
  const rules = { op: "and", rules: [{ field: "rfm", cmp: "in", value: ["CHAMPIONS", "TRUNG_THANH", "CAN_CHAM_SOC", "MOI"] }, { field: "daysToNextPurchase", cmp: "lte", value: 30 }] };
  await time("Phân khúc: xem trước (đếm + 20 mẫu)", "page", () => segs.previewSegment(mgr, rules, T7));
  const seg = await runInWorkspace(ws.id, () => segs.saveSegment(mgr, { name: `Bench ${Date.now()}`, rules }));
  await time("Phân khúc: chạy + lưu ảnh chụp", "job", () => segs.runSegmentFor(c, seg.id, mgr.id, T7), 1);
  const jr = await runInWorkspace(ws.id, () => jrs.saveJourney(mgr, { name: `Bench ${Date.now()}`, segmentId: seg.id, steps: [{ type: "SEND", channel: "EMAIL", template: "repurchase_reminder" }, { type: "WAIT", days: 3 }, { type: "TASK", title: "Gọi khách", dueDays: 1 }], exitRules: { purchased: true, optOut: true, openTicket: true, expireDays: 30 } }));
  await runInWorkspace(ws.id, () => jrs.setJourneyStatus(mgr, jr.id, "ACTIVE", T7));
  await time("Worker: đưa khách vào hành trình (≤ 5.000)", "job", () => jrs.enrollJourney(c, jr.id, T7), 1);
  await time("Worker: đưa khách vào hành trình (lượt kế, đã vào hết)", "job", () => jrs.enrollJourney(c, jr.id, T7), 1);
  await time("Worker: chạy bước tới hạn (500 khách)", "job", () => jrs.processDueRuns(c, T7), 1);
  await time("Hành trình: chi tiết + thống kê bước", "detail", () => jrs.getJourney(mgr, jr.id));
  await time("Hành trình: danh sách khách trang 1", "page", () => jrs.listJourneyRuns(mgr, jr.id, {}));
  await time("Chiến dịch: danh sách + MKT-01/02", "page", () => camps.listCampaigns(mgr));
  // Phase 8: AI (replay) — chi phí chính là gom ngữ cảnh qua service + ghi AgentRun/ToolCall/AiCost.
  const ai = await import("../../src/modules/ai/features");
  const aiHist = await import("../../src/modules/ai/history");
  await time("AI: tóm tắt 360 một khách", "detail", () => ai.summarize360(mgr, aCustomer));
  await time("AI: tìm tự nhiên → bộ lọc", "page", () => ai.naturalSearch(mgr, "đơn giao thất bại ở UAE tháng này"));
  await time("AI: hỏi báo cáo REV-03 theo thị trường (R12M, 200k khách)", "page", () => ai.assistant(mgr, { text: "Doanh thu giao thành công theo thị trường" }));
  await time("AI: lịch sử lần chạy trang 1", "page", () => aiHist.listRuns(mgr, {}));
  await time("AI: chi phí tháng (AI-01..03)", "page", () => aiHist.aiStats(mgr));
  // Phase 9: báo cáo qua Warehouse (SQL tổng hợp, chỉ đọc) — kỳ 12 tháng là trường hợp nặng nhất.
  const rp = await import("../../src/modules/reports/service");
  const per = await import("../../src/modules/reports/period");
  const dash = await import("../../src/modules/reports/dashboard");
  const today = per.todayVN();
  const f12 = per.parseReportFilter({ from: per.addDays(today, -364), to: today, group: "market" }, today);
  const fM = per.parseReportFilter({}, today, "brand_market");
  const ctxFin = await runInWorkspace(ws.id, () => rp.reportContext(mgr, "tai-chinh", f12));
  await time("Báo cáo tài chính 12 tháng theo thị trường + nguyên tệ", "report", () => rp.financeReport(mgr, f12, ctxFin));
  await time("Báo cáo tài chính 12 tháng theo tháng", "report", () => rp.financeReport(mgr, { ...f12, group: "month" }, ctxFin));
  await time("Báo cáo bán hàng 12 tháng (phễu + theo người)", "report", () => rp.salesReport(mgr, f12));
  await time("Báo cáo bán hàng (Sales, của mình)", "report", () => rp.salesReport(sales, f12));
  await time("Báo cáo khách hàng: RFM + cohort 12 tháng", "report", () => rp.customerReport(mgr, f12, ctxFin));
  await time("Báo cáo marketing 12 tháng", "report", () => rp.marketingReport(mgr, f12, ctxFin));
  await time("Báo cáo vận đơn 12 tháng", "report", () => rp.fulfillmentReport(mgr, f12, ctxFin));
  await time("Báo cáo AI tháng này", "report", () => rp.aiReport(mgr, fM));
  await time("Dashboard Quản lý (30 ngày)", "report", () => dash.dashboardFor(mgr));
  await time("Dashboard Sales (30 ngày)", "report", () => dash.dashboardFor(sales));
  await time("Đơn: lọc theo ngày giao + REV-03 (30 ngày)", "page", () => orders.listOrders(mgr, { ...of, page: 1, anchor: "delivered", from: per.addDays(today, -29), to: today }));
  // Phase 10: vận đơn, COD, sản phẩm. Danh sách can thiệp và COD kẹt là SQL theo chỉ mục (Shipment status/failedAt, collectedAt).
  const ful = await import("../../src/modules/fulfillment/service");
  const cod = await import("../../src/modules/fulfillment/cod");
  const prd = await import("../../src/modules/products/service");
  const itv = await runInWorkspace(ws.id, () => ful.listInterventions(mgr, ful.interventionFilter.parse({})));
  console.log("vận đơn cần can thiệp:", itv.total);
  await time("Vận đơn: cần can thiệp trang 1 (+ đếm theo lý do)", "page", () => ful.listInterventions(mgr, ful.interventionFilter.parse({})));
  await time("Vận đơn: cần can thiệp lọc lỗi hãng + tìm mã", "page", () => ful.listInterventions(mgr, ful.interventionFilter.parse({ fault: "carrier", q: "L12345" })));
  let ai2 = 0;
  await time("Vận đơn: xử lý một đơn (giao lại → Outbox)", "write", () => ful.actOnDelivery(mgr, { orderId: itv.rows[ai2++].orderId, kind: "REATTEMPT", idempotencyKey: `bench-${Date.now()}-${ai2}` }));
  const f30 = per.parseReportFilter({ from: per.addDays(today, -29), to: today }, today, "none");
  await time("COD: CASH-01/02/03 theo hãng 30 ngày", "report", () => cod.codSummary(mgr, f30, null));
  await time("COD: CASH-01/02/03 theo hãng 12 tháng", "report", () => cod.codSummary(mgr, f12, null));
  await time("COD: đã thu chưa về trang 1", "page", () => cod.outstandingCod(mgr, { page: 1 }));
  const stuck = (await runInWorkspace(ws.id, () => cod.outstandingCod(mgr, { page: 1 }))).rows;
  const pasteRows = (await c.shipment.findMany({ where: { collectedAt: { not: null }, carrier: "Aramex" }, select: { trackingNo: true, codAmount: true }, take: 500 }))
    .map((s) => `${s.trackingNo}\t${s.codAmount}\t28/10/2026`);
  await time("Đối soát: xem trước 500 dòng dán", "job", () => cod.previewSettlement(mgr, { carrier: "Aramex", reference: "BENCH", text: ["ma_van_don\tso_tien\tngay_ve", ...pasteRows].join("\n") }));
  await time("COD: bốn mốc một đơn (trang đơn)", "detail", () => cod.orderCodSteps(mgr, [stuck[0]?.orderId ?? anOrder]));
  await time("Sản phẩm: danh sách + tồn theo thị trường", "page", () => prd.listProducts(mgr, prd.productFilter.parse({})));
  await time("Sản phẩm: mã nguồn chưa khớp", "page", () => prd.unmatchedSkus(mgr));
  let k = 0;
  await time("Tạo lead + phân công tự động", "write", () => leads.createLead(mgr, { contactName: `Bench ${Date.now()}-${k++}`, phone: `+97155${String(1000000 + Math.floor(Math.random() * 8999999))}`, source: "inbox" }), 5);
  await time("Worker: giao lead treo + nhắc hạn + tự đóng (1 lượt)", "job", async () => { await queue.assignPendingLeads(c); await queue.remindDue(c); await queue.closeStaleLeads(c); }, 1);
  await time("Worker: lượt kế tiếp (không còn việc tồn)", "job", async () => { await queue.assignPendingLeads(c); await queue.remindDue(c); await queue.closeStaleLeads(c); }, 1);
  const some = (await c.customer.findMany({ take: 100, select: { id: true } })).map((x) => x.id);
  await time("Worker: tính lại giá trị 100 khách", "job", async () => { for (const id of some) await refreshCustomerStats(c, id); }, 1);

  // Nhập đơn từ nguồn trên nền dữ liệu lớn: 1.000 bản ghi Pancake (một nửa SĐT trùng khách có sẵn → đi nhánh gắn khách/nghi trùng).
  const { runSync } = await import("../../src/modules/connectors/service");
  const conn = await c.connection.findFirstOrThrow({ select: { id: true } });
  const dir = `${process.env.TEMP ?? "/tmp"}/crm-load-replay`;
  mkdirSync(dir, { recursive: true });
  process.env.REPLAY_DIR = dir;
  const base = Date.now();
  const recs = Array.from({ length: 1000 }, (_, i) => {
    const at = new Date(base - (1000 - i) * 1000).toISOString();
    return { visibleAt: at, record: {
      id: `bench-${base}-${i}`, order_code: `B${base}${i}`, status: 1, inserted_at: at, updated_at: at, confirmed_at: at, currency: "AED", is_cod: true,
      customer: { id: `bc-${i}`, name: `Khách nhập ${i}`, phone_number: i % 2 ? `+9715${String(10_000_000 + i * 13).slice(-8)}` : `+97156${String(1_000_000 + i).slice(-7)}`, email: null },
      shipping_address: { country_code: "AE" }, items: [{ sku: "SKU-1", name: "Hàng 1", quantity: 1, price: "120.00" }],
      total_discount: "0", shipping_fee: "0", payments: [], refunds: [], partner: null, note: null,
    } };
  });
  writeFileSync(`${dir}/LOAD-PK.json`, JSON.stringify(recs));
  await time("Nhập đơn: đồng bộ 1.000 bản ghi Pancake", "ingest", () => runSync(ws.id, conn.id, "INCREMENTAL", new Date(base + 60_000)), 1);
  await time("Nhập đơn: đồng bộ lại (1.000 bản trùng)", "ingest", () => runSync(ws.id, conn.id, "BACKFILL", new Date(base + 60_000)), 1);

  mkdirSync("docs/perf", { recursive: true });
  writeFileSync(`docs/perf/${label}.json`, JSON.stringify({ at: new Date().toISOString(), scale: S, counts, target: TARGET, rows }, null, 2));
  console.log(`\n${rows.filter((r) => !r.ok).length}/${rows.length} thao tác vượt mục tiêu → docs/perf/${label}.json`);
  await rootDb.$disconnect();
}

main();

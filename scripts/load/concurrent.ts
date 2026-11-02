// Đo tải ĐỒNG THỜI (Phase 11, checklist mục 12, D-59): 20 phiên cùng lúc trong một tiến trình (như một server Next dùng chung pool kết nối),
// mỗi phiên lặp chuỗi thao tác trang của vai mình, nghỉ THINK ms ngẫu nhiên giữa hai thao tác (người thật đọc trang; mặc định 2000-5000),
// THINK=0 = bấm liên tục không nghỉ (đo chịu tải tối đa, xấu hơn người thật nhiều lần).
// Mục tiêu: 0 lỗi; p95 thao tác trang < 1.500 ms; p95 báo cáo/dashboard < 6.000 ms (gấp đôi mục tiêu một người).
// Chạy: DATABASE_URL=<…/crm_load> [THINK=2000-5000] npx tsx scripts/load/concurrent.ts [giây=60] [nhãn=concurrent20]  → docs/perf/<nhãn>.json
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "";
if (!/\/[a-z0-9_]+_load(\?|$)/i.test(url)) throw new Error("Chỉ chạy trên DB *_load");
const DURATION = Number(process.argv[2] ?? 60) * 1000;
const TARGET = { page: 1500, report: 6000 };
const [THINK_MIN, THINK_MAX] = (process.env.THINK ?? "2000-5000").split("-").map(Number).concat(0).slice(0, 2) as [number, number];
const LABEL = process.argv[3] ?? "concurrent20";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { rootDb, runInWorkspace, workspaceDb } = await import("../../src/lib/db");
  const { loadUser } = await import("../../src/lib/session");
  const orders = await import("../../src/modules/orders/service");
  const customers = await import("../../src/modules/customers/service");
  const leads = await import("../../src/modules/sales/leads");
  const queue = await import("../../src/modules/sales/queue");
  const tickets = await import("../../src/modules/service/tickets");
  const ful = await import("../../src/modules/fulfillment/service");
  const cod = await import("../../src/modules/fulfillment/cod");
  const rp = await import("../../src/modules/reports/service");
  const per = await import("../../src/modules/reports/period");
  const dash = await import("../../src/modules/reports/dashboard");

  const ws = await rootDb.workspace.findUniqueOrThrow({ where: { code: "LOAD-1" } });
  const u = async (email: string) => (await loadUser((await rootDb.user.findUniqueOrThrow({ where: { email } })).id, ws.id))!;
  const mgr = await u("load-mgr-1@load.invalid");
  const lead = await u("load-lead-1@load.invalid");
  const sales = await Promise.all(Array.from({ length: 14 }, (_, i) => u(`load-s${i}-1@load.invalid`)));
  const c = workspaceDb(ws.id);
  const someCustomers = (await c.customer.findMany({ take: 200, select: { id: true } })).map((x) => x.id);
  const today = per.todayVN();
  const f30 = per.parseReportFilter({ from: per.addDays(today, -29), to: today, group: "market" }, today);
  const ctxFin = await runInWorkspace(ws.id, () => rp.reportContext(mgr, "tai-chinh", f30));
  const of = orders.orderFilter.parse({});

  type Op = { name: string; kind: keyof typeof TARGET; run: () => Promise<unknown> };
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  const salesOps = (s: typeof mgr): Op[] => [
    { name: "Sales: hàng đợi của tôi", kind: "page", run: () => queue.myQueue(s) },
    { name: "Sales: nhu cầu mua (danh sách)", kind: "page", run: () => leads.listLeads(s, leads.parseLeadFilter({})) },
    { name: "Sales: đơn hàng (theo phạm vi)", kind: "page", run: () => orders.listOrders(s, { ...of, page: 1 }) },
    { name: "Sales: ticket của tôi", kind: "page", run: () => tickets.listTickets(s, tickets.parseTicketFilter({})) },
  ];
  const mgrOps: Op[] = [
    { name: "Quản lý: dashboard 30 ngày", kind: "report", run: () => dash.dashboardFor(mgr) },
    { name: "Quản lý: đơn hàng trang 1", kind: "page", run: () => orders.listOrders(mgr, { ...of, page: 1 }) },
    { name: "Quản lý: khách hàng trang 1", kind: "page", run: () => customers.listCustomers(mgr, customers.parseCustomerFilter({})) },
    { name: "Quản lý: hồ sơ 360", kind: "page", run: () => customers.getCustomer360(mgr, pick(someCustomers)) },
    { name: "Quản lý: báo cáo tài chính 30 ngày", kind: "report", run: () => rp.financeReport(mgr, f30, ctxFin) },
    { name: "Quản lý: vận đơn cần can thiệp", kind: "page", run: () => ful.listInterventions(mgr, ful.interventionFilter.parse({})) },
    { name: "Quản lý: COD theo hãng 30 ngày", kind: "report", run: () => cod.codSummary(mgr, f30, null) },
  ];
  const leadOps: Op[] = [
    { name: "Trưởng nhóm: nhu cầu mua của nhóm", kind: "page", run: () => leads.listLeads(lead, leads.parseLeadFilter({})) },
    { name: "Trưởng nhóm: báo cáo bán hàng 30 ngày", kind: "report", run: () => rp.salesReport(lead, f30) },
  ];
  const sessions: { label: string; ops: Op[] }[] = [
    ...sales.map((s, i) => ({ label: `sales-${i}`, ops: salesOps(s) })),
    ...Array.from({ length: 5 }, (_, i) => ({ label: `mgr-${i}`, ops: mgrOps })),
    { label: "lead", ops: leadOps },
  ];
  console.log(`dữ liệu: LOAD-1 · ${sessions.length} phiên đồng thời · ${DURATION / 1000} giây · nghỉ ${THINK_MIN}–${THINK_MAX || THINK_MIN} ms giữa thao tác`);

  const samples = new Map<string, { kind: keyof typeof TARGET; ms: number[] }>();
  const errors: string[] = [];
  const end = Date.now() + DURATION;
  await Promise.all(sessions.map(async (s) => {
    let i = Math.floor(Math.random() * s.ops.length);
    while (Date.now() < end) {
      const op = s.ops[i++ % s.ops.length];
      const t = performance.now();
      try {
        await runInWorkspace(ws.id, op.run);
        const rec = samples.get(op.name) ?? { kind: op.kind, ms: [] };
        rec.ms.push(performance.now() - t);
        samples.set(op.name, rec);
      } catch (e) {
        errors.push(`${op.name}: ${(e as Error).message.slice(0, 300)}`);
      }
      if (THINK_MIN) await sleep(THINK_MIN + Math.random() * Math.max(0, (THINK_MAX || THINK_MIN) - THINK_MIN));
    }
  }));

  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
  const rows = [...samples].map(([name, r]) => ({ name, kind: r.kind, n: r.ms.length, p50: q(r.ms, 0.5), p95: q(r.ms, 0.95), max: Math.round(Math.max(...r.ms)), ok: q(r.ms, 0.95) < TARGET[r.kind] }));
  for (const r of rows) console.log(`${r.ok ? "OK  " : "CHẬM"} p50 ${String(r.p50).padStart(5)} · p95 ${String(r.p95).padStart(5)} · max ${String(r.max).padStart(5)} ms · ${String(r.n).padStart(4)} lượt  ${r.name}`);
  const total = rows.reduce((s, r) => s + r.n, 0);
  console.log(`\n${total} thao tác trong ${DURATION / 1000}s (${(total / (DURATION / 1000)).toFixed(1)}/s), lỗi ${errors.length}, ${rows.filter((r) => !r.ok).length}/${rows.length} vượt mục tiêu p95`);
  for (const e of errors.slice(0, 10)) console.log("LỖI", e);
  mkdirSync("docs/perf", { recursive: true });
  writeFileSync(`docs/perf/${LABEL}.json`, JSON.stringify({ at: new Date().toISOString(), sessions: sessions.length, seconds: DURATION / 1000, thinkMs: [THINK_MIN, THINK_MAX], target: TARGET, total, errors: errors.length, errorSamples: errors.slice(0, 20), rows }, null, 2));
  await rootDb.$disconnect();
}

main();

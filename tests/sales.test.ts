import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb, runInWorkspace, workspaceDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { loadUser } from "@/lib/session";
import { getCustomer360, listCustomers, mergeFromReview, parseCustomerFilter } from "@/modules/customers/service";
import { changeStage, claimLead, createLead, getLead, leadBoard, listLeads, logActivity, parseLeadFilter, reassignLead } from "@/modules/sales/leads";
import { assignPendingLeads, listNotifications, myQueue, remindDue } from "@/modules/sales/queue";
import { createTask, listTasks, parseTaskFilter, setTaskStatus } from "@/modules/sales/tasks";

const T0 = new Date("2026-10-20T03:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3600000);

async function setup(tag: string, routing: object = { rules: [{ market: "AE", team: "A" }, { team: "B" }], maxOpenPerUser: 2 }) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const teamA = await c.team.create({ data: { code: "A", name: "Nhóm A" } as never });
  const teamB = await c.team.create({ data: { code: "B", name: "Nhóm B" } as never });
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  const ae = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const de = await c.market.create({ data: { code: "DE", name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" } as never });
  await c.setting.create({ data: { key: "leadRouting", value: routing } as never });
  const u = async (t: string, roles: ("MANAGER" | "SALES_LEAD" | "SALES" | "MARKETING")[], teamId?: string) =>
    (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles, teamId })).id, ws.id))!;
  const mgr = await u("mgr", ["MANAGER"]);
  const lead = await u("lead", ["SALES_LEAD"], teamA.id);
  const s1 = await u("s1", ["SALES"], teamA.id);
  const s2 = await u("s2", ["SALES"], teamA.id);
  const s3 = await u("s3", ["SALES"], teamB.id);
  const mkt = await u("mkt", ["MARKETING"]);
  // Service đọc ngữ cảnh workspace từ ALS (trang gọi bindTenant); test bọc từng lời gọi.
  const as = <T,>(fn: () => Promise<T>) => runInWorkspace(ws.id, fn);
  const newLead = (by = mgr, extra: Record<string, string> = {}, at = T0) =>
    as(() => createLead(by, { contactName: `Khách ${Math.random().toString(36).slice(2, 6)}`, phone: "+971 50 123 4567", source: "inbox", brandId: brand.id, marketId: ae.id, ...extra }, at));
  return { ws, c, teamA, teamB, brand, ae, de, mgr, lead, s1, s2, s3, mkt, as, newLead };
}

describe("Phase 4 — phân công lead", () => {
  it("lead mới có người phụ trách + hạn phản hồi 4 giờ ngay khi tạo; chia đều trong nhóm theo brand/market", async () => {
    const s = await setup("assign");
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await s.newLead()).id);
    const leads = await s.c.lead.findMany({ where: { id: { in: ids } } });
    expect(leads.every((l) => l.teamId === s.teamA.id && l.ownerId)).toBe(true);
    const load = leads.reduce<Record<string, number>>((m, l) => ({ ...m, [l.ownerId!]: (m[l.ownerId!] ?? 0) + 1 }), {});
    expect(Object.keys(load).sort()).toEqual([s.s1.id, s.s2.id].sort());
    expect(Object.values(load)).toEqual([2, 2]);
    expect(leads[0].firstResponseDueAt?.getTime()).toBe(leads[0].createdAt.getTime() + 4 * 3600000);
    expect(await s.c.assignment.count({ where: { leadId: { in: ids } } })).toBe(4);
    expect((await s.as(() => listNotifications(s.s1))).unread).toBe(2);
  });

  it("quy tắc không điều kiện bắt lead thị trường khác; đủ tải thì để hàng chờ, báo Trưởng nhóm, worker giao khi có chỗ", async () => {
    const s = await setup("cap", { rules: [{ market: "AE", team: "A" }], maxOpenPerUser: 1 });
    const de = await s.newLead(s.mgr, { marketId: s.de.id });
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: de.id } })).teamId).toBeNull(); // không quy tắc khớp → Quản lý được báo
    expect((await s.as(() => listNotifications(s.mgr))).rows[0].title).toMatch(/chưa giao được/);

    const a = await s.newLead();
    const b = await s.newLead();
    const third = await s.newLead();
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: third.id } })).ownerId).toBeNull();
    expect((await s.as(() => listNotifications(s.lead))).rows.some((n) => n.title.includes("chưa giao được"))).toBe(true);

    const ownerA = (await s.c.lead.findUniqueOrThrow({ where: { id: a.id } })).ownerId!;
    const owner = ownerA === s.s1.id ? s.s1 : s.s2;
    await s.as(() => changeStage(owner, { id: a.id, stage: "TU_CHOI", lostReason: "Giá cao" }));
    const r = await assignPendingLeads(s.c, h(1));
    expect(r.assigned).toBe(1);
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: third.id } })).ownerId).toBe(ownerA);
    void b;
  });
});

describe("Phase 4 — phạm vi và quyền", () => {
  it("Sales chỉ thấy lead của mình + chưa giao của nhóm; Trưởng nhóm thấy nhóm; Marketing xem không sửa; team khác không thấy", async () => {
    const s = await setup("scope");
    const own = await s.newLead(s.s1);
    const other = await s.newLead(s.s2);
    const pool = await s.c.lead.create({ data: { contactName: "Chờ nhận", source: "web", teamId: s.teamA.id } as never });
    const teamB = await s.newLead(s.mgr, { marketId: s.de.id });

    const ids = async (u: typeof s.s1) => (await s.as(() => listLeads(u, parseLeadFilter({})))).rows.map((r) => r.id).sort();
    expect(await ids(s.s1)).toEqual([own.id, pool.id].sort());
    expect(await ids(s.lead)).toEqual([own.id, other.id, pool.id].sort());
    expect((await ids(s.mkt)).length).toBe(4);
    await expect(s.as(() => getLead(s.s1, other.id))).rejects.toMatchObject({ status: 404 });
    await expect(s.as(() => getLead(s.lead, teamB.id))).rejects.toMatchObject({ status: 404 });
    await expect(s.as(() => changeStage(s.mkt, { id: own.id, stage: "DANG_TU_VAN" }))).rejects.toMatchObject({ status: 403 });

    const outsider = (await loadUser((await makeUser(`scope-out-${RUN}`, { workspaceId: (await makeWorkspace("scope-o")).id, roles: ["MANAGER"] })).id))!;
    expect((await runInWorkspace(outsider.workspaceId, () => listLeads(outsider, parseLeadFilter({})))).total).toBe(0);

    await s.as(() => claimLead(s.s1, pool.id));
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: pool.id } })).ownerId).toBe(s.s1.id);
    const board = await s.as(() => leadBoard(s.s1, parseLeadFilter({})));
    expect(board.columns.find((c) => c.stage === "MOI")!.total).toBe(2);
  });

  it("chuyển phụ trách: cần lead.assign, đúng phạm vi, có lý do; lịch sử chỉ thêm", async () => {
    const s = await setup("reassign");
    const l = await s.newLead(s.s1);
    await expect(s.as(() => reassignLead(s.s1, { id: l.id, toUserId: s.s2.id, reason: "Nghỉ phép" }))).rejects.toMatchObject({ status: 403 });
    await expect(s.as(() => reassignLead(s.lead, { id: l.id, toUserId: s.s3.id, reason: "Khác nhóm" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(s.as(() => reassignLead(s.lead, { id: l.id, toUserId: s.s2.id, reason: "" }))).rejects.toBeInstanceOf(ValidationError);
    await s.as(() => reassignLead(s.lead, { id: l.id, toUserId: s.s2.id, reason: "Nghỉ phép" }));
    const d = await s.as(() => getLead(s.s2, l.id));
    expect(d.owner?.id).toBe(s.s2.id);
    expect(d.assignments.map((a) => a.reason)).toEqual(["Nghỉ phép", "Người tạo tự nhận"]);
    expect(d.activities[0].body).toMatch(/Chuyển phụ trách/);
    expect(await rootDb.auditLog.count({ where: { workspaceId: s.ws.id, entityId: l.id, action: "assign" } })).toBe(1);
    await expect(s.as(() => getLead(s.s1, l.id))).rejects.toMatchObject({ status: 404 });
  });

  it("Sales chỉ thấy khách/đơn có lead hoặc việc của mình (D-45)", async () => {
    const s = await setup("cust");
    const cust = await s.c.customer.create({ data: { displayName: "Layla", primaryPhoneE164: "+971501234567" } as never });
    const l = await s.newLead(s.s1, { phone: "+971 50 123 4567" });
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).customerId).toBe(cust.id); // gắn khách khi SĐT khớp đúng một hồ sơ
    expect((await s.as(() => listCustomers(s.s1, parseCustomerFilter({})))).total).toBe(1);
    expect((await s.as(() => listCustomers(s.s2, parseCustomerFilter({})))).total).toBe(0);
    await expect(s.as(() => getCustomer360(s.s2, cust.id))).rejects.toMatchObject({ status: 404 });
    expect((await s.as(() => listCustomers(s.mkt, parseCustomerFilter({})))).total).toBe(1);
  });
});

describe("Phase 4 — tương tác, giai đoạn, nhiệm vụ", () => {
  it("lần liên hệ ra đầu tiên ghi đã phản hồi + Mới → Đang tư vấn; Từ chối cần lý do; gửi lặp không nhân đôi", async () => {
    const s = await setup("act");
    const l = await s.newLead(s.s1);
    await s.as(() => logActivity(s.s1, { leadId: l.id, type: "MESSAGE", direction: "IN", body: "Khách hỏi giá" }, h(1)));
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).firstRespondedAt).toBeNull();
    const call = { leadId: l.id, type: "CALL", body: "Gọi tư vấn", durationSec: "120", idempotencyKey: `call-${RUN}` };
    await s.as(() => logActivity(s.s1, call, h(2)));
    await s.as(() => logActivity(s.s1, call, h(2)));
    const after = await s.c.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.stage).toBe("DANG_TU_VAN");
    expect(after.firstRespondedAt?.toISOString()).toBe(h(2).toISOString());
    expect(await s.c.activity.count({ where: { leadId: l.id, type: "CALL" } })).toBe(1);
    await expect(s.as(() => changeStage(s.s1, { id: l.id, stage: "TU_CHOI" }))).rejects.toBeInstanceOf(ValidationError);
    await s.as(() => changeStage(s.s1, { id: l.id, stage: "DA_MUA" }, h(3)));
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).closedAt?.toISOString()).toBe(h(3).toISOString());
  });

  it("tạo lead/việc bấm hai lần (cùng khóa) chỉ ra một bản; Sales không giao việc cho người khác", async () => {
    const s = await setup("idem");
    const key = `lead-${RUN}`;
    const a = await s.newLead(s.mgr, { idempotencyKey: key });
    const b = await s.newLead(s.mgr, { idempotencyKey: key });
    expect(b).toEqual({ id: a.id, replayed: true });
    expect(await s.c.lead.count()).toBe(1);

    const task = { type: "CALL_BACK", title: "Gọi lại", dueAt: h(5).toISOString(), leadId: a.id, idempotencyKey: `task-${RUN}` };
    const owner = (await s.c.lead.findUniqueOrThrow({ where: { id: a.id } })).ownerId === s.s1.id ? s.s1 : s.s2;
    const [t1, t2] = await Promise.all([s.as(() => createTask(owner, task)), s.as(() => createTask(owner, task))]);
    expect(t1.task.id).toBe(t2.task.id);
    expect(await s.c.task.count()).toBe(1);
    await expect(s.as(() => createTask(s.s1, { ...task, idempotencyKey: undefined, assigneeId: s.s3.id }))).rejects.toBeInstanceOf(ValidationError);
    await s.as(() => createTask(s.lead, { type: "FOLLOW_UP", title: "Theo dõi", dueAt: h(30).toISOString(), assigneeId: owner.id }));
    expect((await s.as(() => listTasks(s.lead, parseTaskFilter({})))).total).toBe(2);
    expect((await s.as(() => listTasks(s.s3, parseTaskFilter({})))).total).toBe(0);
    await s.as(() => setTaskStatus(owner, t1.task.id, "DONE", h(4)));
    expect((await s.c.task.findUniqueOrThrow({ where: { id: t1.task.id } })).completedAt?.toISOString()).toBe(h(4).toISOString());
  });

  it("hàng đợi sắp quá hạn trước; worker nhắc một lần (thông báo + Outbox SIMULATED), chạy lại không trùng", async () => {
    const s = await setup("queue");
    const l = await s.newLead(s.s1, {}, T0);
    await s.as(() => createTask(s.s1, { type: "CALL_BACK", title: "Gọi lại Layla", dueAt: h(5.2).toISOString() }));
    const q = await s.as(() => myQueue(s.s1, h(5)));
    expect(q.items.map((i) => [i.kind, i.overdue])).toEqual([["lead_response", true], ["task", false]]);
    expect(q.items[0].id).toBe(l.id);

    const r1 = await remindDue(s.c, h(5));
    const r2 = await remindDue(s.c, h(5.1));
    expect(r1).toMatchObject({ taskReminders: 1, leadAlerts: 2 }); // Sales + Trưởng nhóm
    expect(r2).toMatchObject({ taskReminders: 0, leadAlerts: 0 });
    const out = await s.c.outbox.findMany();
    expect(out.map((o) => [o.channel, o.status])).toEqual([["EMAIL", "SIMULATED"]]);
  });

  it("gộp khách chuyển lead/việc sang hồ sơ giữ lại; tách lại trả về", async () => {
    const s = await setup("merge");
    const a = await s.c.customer.create({ data: { displayName: "A", primaryPhoneE164: "+971501111111" } as never });
    const b = await s.c.customer.create({ data: { displayName: "B", primaryPhoneE164: "+971502222222" } as never });
    const l = await s.newLead(s.s1, { phone: "+971 50 222 2222" });
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).customerId).toBe(b.id);
    const review = await s.c.customerReview.create({ data: { customerAId: a.id, customerBId: b.id, reasons: {} } as never });
    const res = await s.as(() => mergeFromReview(s.mgr, review.id));
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).customerId).toBe(a.id);
    const { unmergeCustomers } = await import("@/modules/customers/service");
    await s.as(() => unmergeCustomers(s.mgr, (res as { mergeLogId: string }).mergeLogId));
    expect((await s.c.lead.findUniqueOrThrow({ where: { id: l.id } })).customerId).toBe(b.id);
  });
});

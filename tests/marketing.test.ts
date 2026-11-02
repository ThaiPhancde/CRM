import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { runInWorkspace, workspaceDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { loadUser } from "@/lib/session";
import { enrollJourney, nextSendable, processDueRuns, saveJourney, setJourneyStatus, type Step } from "@/modules/marketing/journeys";
import { compileRules, previewSegment, runSegmentFor, saveSegment } from "@/modules/marketing/segments";

// 08:00 UTC = 12:00 Dubai, 09:00 Berlin (mùa đông) — trong khung gửi 9–20 giờ địa phương.
const T = new Date("2026-11-03T08:00:00Z");
const h = (n: number) => new Date(T.getTime() + n * 3600000);
const d = (n: number) => h(n * 24);

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const c = workspaceDb(ws.id);
  const brand = await c.brand.create({ data: { code: "LUMI", name: "Lumi" } as never });
  const ae = await c.market.create({ data: { code: "AE", name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" } as never });
  const de = await c.market.create({ data: { code: "DE", name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" } as never });
  const store = await c.store.create({ data: { brandId: brand.id, code: `S-${RUN}`, name: "S", platform: "pancake" } as never });
  const u = async (t: string, roles: ("MANAGER" | "MARKETING")[]) => (await loadUser((await makeUser(`${tag}-${t}`, { workspaceId: ws.id, roles })).id, ws.id))!;
  const mgr = await u("mgr", ["MANAGER"]);
  const mkt = await u("mkt", ["MARKETING"]);
  const champs = await c.scoreVersion.create({ data: { type: "RFM", version: 1, weights: {}, active: true } as never });
  /** Khách kèm chỉ số R12M + hạng RFM. */
  const customer = async (name: string, o: { market?: string; band?: string; days?: number; email?: string | null; phone?: string } = {}) => {
    const cu = await c.customer.create({ data: { displayName: name, marketId: o.market ?? ae.id, primaryEmail: o.email === undefined ? `${name.toLowerCase()}@x.invalid` : o.email, primaryPhoneE164: o.phone ?? null, locale: "en" } as never });
    await c.customerMetric.create({ data: { id: `${ws.id}:${cu.id}:R12M`, customerId: cu.id, period: "R12M", asOf: T, orders: 3, deliveredOrders: 3, failedByCustomer: 0, confirmedOrders: 3, rev01: "0", rev02: "0", rev03: "1000", rev04: "0", refunds: "0", recencyDays: 40, avgCycleDays: 45, daysToNextPurchase: o.days ?? 5 } as never });
    await c.score.create({ data: { type: "RFM", versionId: champs.id, customerId: cu.id, value: 555, band: o.band ?? "CHAMPIONS", reasons: [], missingData: [], computedAt: T } as never });
    return cu;
  };
  const as = <X,>(fn: () => Promise<X>) => runInWorkspace(ws.id, fn);
  return { ws, c, brand, ae, de, store, mgr, mkt, customer, as };
}

const REPURCHASE = { op: "and", rules: [{ field: "rfm", cmp: "in", value: ["CHAMPIONS", "TRUNG_THANH"] }, { field: "daysToNextPurchase", cmp: "lte", value: 7 }] } as const;

describe("Phase 7 — phân khúc động", () => {
  it("điều kiện theo hạng RFM + số ngày tới chu kỳ mua; xem trước; chạy lưu ảnh chụp, chỉ giữ danh sách lần mới nhất", async () => {
    const s = await setup("seg");
    const a = await s.customer("Anna", { days: 3 });
    await s.customer("Ben", { days: 30 });          // còn xa chu kỳ
    await s.customer("Cara", { band: "NGU_DONG" }); // sai hạng
    const p = await s.as(() => previewSegment(s.mkt, REPURCHASE, T));
    expect([p.count, p.sample.map((x) => x.id)]).toEqual([1, [a.id]]);
    const seg = await s.as(() => saveSegment(s.mkt, { name: "Gần chu kỳ mua lại", rules: REPURCHASE }));
    const r1 = await runSegmentFor(s.c, seg.id, s.mkt.id, T);
    await s.customer("Dan", { days: 1 });
    const r2 = await runSegmentFor(s.c, seg.id, s.mkt.id, h(1));
    expect([r1.count, r2.count]).toEqual([1, 2]);
    expect(await s.c.segmentRun.count({ where: { segmentId: seg.id } })).toBe(2);
    expect(await s.c.segmentMember.count({ where: { runId: r1.runId } })).toBe(0); // lần cũ chỉ giữ metadata
    expect((await s.c.segment.findUniqueOrThrow({ where: { id: seg.id } })).lastCount).toBe(2);
  });

  it("chỉ trường trong danh sách; lọc theo tiền cần quyền tiền; nhóm lồng tối đa 3 cấp", async () => {
    const s = await setup("segv");
    expect(() => compileRules({ op: "and", rules: [{ field: "password", cmp: "eq", value: "x" }] }, { now: T, money: true })).toThrow(ValidationError);
    await expect(s.as(() => previewSegment(s.mkt, { op: "and", rules: [{ field: "rev03", cmp: "gte", value: 100 }] }, T))).rejects.toMatchObject({ status: 403 });
    await expect(s.as(() => previewSegment(s.mgr, { op: "and", rules: [{ field: "rev03", cmp: "gte", value: 100 }] }, T))).resolves.toBeTruthy();
    const deep = { op: "and", rules: [{ op: "or", rules: [{ op: "and", rules: [{ op: "or", rules: [{ field: "orderCount", cmp: "gt", value: 1 }] }] }] }] } as const;
    try {
      compileRules(deep as never, { now: T, money: true });
      throw new Error("không ném lỗi");
    } catch (e) {
      expect((e as ValidationError).fields?.rules).toMatch(/3 cấp/);
    }
  });
});

describe("Phase 7 — hành trình mua lại (HLD §8.5)", () => {
  const STEPS: Step[] = [
    { type: "SEND", channel: "EMAIL", template: "repurchase_reminder" },
    { type: "WAIT", days: 3 },
    { type: "SEND", channel: "EMAIL", template: "repurchase_offer" },
    { type: "TASK", title: "Gọi chăm sóc khách sắp mua lại", dueDays: 1 },
  ];
  async function journey(s: Awaited<ReturnType<typeof setup>>) {
    const seg = await s.as(() => saveSegment(s.mkt, { name: "Gần chu kỳ", rules: REPURCHASE }));
    const j = await s.as(() => saveJourney(s.mkt, { name: "Gần chu kỳ mua lại", segmentId: seg.id, brandId: s.brand.id, steps: STEPS, exitRules: { purchased: true, optOut: true, openTicket: true, expireDays: 30 } }));
    await expect(s.as(() => setJourneyStatus(s.mkt, j.id, "ACTIVE", T))).rejects.toMatchObject({ status: 403 }); // Marketing không tự bật
    await s.as(() => setJourneyStatus(s.mgr, j.id, "ACTIVE", T));
    return j;
  }

  it("khách mua giữa chừng thì dừng có lý do; vượt giới hạn liên hệ thì bỏ qua có lý do; chỉ Outbox SIMULATED; chạy lại không gửi trùng", async () => {
    const s = await setup("jr");
    const buyer = await s.customer("Buyer");
    const capped = await s.customer("Capped");
    for (let i = 0; i < 2; i++) await s.c.contactLog.create({ data: { customerId: capped.id, channel: "EMAIL", source: "campaign", createdAt: h(-24 * (i + 1)) } as never }); // 2 tin trong 7 ngày
    const j = await journey(s);
    expect((await enrollJourney(s.c, j.id, T)).enrolled).toBe(2);
    expect((await enrollJourney(s.c, j.id, h(1))).enrolled).toBe(0); // không đưa trùng

    const r1 = await processDueRuns(s.c, T);
    expect(r1.outcomes).toEqual({ WAITING: 2 });
    const again = await processDueRuns(s.c, T); // chạy lại cùng lúc: không có gì đến hạn, không gửi thêm
    expect(again.processed).toBe(0);
    const outbox = await s.c.outbox.findMany();
    expect(outbox.map((o) => [o.recipient, o.status])).toEqual([["buyer@x.invalid", "SIMULATED"]]);
    const capLog = await s.c.journeyStepLog.findFirstOrThrow({ where: { run: { customerId: capped.id }, stepIndex: 0 } });
    expect([capLog.outcome, capLog.detail]).toEqual(["SKIPPED_CAP", "Đã nhận 2/2 tin EMAIL trong 7 ngày"]);

    // Buyer đặt đơn trong lúc chờ → lượt sau dừng với lý do.
    await s.c.order.create({ data: { storeId: s.store.id, customerId: buyer.id, orderNumber: "#B1", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED", currency: "AED", grossAmount: "1", discount: "0", shippingFee: "0", netAmount: "1", fxRate: "1", fxDate: T, netBase: "1", bookedAt: d(1) } as never });
    const r2 = await processDueRuns(s.c, d(3));
    expect(r2.outcomes).toEqual({ EXITED: 1, COMPLETED: 1 });
    const buyerRun = await s.c.journeyRun.findFirstOrThrow({ where: { customerId: buyer.id } });
    expect([buyerRun.status, buyerRun.exitReason]).toEqual(["EXITED", "Khách đã mua"]);
    // Capped: sau 3 ngày 2 tin cũ vẫn trong 7 ngày → tin thứ hai cũng bị chặn; việc vẫn được tạo cho người soạn hành trình.
    expect(await s.c.task.count({ where: { customerId: capped.id } })).toBe(1);
    expect(await s.c.outbox.count()).toBe(1);
    // Gọi lại lần nữa (giả lập worker trùng lượt): không thêm tin, không thêm việc.
    await processDueRuns(s.c, d(3));
    expect([await s.c.outbox.count(), await s.c.task.count()]).toEqual([1, 1]);
  });

  it("EU cần đồng ý trước; ngoài giờ địa phương thì dời tới 9:00; đang có khiếu nại thì dừng", async () => {
    const s = await setup("jr2");
    const eu = await s.customer("Euro", { market: s.de.id });
    const late = await s.customer("Late");
    const ticketed = await s.customer("Ticketed");
    await s.c.ticket.create({ data: { code: `TK-${RUN}`, type: "LOI_HANG", priority: "TRUNG", subject: "Lỗi", customerId: ticketed.id, firstResponseDueAt: T, resolveDueAt: T } as never });
    const j = await journey(s);
    await enrollJourney(s.c, j.id, T);
    // Khách UAE cho vào lúc 22:00 Dubai (18:00 UTC) → dời tới 9:00 Dubai hôm sau (05:00 UTC).
    await s.c.journeyRun.updateMany({ where: { customerId: late.id }, data: { nextAt: h(10) } });
    await processDueRuns(s.c, T);
    const euLog = await s.c.journeyStepLog.findFirstOrThrow({ where: { run: { customerId: eu.id } } });
    expect([euLog.outcome, euLog.detail]).toEqual(["SKIPPED_NO_CONSENT", "Thị trường DE cần khách đồng ý trước"]);
    const tRun = await s.c.journeyRun.findFirstOrThrow({ where: { customerId: ticketed.id } });
    expect([tRun.status, tRun.exitReason]).toEqual(["EXITED", "Đang có khiếu nại cần xử lý"]);
    await processDueRuns(s.c, h(10));
    const lateRun = await s.c.journeyRun.findFirstOrThrow({ where: { customerId: late.id } });
    expect([lateRun.status, lateRun.nextAt.toISOString(), lateRun.stepIndex]).toEqual(["RUNNING", "2026-11-04T05:00:00.000Z", 0]);
    expect(await s.c.outbox.count({ where: { recipient: "late@x.invalid" } })).toBe(0);
    // EU đồng ý rồi → hành trình mới của khách này gửi được (kiểm hàm giờ thuần).
    expect(nextSendable(new Date("2026-11-03T21:30:00Z"), "Europe/Berlin").toISOString()).toBe("2026-11-04T08:00:00.000Z");
  });

  it("đang bật thì không sửa bước; cần ít nhất một bước gửi tin hoặc tạo việc", async () => {
    const s = await setup("jr3");
    const j = await journey(s);
    await expect(s.as(() => saveJourney(s.mkt, { id: j.id, name: j.name, segmentId: j.segmentId, steps: STEPS, exitRules: {} }))).rejects.toBeInstanceOf(ValidationError);
    await expect(s.as(() => saveJourney(s.mkt, { name: "Rỗng", segmentId: j.segmentId, steps: [{ type: "WAIT", days: 1 }], exitRules: {} }))).rejects.toThrow(ValidationError);
  });
});

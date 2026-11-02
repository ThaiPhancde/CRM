import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { OPT_IN_MARKETS, QUIET, nextSendable } from "@/modules/marketing/journeys";
import { FIELDS, compileRules, segmentWhere, type Group } from "@/modules/marketing/segments";

const FIXED_NOW = new Date("2026-11-01T00:00:00.000Z");
const FULL_CTX = { now: FIXED_NOW, money: true };
const NO_MONEY_CTX = { now: FIXED_NOW, money: false };

describe("marketing segment rule compiler (compileRules & segmentWhere)", () => {
  const validRows: [string, Group, unknown][] = [
    // 1. market (eq, neq, in list)
    ["market eq", { op: "and", rules: [{ field: "market", cmp: "eq", value: "mkt-vn" }] }, { AND: [{ marketId: "mkt-vn" }] }],
    ["market neq", { op: "and", rules: [{ field: "market", cmp: "neq", value: "mkt-vn" }] }, { AND: [{ marketId: { not: "mkt-vn" } }] }],
    ["market in list", { op: "and", rules: [{ field: "market", cmp: "in", value: ["mkt-vn", "mkt-ae"] }] }, { AND: [{ marketId: { in: ["mkt-vn", "mkt-ae"] } }] }],
    // 2. brand (eq, neq, in list)
    ["brand eq", { op: "and", rules: [{ field: "brand", cmp: "eq", value: "brand-1" }] }, { AND: [{ orders: { some: { store: { brandId: "brand-1" } } } }] }],
    ["brand neq", { op: "and", rules: [{ field: "brand", cmp: "neq", value: "brand-1" }] }, { AND: [{ orders: { none: { store: { brandId: "brand-1" } } } }] }],
    ["brand in list", { op: "and", rules: [{ field: "brand", cmp: "in", value: ["brand-1", "brand-2"] }] }, { AND: [{ orders: { some: { store: { brandId: { in: ["brand-1", "brand-2"] } } } } }] }],
    // 3. tag (has, not_has)
    ["tag has", { op: "and", rules: [{ field: "tag", cmp: "has", value: "vip" }] }, { AND: [{ tags: { has: "vip" } }] }],
    ["tag not_has", { op: "and", rules: [{ field: "tag", cmp: "not_has", value: "spam" }] }, { AND: [{ NOT: { tags: { has: "spam" } } }] }],
    // 4. language (eq, neq)
    ["language eq", { op: "and", rules: [{ field: "language", cmp: "eq", value: "vi" }] }, { AND: [{ locale: { startsWith: "vi" } }] }],
    ["language neq", { op: "and", rules: [{ field: "language", cmp: "neq", value: "ar" }] }, { AND: [{ NOT: { locale: { startsWith: "ar" } } }] }],
    // 5. orderCount (eq, neq, gt, gte, lt, lte)
    ["orderCount eq", { op: "and", rules: [{ field: "orderCount", cmp: "eq", value: 1 }] }, { AND: [{ orderCount: { equals: 1 } }] }],
    ["orderCount neq", { op: "and", rules: [{ field: "orderCount", cmp: "neq", value: 0 }] }, { AND: [{ orderCount: { not: 0 } }] }],
    ["orderCount gt", { op: "and", rules: [{ field: "orderCount", cmp: "gt", value: 2 }] }, { AND: [{ orderCount: { gt: 2 } }] }],
    ["orderCount gte", { op: "and", rules: [{ field: "orderCount", cmp: "gte", value: 3 }] }, { AND: [{ orderCount: { gte: 3 } }] }],
    ["orderCount lt", { op: "and", rules: [{ field: "orderCount", cmp: "lt", value: 5 }] }, { AND: [{ orderCount: { lt: 5 } }] }],
    ["orderCount lte", { op: "and", rules: [{ field: "orderCount", cmp: "lte", value: 10 }] }, { AND: [{ orderCount: { lte: 10 } }] }],
    // 6. lastOrderDays (gte, gt, lte, lt — inverts comparison on lastOrderAt relative to FIXED_NOW)
    ["lastOrderDays gte 30", { op: "and", rules: [{ field: "lastOrderDays", cmp: "gte", value: 30 }] }, { AND: [{ lastOrderAt: { lte: new Date("2026-10-02T00:00:00.000Z") } }] }],
    ["lastOrderDays gt 30", { op: "and", rules: [{ field: "lastOrderDays", cmp: "gt", value: 30 }] }, { AND: [{ lastOrderAt: { lt: new Date("2026-10-02T00:00:00.000Z") } }] }],
    ["lastOrderDays lte 7", { op: "and", rules: [{ field: "lastOrderDays", cmp: "lte", value: 7 }] }, { AND: [{ lastOrderAt: { gte: new Date("2026-10-25T00:00:00.000Z") } }] }],
    ["lastOrderDays lt 7", { op: "and", rules: [{ field: "lastOrderDays", cmp: "lt", value: 7 }] }, { AND: [{ lastOrderAt: { gt: new Date("2026-10-25T00:00:00.000Z") } }] }],
    // 7. recencyDays (metric R12M)
    ["recencyDays gte 45", { op: "and", rules: [{ field: "recencyDays", cmp: "gte", value: 45 }] }, { AND: [{ metrics: { some: { period: "R12M", recencyDays: { gte: 45 } } } }] }],
    ["recencyDays lte 15", { op: "and", rules: [{ field: "recencyDays", cmp: "lte", value: 15 }] }, { AND: [{ metrics: { some: { period: "R12M", recencyDays: { lte: 15 } } } }] }],
    // 8. daysToNextPurchase (metric R12M)
    ["daysToNextPurchase lte 7", { op: "and", rules: [{ field: "daysToNextPurchase", cmp: "lte", value: 7 }] }, { AND: [{ metrics: { some: { period: "R12M", daysToNextPurchase: { lte: 7 } } } }] }],
    ["daysToNextPurchase gt 0", { op: "and", rules: [{ field: "daysToNextPurchase", cmp: "gt", value: 0 }] }, { AND: [{ metrics: { some: { period: "R12M", daysToNextPurchase: { gt: 0 } } } }] }],
    // 9. deliveredOrders (metric R12M)
    ["deliveredOrders gte 2", { op: "and", rules: [{ field: "deliveredOrders", cmp: "gte", value: 2 }] }, { AND: [{ metrics: { some: { period: "R12M", deliveredOrders: { gte: 2 } } } }] }],
    ["deliveredOrders eq 1", { op: "and", rules: [{ field: "deliveredOrders", cmp: "eq", value: 1 }] }, { AND: [{ metrics: { some: { period: "R12M", deliveredOrders: { equals: 1 } } } }] }],
    // 10. rev03 (metric R12M with money permission)
    ["rev03 gte 5000000", { op: "and", rules: [{ field: "rev03", cmp: "gte", value: 5000000 }] }, { AND: [{ metrics: { some: { period: "R12M", rev03: { gte: 5000000 } } } }] }],
    // 11. repurchase60 (bool metric R12M)
    ["repurchase60 eq true", { op: "and", rules: [{ field: "repurchase60", cmp: "eq", value: true }] }, { AND: [{ metrics: { some: { period: "R12M", repurchase60: true } } }] }],
    ["repurchase60 eq 'true'", { op: "and", rules: [{ field: "repurchase60", cmp: "eq", value: "true" }] }, { AND: [{ metrics: { some: { period: "R12M", repurchase60: true } } }] }],
    ["repurchase60 neq true", { op: "and", rules: [{ field: "repurchase60", cmp: "neq", value: true }] }, { AND: [{ metrics: { some: { period: "R12M", repurchase60: false } } }] }],
    // 12. openTickets (metric R12M)
    ["openTickets eq 0", { op: "and", rules: [{ field: "openTickets", cmp: "eq", value: 0 }] }, { AND: [{ metrics: { some: { period: "R12M", openTickets: { equals: 0 } } } }] }],
    ["openTickets gt 0", { op: "and", rules: [{ field: "openTickets", cmp: "gt", value: 0 }] }, { AND: [{ metrics: { some: { period: "R12M", openTickets: { gt: 0 } } } }] }],
    // 13. rfm (score RFM eq, in, neq)
    ["rfm eq CHAMPIONS", { op: "and", rules: [{ field: "rfm", cmp: "eq", value: "CHAMPIONS" }] }, { AND: [{ scores: { some: { type: "RFM", version: { active: true }, band: "CHAMPIONS" } } }] }],
    ["rfm in list", { op: "and", rules: [{ field: "rfm", cmp: "in", value: ["CHAMPIONS", "TRUNG_THANH"] }] }, { AND: [{ scores: { some: { type: "RFM", version: { active: true }, band: { in: ["CHAMPIONS", "TRUNG_THANH"] } } } }] }],
    ["rfm neq NGU_DONG", { op: "and", rules: [{ field: "rfm", cmp: "neq", value: "NGU_DONG" }] }, { AND: [{ scores: { none: { type: "RFM", version: { active: true }, band: "NGU_DONG" } } }] }],
    // 14. txnRisk (score TXN_RISK eq, neq)
    ["txnRisk eq CAO", { op: "and", rules: [{ field: "txnRisk", cmp: "eq", value: "CAO" }] }, { AND: [{ scores: { some: { type: "TXN_RISK", version: { active: true }, band: "CAO" } } }] }],
    ["txnRisk neq CAO", { op: "and", rules: [{ field: "txnRisk", cmp: "neq", value: "CAO" }] }, { AND: [{ scores: { none: { type: "TXN_RISK", version: { active: true }, band: "CAO" } } }] }],
    // 15. supportNeed (score SUPPORT_NEED eq, in, neq)
    ["supportNeed eq CAO", { op: "and", rules: [{ field: "supportNeed", cmp: "eq", value: "CAO" }] }, { AND: [{ scores: { some: { type: "SUPPORT_NEED", version: { active: true }, band: "CAO" } } }] }],
    ["supportNeed in [CAO, VUA]", { op: "and", rules: [{ field: "supportNeed", cmp: "in", value: ["CAO", "VUA"] }] }, { AND: [{ scores: { some: { type: "SUPPORT_NEED", version: { active: true }, band: { in: ["CAO", "VUA"] } } } }] }],
    ["supportNeed neq THAP", { op: "and", rules: [{ field: "supportNeed", cmp: "neq", value: "THAP" }] }, { AND: [{ scores: { none: { type: "SUPPORT_NEED", version: { active: true }, band: "THAP" } } }] }],
    // 16. OR group & nested depth 3
    [
      "or group with multiple rules",
      { op: "or", rules: [{ field: "market", cmp: "eq", value: "mkt-vn" }, { field: "tag", cmp: "has", value: "vip" }] },
      { OR: [{ marketId: "mkt-vn" }, { tags: { has: "vip" } }] },
    ],
    [
      "nested groups up to depth 3 (depth 0 -> 1 -> 2)",
      {
        op: "and",
        rules: [
          { field: "market", cmp: "eq", value: "mkt-vn" },
          { op: "or", rules: [{ field: "orderCount", cmp: "gte", value: 3 }, { op: "and", rules: [{ field: "tag", cmp: "has", value: "loyal" }] }] },
        ],
      },
      { AND: [{ marketId: "mkt-vn" }, { OR: [{ orderCount: { gte: 3 } }, { AND: [{ tags: { has: "loyal" } }] }] }] },
    ],
  ];

  it("covers every field in FIELDS", () => {
    const testedFields = new Set<string>();
    for (const [, group] of validRows) {
      for (const r of group.rules) {
        if ("field" in r) testedFields.add(r.field);
      }
    }
    expect(testedFields.size).toBe(Object.keys(FIELDS).length);
  });

  it.each(validRows)("compiles %s", (_name, group, expected) => {
    expect(compileRules(group, FULL_CTX)).toEqual(expected);
  });

  const errorRows: [string, Group][] = [
    ["unknown field", { op: "and", rules: [{ field: "unknownField", cmp: "eq", value: "x" }] }],
    ["non-number value for a number field", { op: "and", rules: [{ field: "orderCount", cmp: "gte", value: "abc" }] }],
    ["in on lastOrderDays", { op: "and", rules: [{ field: "lastOrderDays", cmp: "in", value: [7, 14] }] }],
    ["has on a number field", { op: "and", rules: [{ field: "orderCount", cmp: "has", value: 3 }] }],
    ["gt on an enum field (market)", { op: "and", rules: [{ field: "market", cmp: "gt", value: "m1" }] }],
    ["lt on a tags field", { op: "and", rules: [{ field: "tag", cmp: "lt", value: "vip" }] }],
    ["in on a bool field", { op: "and", rules: [{ field: "repurchase60", cmp: "in", value: [true] }] }],
    ["gt on a score field", { op: "and", rules: [{ field: "rfm", cmp: "gt", value: "CHAMPIONS" }] }],
    [
      "nested groups depth 4 (depth 0 -> 1 -> 2 -> 3 throws)",
      { op: "and", rules: [{ op: "or", rules: [{ op: "and", rules: [{ op: "or", rules: [{ field: "orderCount", cmp: "gte", value: 1 }] }] }] }] },
    ],
  ];

  it.each(errorRows)("throws ValidationError on %s", (_name, group) => {
    expect(() => compileRules(group, FULL_CTX)).toThrow(ValidationError);
  });

  it("throws 403 error when compiling rev03 with money: false", () => {
    const group: Group = { op: "and", rules: [{ field: "rev03", cmp: "gte", value: 1000000 }] };
    let caught: unknown;
    try {
      compileRules(group, NO_MONEY_CTX);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as { status?: number }).status).toBe(403);
  });

  it("segmentWhere adds mergedIntoId: null to compiled rules", () => {
    const group: Group = { op: "and", rules: [{ field: "orderCount", cmp: "gte", value: 3 }] };
    expect(segmentWhere(group, FULL_CTX)).toEqual({
      AND: [{ mergedIntoId: null }, { AND: [{ orderCount: { gte: 3 } }] }],
    });
  });
});

describe("quiet hours and contact rules (nextSendable, QUIET, OPT_IN_MARKETS)", () => {
  it("exports QUIET = { from: 9, to: 20 } and OPT_IN_MARKETS containing DE and FR", () => {
    expect(QUIET).toEqual({ from: 9, to: 20 });
    expect(OPT_IN_MARKETS).toContain("DE");
    expect(OPT_IN_MARKETS).toContain("FR");
  });

  const scheduleRows: [string, string, string, string][] = [
    // Asia/Ho_Chi_Minh (UTC+7)
    ["Asia/Ho_Chi_Minh inside window (10:15 local)", "Asia/Ho_Chi_Minh", "2026-11-02T03:15:00.000Z", "2026-11-02T03:15:00.000Z"],
    ["Asia/Ho_Chi_Minh 08:59 local -> 09:00 same day", "Asia/Ho_Chi_Minh", "2026-11-02T01:59:00.000Z", "2026-11-02T02:00:00.000Z"],
    ["Asia/Ho_Chi_Minh 20:00 local -> 09:00 next day", "Asia/Ho_Chi_Minh", "2026-11-02T13:00:00.000Z", "2026-11-03T02:00:00.000Z"],
    ["Asia/Ho_Chi_Minh 23:30 local -> 09:00 next day", "Asia/Ho_Chi_Minh", "2026-11-02T16:30:00.000Z", "2026-11-03T02:00:00.000Z"],
    // Asia/Dubai (UTC+4)
    ["Asia/Dubai inside window (14:00 local)", "Asia/Dubai", "2026-11-02T10:00:00.000Z", "2026-11-02T10:00:00.000Z"],
    ["Asia/Dubai 08:59 local -> 09:00 same day", "Asia/Dubai", "2026-11-02T04:59:00.000Z", "2026-11-02T05:00:00.000Z"],
    ["Asia/Dubai 20:00 local -> 09:00 next day", "Asia/Dubai", "2026-11-02T16:00:00.000Z", "2026-11-03T05:00:00.000Z"],
    ["Asia/Dubai 23:30 local -> 09:00 next day", "Asia/Dubai", "2026-11-02T19:30:00.000Z", "2026-11-03T05:00:00.000Z"],
    // Europe/Berlin around DST end (2026-10-24 is CEST UTC+2; 2026-10-25 DST ends -> CET UTC+1; 2026-10-26 is CET UTC+1)
    ["Europe/Berlin 2026-10-24 inside window (12:00 CEST)", "Europe/Berlin", "2026-10-24T10:00:00.000Z", "2026-10-24T10:00:00.000Z"],
    ["Europe/Berlin 2026-10-24 08:59 CEST -> 09:00 CEST same day", "Europe/Berlin", "2026-10-24T06:59:00.000Z", "2026-10-24T07:00:00.000Z"],
    ["Europe/Berlin 2026-10-24 20:00 CEST -> 2026-10-25 09:00 CET across DST end", "Europe/Berlin", "2026-10-24T18:00:00.000Z", "2026-10-25T08:00:00.000Z"],
    ["Europe/Berlin 2026-10-24 23:30 CEST -> 2026-10-25 09:00 CET across DST end", "Europe/Berlin", "2026-10-24T21:30:00.000Z", "2026-10-25T08:00:00.000Z"],
    ["Europe/Berlin 2026-10-26 inside window (09:00 CET)", "Europe/Berlin", "2026-10-26T08:00:00.000Z", "2026-10-26T08:00:00.000Z"],
    ["Europe/Berlin 2026-10-26 08:59 CET -> 09:00 CET same day", "Europe/Berlin", "2026-10-26T07:59:00.000Z", "2026-10-26T08:00:00.000Z"],
    ["Europe/Berlin 2026-10-26 20:00 CET -> 2026-10-27 09:00 CET", "Europe/Berlin", "2026-10-26T19:00:00.000Z", "2026-10-27T08:00:00.000Z"],
    ["Europe/Berlin 2026-10-26 23:30 CET -> 2026-10-27 09:00 CET", "Europe/Berlin", "2026-10-26T22:30:00.000Z", "2026-10-27T08:00:00.000Z"],
    // America/New_York (EST UTC-5 on 2026-11-02)
    ["America/New_York inside window (11:30 EST)", "America/New_York", "2026-11-02T16:30:00.000Z", "2026-11-02T16:30:00.000Z"],
    ["America/New_York 08:59 EST -> 09:00 EST same day", "America/New_York", "2026-11-02T13:59:00.000Z", "2026-11-02T14:00:00.000Z"],
    ["America/New_York 20:00 EST -> 09:00 EST next day", "America/New_York", "2026-11-03T01:00:00.000Z", "2026-11-03T14:00:00.000Z"],
    ["America/New_York 23:30 EST -> 09:00 EST next day", "America/New_York", "2026-11-03T04:30:00.000Z", "2026-11-03T14:00:00.000Z"],
    // Asia/Kolkata (IST UTC+5:30 — bước 15 phút nên dời đúng 09:00 IST = 03:30Z)
    ["Asia/Kolkata inside window (09:45 IST)", "Asia/Kolkata", "2026-11-02T04:15:00.000Z", "2026-11-02T04:15:00.000Z"],
    ["Asia/Kolkata 08:59 IST -> 09:00 IST (03:30 UTC)", "Asia/Kolkata", "2026-11-02T03:29:00.000Z", "2026-11-02T03:30:00.000Z"],
    ["Asia/Kolkata 20:00 IST -> next day 09:00 IST", "Asia/Kolkata", "2026-11-02T14:30:00.000Z", "2026-11-03T03:30:00.000Z"],
    ["Asia/Kolkata 23:30 IST -> next day 09:00 IST", "Asia/Kolkata", "2026-11-02T18:00:00.000Z", "2026-11-03T03:30:00.000Z"],
  ];

  it.each(scheduleRows)("computes nextSendable for %s", (_name, tz, at, expected) => {
    expect(nextSendable(new Date(at), tz).toISOString()).toBe(expected);
  });
});

describe("compileRules with active score version ids (segmentCtx)", () => {
  it("filters by versionId directly so the (versionId, band, customerId) index is used", () => {
    const ctx = { now: new Date("2026-11-02T00:00:00Z"), money: true, versions: { RFM: "v-rfm" } };
    expect(compileRules({ op: "and", rules: [{ field: "rfm", cmp: "in", value: ["CHAMPIONS"] }, { field: "txnRisk", cmp: "neq", value: "CAO" }] }, ctx)).toEqual({
      AND: [
        { scores: { some: { versionId: "v-rfm", band: { in: ["CHAMPIONS"] } } } },
        { scores: { none: { type: "TXN_RISK", version: { active: true }, band: "CAO" } } }, // không có id → lọc version.active
      ],
    });
  });
});

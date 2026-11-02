import { describe, expect, it } from "vitest";
import {
  MAX_DAYS,
  addDays,
  parseReportFilter,
  pct,
  pivotCohort,
  rangeParams,
  toReportCurrency,
  todayVN,
  type CohortLine,
  type CohortRow,
  type ReportFilter,
} from "@/modules/reports/period";
import type { RevenueGroup } from "@/adapters/warehouse/reports";

describe("reports/period — pure helpers", () => {
  describe("addDays", () => {
    it.each<[string, number, string]>([
      ["2026-05-15", 0, "2026-05-15"],
      ["2026-05-15", 1, "2026-05-16"],
      ["2026-05-31", 1, "2026-06-01"],
      ["2026-12-31", 1, "2027-01-01"],
      ["2028-02-28", 1, "2028-02-29"],
      ["2028-02-29", 1, "2028-03-01"],
      ["2026-02-28", 1, "2026-03-01"],
      ["2026-05-15", -(MAX_DAYS - 1), "2025-05-15"],
      ["2026-03-01", -1, "2026-02-28"],
    ])("addDays(%s, %i) -> %s", (ymd, n, expected) => {
      expect(addDays(ymd, n)).toBe(expected);
    });
  });

  describe("todayVN", () => {
    it.each<[string, string, string]>([
      ["UTC 00:00 stays same day in VN", "2026-05-15T00:00:00Z", "2026-05-15"],
      ["UTC 16:59 is 23:59 VN (before midnight)", "2026-05-15T16:59:59Z", "2026-05-15"],
      ["UTC 17:00 is 00:00 VN (crosses midnight)", "2026-05-15T17:00:00Z", "2026-05-16"],
      ["UTC 17:00 on Dec 31 crosses year in VN", "2026-12-31T17:00:00Z", "2027-01-01"],
      ["UTC 16:59 on Feb 28 2028 stays Feb 28 in VN", "2028-02-28T16:59:00Z", "2028-02-28"],
      ["UTC 17:00 on Feb 28 2028 becomes Feb 29 in VN", "2028-02-28T17:00:00Z", "2028-02-29"],
    ])("%s (%s -> %s)", (_label, iso, expected) => {
      expect(todayVN(new Date(iso))).toBe(expected);
    });
  });

  describe("parseReportFilter", () => {
    const TODAY = "2026-05-15";

    it.each<
      [
        string,
        Record<string, string | string[] | undefined>,
        string,
        RevenueGroup | undefined,
        ReportFilter,
      ]
    >([
      [
        "defaults: first of month -> today, VND, default group market",
        {},
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "custom defaultGroup is used when group param is absent",
        {},
        TODAY,
        "brand",
        { from: "2026-05-01", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "brand" },
      ],
      [
        "invalid dates ignored and fallback to first of to-month and today",
        { from: "not-a-date", to: "2026-13-45" },
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "invalid from with valid to defaults from to first of to's month",
        { from: "2026/04/10", to: "2026-04-20" },
        TODAY,
        undefined,
        { from: "2026-04-01", to: "2026-04-20", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "from > to is swapped",
        { from: "2026-05-20", to: "2026-05-05" },
        TODAY,
        undefined,
        { from: "2026-05-05", to: "2026-05-20", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "span equal to 366 days (diff = 365) is preserved without clamping",
        { from: "2025-05-15", to: "2026-05-15" },
        TODAY,
        undefined,
        { from: "2025-05-15", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "span > 366 days (diff = 366) clamps from to to - 365 days",
        { from: "2025-05-14", to: "2026-05-15" },
        TODAY,
        undefined,
        { from: "2025-05-15", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "reversed dates with span > 366 days are swapped first then clamped",
        { from: "2026-05-15", to: "2024-01-01" },
        TODAY,
        undefined,
        { from: "2025-05-15", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "currency lower-case normalised and trimmed",
        { from: "2026-05-01", to: "2026-05-10", currency: "  usd " },
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-10", brand: null, store: null, market: null, currency: "USD", group: "market" },
      ],
      [
        "invalid currency (wrong length) falls back to VND",
        { from: "2026-05-01", to: "2026-05-10", currency: "USDT" },
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-10", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "invalid currency with digits falls back to VND",
        { from: "2026-05-01", to: "2026-05-10", currency: "12A" },
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-10", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
      [
        "invalid group falls back to defaultGroup",
        { from: "2026-05-01", to: "2026-05-10", group: "channel" },
        TODAY,
        "store",
        { from: "2026-05-01", to: "2026-05-10", brand: null, store: null, market: null, currency: "VND", group: "store" },
      ],
      [
        "valid group brand_market and dimension filters preserved",
        { from: "2026-05-02", to: "2026-05-12", brand: "  BrandA ", store: "Store1", market: "US", currency: "sgd", group: "brand_market" },
        TODAY,
        undefined,
        { from: "2026-05-02", to: "2026-05-12", brand: "BrandA", store: "Store1", market: "US", currency: "SGD", group: "brand_market" },
      ],
      [
        "array values take the first element",
        {
          from: ["2026-05-03", "2026-05-04"],
          to: ["2026-05-11", "2026-05-12"],
          brand: ["B1", "B2"],
          store: ["S1", "S2"],
          market: ["VN", "US"],
          currency: ["eur", "usd"],
          group: ["month", "brand"],
        },
        TODAY,
        undefined,
        { from: "2026-05-03", to: "2026-05-11", brand: "B1", store: "S1", market: "VN", currency: "EUR", group: "month" },
      ],
      [
        "whitespace-only optional filters become null",
        { brand: "   ", store: "", market: ["  "] },
        TODAY,
        undefined,
        { from: "2026-05-01", to: "2026-05-15", brand: null, store: null, market: null, currency: "VND", group: "market" },
      ],
    ])("%s", (_label, sp, today, defaultGroup, expected) => {
      const actual = defaultGroup
        ? parseReportFilter(sp, today, defaultGroup)
        : parseReportFilter(sp, today);
      expect(actual).toEqual(expected);
    });
  });

  describe("rangeParams", () => {
    it.each<[string, string, string, string, string]>([
      ["mid-month range: to is next day 00:00Z", "2026-05-01", "2026-05-15", "2026-05-01T00:00:00.000Z", "2026-05-16T00:00:00.000Z"],
      ["month end rolls to first day of next month 00:00Z", "2026-05-01", "2026-05-31", "2026-05-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
      ["year end rolls to Jan 1 of next year 00:00Z", "2026-12-01", "2026-12-31", "2026-12-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"],
      ["leap year 2028-02-28 rolls to 2028-02-29T00:00Z", "2028-02-01", "2028-02-28", "2028-02-01T00:00:00.000Z", "2028-02-29T00:00:00.000Z"],
      ["leap day 2028-02-29 rolls to 2028-03-01T00:00Z", "2028-02-01", "2028-02-29", "2028-02-01T00:00:00.000Z", "2028-03-01T00:00:00.000Z"],
    ])("%s", (_label, from, to, expectedFrom, expectedTo) => {
      const res = rangeParams({ from, to });
      expect(res.from.toISOString()).toBe(expectedFrom);
      expect(res.to.toISOString()).toBe(expectedTo);
    });
  });

  describe("toReportCurrency", () => {
    it.each<[string, number | null, string, number | null, number | null]>([
      ["null passthrough with USD", null, "USD", 25000, null],
      ["null passthrough with VND", null, "VND", null, null],
      ["VND passthrough ignores rate", 500000, "VND", 25000, 500000],
      ["VND passthrough with null rate", 500000, "VND", null, 500000],
      ["missing rate (null) falls back to VND amount", 250000, "USD", null, 250000],
      ["zero rate falls back to VND amount", 250000, "USD", 0, 250000],
      ["negative rate falls back to VND amount", 250000, "USD", -25000, 250000],
      ["divides VND by rateToBase for foreign currency", 250000, "USD", 25000, 10],
      ["divides 0 VND to 0", 0, "SGD", 19000, 0],
    ])("%s", (_label, vnd, currency, rate, expected) => {
      expect(toReportCurrency(vnd, currency, rate)).toBe(expected);
    });
  });

  describe("pivotCohort", () => {
    it.each<[string, CohortRow[], string, number | undefined, CohortLine[]]>([
      [
        "k = -1 carries repeat60 and months after today are null",
        [
          { cohort: "2026-03", k: -1, customers: 0, repeat60: 25 },
          { cohort: "2026-03", k: 0, customers: 100, repeat60: 0 },
          { cohort: "2026-03", k: 1, customers: 40, repeat60: 0 },
          { cohort: "2026-03", k: 2, customers: 15, repeat60: 0 },
        ],
        "2026-05-15",
        4,
        [{ cohort: "2026-03", size: 100, retention: [100, 40, 15, null], repeat60Pct: 25 }],
      ],
      [
        "size 0 gives 0% retention for elapsed months, null for future months, and null repeat60Pct",
        [
          { cohort: "2026-04", k: -1, customers: 0, repeat60: 5 },
          { cohort: "2026-04", k: 0, customers: 0, repeat60: 0 },
        ],
        "2026-05-15",
        3,
        [{ cohort: "2026-04", size: 0, retention: [0, 0, null], repeat60Pct: null }],
      ],
      [
        "sorted ascending by cohort and rounds percentages to 1 decimal",
        [
          { cohort: "2026-05", k: -1, customers: 0, repeat60: 1 },
          { cohort: "2026-05", k: 0, customers: 3, repeat60: 0 },
          { cohort: "2026-03", k: -1, customers: 0, repeat60: 2 },
          { cohort: "2026-03", k: 0, customers: 6, repeat60: 0 },
          { cohort: "2026-03", k: 1, customers: 1, repeat60: 0 },
          { cohort: "2026-03", k: 2, customers: 2, repeat60: 0 },
        ],
        "2026-05-15",
        3,
        [
          { cohort: "2026-03", size: 6, retention: [100, 16.7, 33.3], repeat60Pct: 33.3 },
          { cohort: "2026-05", size: 3, retention: [100, null, null], repeat60Pct: 33.3 },
        ],
      ],
      [
        "missing k rows in elapsed months default to 0% retention",
        [
          { cohort: "2026-02", k: 0, customers: 50, repeat60: 0 },
          { cohort: "2026-02", k: 2, customers: 10, repeat60: 0 },
        ],
        "2026-05-15",
        4,
        [{ cohort: "2026-02", size: 50, retention: [100, 0, 20, 0], repeat60Pct: 0 }],
      ],
    ])("%s", (_label, rows, today, months, expected) => {
      const actual = months !== undefined ? pivotCohort(rows, today, months) : pivotCohort(rows, today);
      expect(actual).toEqual(expected);
    });
  });

  describe("pct", () => {
    it.each<[number, number, number | null]>([
      [0, 0, null],
      [15, 0, null],
      [0, 100, 0],
      [100, 100, 100],
      [1, 3, 33.3],
      [2, 3, 66.7],
      [1, 8, 12.5],
      [5, 6, 83.3],
    ])("pct(%i, %i) -> %s", (num, den, expected) => {
      expect(pct(num, den)).toBe(expected);
    });
  });
});

// Hồi quy (Claude, sau nghi vấn của job report-tests): ngày không có thật bị bỏ, không lăn sang tháng sau.
describe("parseReportFilter — ngày không có thật", () => {
  it.each([
    ["2026-02-30", "2026-03-01"], ["2026-04-31", "2026-04-01"], ["2027-02-29", "2027-02-01"],
  ])("from=%s bị bỏ → mặc định đầu tháng của 'đến'", (bad, expected) => {
    const f = parseReportFilter({ from: bad, to: expected.slice(0, 7) + "-15" }, "2027-06-01");
    expect(f.from).toBe(expected.slice(0, 7) + "-01");
  });
  it("2028-02-29 (năm nhuận) vẫn hợp lệ", () => {
    expect(parseReportFilter({ from: "2028-02-29", to: "2028-03-05" }, "2028-06-01").from).toBe("2028-02-29");
  });
});

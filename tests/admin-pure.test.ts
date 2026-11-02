import { describe, expect, it } from "vitest";
import {
  capSchema,
  hoursSchema,
  lowStockSchema,
  routingNumbers,
  slaSchema,
} from "@/modules/admin/config";
import { auditFilter, changedKeys, type AuditFilter } from "@/modules/admin/audit";

describe("admin/config & admin/audit — pure schemas and helpers", () => {
  describe("slaSchema", () => {
    it.each<
      [
        string,
        unknown,
        { ok: true; data: unknown } | { ok: false; field: string },
      ]
    >([
      [
        "brandId empty string transforms to null and numeric strings coerce",
        { brandId: "", priority: "CAO", firstResponseHours: "1.5", resolveHours: "4" },
        { ok: true, data: { brandId: null, priority: "CAO", firstResponseHours: 1.5, resolveHours: 4 } },
      ],
      [
        "brandId whitespace-only transforms to null",
        { brandId: "   ", priority: "THAP", firstResponseHours: 2, resolveHours: 24 },
        { ok: true, data: { brandId: null, priority: "THAP", firstResponseHours: 2, resolveHours: 24 } },
      ],
      [
        "brandId omitted transforms to null and equal resolve/first hours is valid",
        { priority: "KHAN", firstResponseHours: 1, resolveHours: 1 },
        { ok: true, data: { brandId: null, priority: "KHAN", firstResponseHours: 1, resolveHours: 1 } },
      ],
      [
        "valid brandId is trimmed and max 720 hours is accepted",
        { brandId: "  brand-1 ", priority: "TRUNG", firstResponseHours: 24, resolveHours: 720 },
        { ok: true, data: { brandId: "brand-1", priority: "TRUNG", firstResponseHours: 24, resolveHours: 720 } },
      ],
      [
        "resolveHours < firstResponseHours fails on resolveHours",
        { brandId: "", priority: "CAO", firstResponseHours: 8, resolveHours: 4 },
        { ok: false, field: "resolveHours" },
      ],
      [
        "firstResponseHours = 0 is invalid",
        { brandId: "", priority: "CAO", firstResponseHours: 0, resolveHours: 4 },
        { ok: false, field: "firstResponseHours" },
      ],
      [
        "negative hours is invalid",
        { brandId: "", priority: "CAO", firstResponseHours: -2, resolveHours: 4 },
        { ok: false, field: "firstResponseHours" },
      ],
      [
        "hours > 720 is invalid",
        { brandId: "", priority: "CAO", firstResponseHours: 4, resolveHours: 720.5 },
        { ok: false, field: "resolveHours" },
      ],
      [
        "invalid priority is rejected",
        { brandId: "", priority: "URGENT", firstResponseHours: 2, resolveHours: 8 },
        { ok: false, field: "priority" },
      ],
    ])("%s", (_label, input, expected) => {
      const res = slaSchema.safeParse(input);
      expect(res.success).toBe(expected.ok);
      if (expected.ok && res.success) {
        expect(res.data).toEqual(expected.data);
      } else if (!expected.ok && !res.success) {
        expect(res.error.issues.map((i) => i.path.join("."))).toContain(expected.field);
      }
    });
  });

  describe("routingNumbers", () => {
    it.each<
      [
        string,
        unknown,
        { ok: true; data: unknown } | { ok: false; field: string },
      ]
    >([
      [
        "numeric strings are coerced",
        { firstResponseHours: "2.5", maxOpenPerUser: "30", autoCloseDays: "14", dedupeDays: "7" },
        { ok: true, data: { firstResponseHours: 2.5, maxOpenPerUser: 30, autoCloseDays: 14, dedupeDays: 7 } },
      ],
      [
        "autoCloseDays = 0 and dedupeDays = 0 are valid",
        { firstResponseHours: 1, maxOpenPerUser: 1, autoCloseDays: 0, dedupeDays: 0 },
        { ok: true, data: { firstResponseHours: 1, maxOpenPerUser: 1, autoCloseDays: 0, dedupeDays: 0 } },
      ],
      [
        "upper boundary values are valid",
        { firstResponseHours: 720, maxOpenPerUser: 500, autoCloseDays: 365, dedupeDays: 90 },
        { ok: true, data: { firstResponseHours: 720, maxOpenPerUser: 500, autoCloseDays: 365, dedupeDays: 90 } },
      ],
      [
        "maxOpenPerUser = 0 is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 0, autoCloseDays: 14, dedupeDays: 7 },
        { ok: false, field: "maxOpenPerUser" },
      ],
      [
        "maxOpenPerUser > 500 is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 501, autoCloseDays: 14, dedupeDays: 7 },
        { ok: false, field: "maxOpenPerUser" },
      ],
      [
        "autoCloseDays > 365 is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 20, autoCloseDays: 366, dedupeDays: 7 },
        { ok: false, field: "autoCloseDays" },
      ],
      [
        "negative autoCloseDays is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 20, autoCloseDays: -1, dedupeDays: 7 },
        { ok: false, field: "autoCloseDays" },
      ],
      [
        "dedupeDays > 90 is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 20, autoCloseDays: 14, dedupeDays: 91 },
        { ok: false, field: "dedupeDays" },
      ],
      [
        "decimal in integer field (maxOpenPerUser) is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 10.5, autoCloseDays: 14, dedupeDays: 7 },
        { ok: false, field: "maxOpenPerUser" },
      ],
      [
        "decimal in integer field (autoCloseDays) is invalid",
        { firstResponseHours: 2, maxOpenPerUser: 10, autoCloseDays: "3.5", dedupeDays: 7 },
        { ok: false, field: "autoCloseDays" },
      ],
    ])("%s", (_label, input, expected) => {
      const res = routingNumbers.safeParse(input);
      expect(res.success).toBe(expected.ok);
      if (expected.ok && res.success) {
        expect(res.data).toEqual(expected.data);
      } else if (!expected.ok && !res.success) {
        expect(res.error.issues.map((i) => i.path.join("."))).toContain(expected.field);
      }
    });
  });

  describe("capSchema", () => {
    it.each<
      [
        string,
        unknown,
        { ok: true; data: unknown } | { ok: false; field: string },
      ]
    >([
      [
        "valid channel with coerced numeric strings",
        { channel: "ZALO", maxCount: "3", windowDays: "7" },
        { ok: true, data: { channel: "ZALO", maxCount: 3, windowDays: 7 } },
      ],
      [
        "maxCount = 0 is valid (disables sending on channel)",
        { channel: "SMS", maxCount: 0, windowDays: 1 },
        { ok: true, data: { channel: "SMS", maxCount: 0, windowDays: 1 } },
      ],
      [
        "upper limits maxCount = 50 and windowDays = 90 are valid",
        { channel: "EMAIL", maxCount: 50, windowDays: 90 },
        { ok: true, data: { channel: "EMAIL", maxCount: 50, windowDays: 90 } },
      ],
      [
        "unknown channel is invalid",
        { channel: "TELEGRAM", maxCount: 5, windowDays: 7 },
        { ok: false, field: "channel" },
      ],
      [
        "windowDays = 0 is invalid",
        { channel: "WHATSAPP", maxCount: 5, windowDays: 0 },
        { ok: false, field: "windowDays" },
      ],
      [
        "negative maxCount is invalid",
        { channel: "EMAIL", maxCount: -1, windowDays: 7 },
        { ok: false, field: "maxCount" },
      ],
      [
        "maxCount > 50 is invalid",
        { channel: "EMAIL", maxCount: 51, windowDays: 7 },
        { ok: false, field: "maxCount" },
      ],
      [
        "windowDays > 90 is invalid",
        { channel: "EMAIL", maxCount: 5, windowDays: 91 },
        { ok: false, field: "windowDays" },
      ],
    ])("%s", (_label, input, expected) => {
      const res = capSchema.safeParse(input);
      expect(res.success).toBe(expected.ok);
      if (expected.ok && res.success) {
        expect(res.data).toEqual(expected.data);
      } else if (!expected.ok && !res.success) {
        expect(res.error.issues.map((i) => i.path.join("."))).toContain(expected.field);
      }
    });
  });

  describe("hoursSchema", () => {
    it.each<
      [
        string,
        unknown,
        { ok: true; data: unknown } | { ok: false; field: string },
      ]
    >([
      [
        "both empty strings transform to null and are valid",
        { market: "VN", from: "", to: "" },
        { ok: true, data: { market: "VN", from: null, to: null } },
      ],
      [
        "leading-zero string '08' and '20' coerce to integers",
        { market: "VN", from: "08", to: "20" },
        { ok: true, data: { market: "VN", from: 8, to: 20 } },
      ],
      [
        "exact 2-hour window at boundary 0..24 is valid",
        { market: "*", from: 0, to: 2 },
        { ok: true, data: { market: "*", from: 0, to: 2 } },
      ],
      [
        "only to empty is invalid",
        { market: "VN", from: 8, to: "" },
        { ok: false, field: "to" },
      ],
      [
        "only from empty is invalid",
        { market: "VN", from: "", to: 18 },
        { ok: false, field: "to" },
      ],
      [
        "window < 2 hours (1 hour) is invalid",
        { market: "VN", from: 8, to: 9 },
        { ok: false, field: "to" },
      ],
      [
        "reversed window (to < from) is invalid",
        { market: "VN", from: 18, to: 8 },
        { ok: false, field: "to" },
      ],
      [
        "hour = 25 is invalid",
        { market: "VN", from: 8, to: 25 },
        { ok: false, field: "to" },
      ],
      [
        "negative hour is invalid",
        { market: "VN", from: -1, to: 10 },
        { ok: false, field: "from" },
      ],
      [
        "blank market is invalid",
        { market: "   ", from: 8, to: 18 },
        { ok: false, field: "market" },
      ],
    ])("%s", (_label, input, expected) => {
      const res = hoursSchema.safeParse(input);
      expect(res.success).toBe(expected.ok);
      if (expected.ok && res.success) {
        expect(res.data).toEqual(expected.data);
      } else if (!expected.ok && !res.success) {
        expect(res.error.issues.map((i) => i.path.join("."))).toContain(expected.field);
      }
    });
  });

  describe("lowStockSchema", () => {
    it.each<
      [
        string,
        unknown,
        { ok: true; data: unknown } | { ok: false; field: string },
      ]
    >([
      [
        "empty string value transforms to null",
        { market: "VN", value: "" },
        { ok: true, data: { market: "VN", value: null } },
      ],
      [
        "null value is preserved",
        { market: "VN", value: null },
        { ok: true, data: { market: "VN", value: null } },
      ],
      [
        "coerced integer string is valid",
        { market: " * ", value: "25" },
        { ok: true, data: { market: "*", value: 25 } },
      ],
      [
        "zero value is valid",
        { market: "US", value: 0 },
        { ok: true, data: { market: "US", value: 0 } },
      ],
      [
        "max boundary 100000 is valid",
        { market: "US", value: 100_000 },
        { ok: true, data: { market: "US", value: 100_000 } },
      ],
      [
        "negative value is invalid",
        { market: "VN", value: -1 },
        { ok: false, field: "value" },
      ],
      [
        "value > 100000 is invalid",
        { market: "VN", value: 100_001 },
        { ok: false, field: "value" },
      ],
      [
        "decimal value is invalid",
        { market: "VN", value: 4.5 },
        { ok: false, field: "value" },
      ],
    ])("%s", (_label, input, expected) => {
      const res = lowStockSchema.safeParse(input);
      expect(res.success).toBe(expected.ok);
      if (expected.ok && res.success) {
        expect(res.data).toEqual(expected.data);
      } else if (!expected.ok && !res.success) {
        expect(res.error.issues.map((i) => i.path.join("."))).toContain(expected.field);
      }
    });
  });

  describe("auditFilter", () => {
    it.each<[string, unknown, AuditFilter]>([
      [
        "empty object defaults page to 1 and optional fields to undefined",
        {},
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "empty and whitespace strings become undefined",
        { actor: "", entity: "   ", entityId: "", action: "  ", from: "", to: "" },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "valid filter trims strings, keeps YYYY-MM-DD dates, and coerces page",
        { actor: " u1 ", entity: " Setting ", entityId: " k1 ", action: " update ", from: "2026-10-01", to: "2026-10-31", page: "3" },
        { actor: "u1", entity: "Setting", entityId: "k1", action: "update", from: "2026-10-01", to: "2026-10-31", page: 3 },
      ],
      [
        "bad dates are dropped to undefined",
        { from: "2026/10/01", to: "not-a-date" },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "page < 1 falls back to 1",
        { page: 0 },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "negative or non-numeric page falls back to 1",
        { page: "-5" },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "page at max 10000 is preserved",
        { page: 10000 },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 10000 },
      ],
      [
        "page > 10000 is caught and falls back to 1",
        { page: 10001 },
        { actor: undefined, entity: undefined, entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
      [
        "overlong actor (> 40 chars) is caught and becomes undefined",
        { actor: "x".repeat(41), entity: "Order" },
        { actor: undefined, entity: "Order", entityId: undefined, action: undefined, from: undefined, to: undefined, page: 1 },
      ],
    ])("%s", (_label, input, expected) => {
      const res = auditFilter.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual(expected);
      }
    });
  });

  describe("changedKeys", () => {
    it.each<[string, unknown, unknown, string[]]>([
      [
        "identical flat objects return empty array",
        { a: 1, b: "two" },
        { a: 1, b: "two" },
        [],
      ],
      [
        "top-level key order is irrelevant when values match",
        { b: 2, a: 1, c: true },
        { c: true, a: 1, b: 2 },
        [],
      ],
      [
        "changed and added/removed keys are returned sorted",
        { z: 1, a: 1, same: "ok" },
        { z: 2, b: 3, same: "ok" },
        ["a", "b", "z"],
      ],
      [
        "nested objects are compared by JSON",
        { hours: { from: 8, to: 20 }, unchanged: { x: [1, 2] } },
        { hours: { from: 9, to: 20 }, unchanged: { x: [1, 2] } },
        ["hours"],
      ],
      [
        "null before and object after returns ['(toàn bộ)']",
        null,
        { a: 1 },
        ["(toàn bộ)"],
      ],
      [
        "object before and null after returns ['(toàn bộ)']",
        { a: 1 },
        null,
        ["(toàn bộ)"],
      ],
      [
        "both null or undefined returns empty array",
        null,
        undefined,
        [],
      ],
      [
        "different arrays return ['(toàn bộ)']",
        [1, 2],
        [1, 3],
        ["(toàn bộ)"],
      ],
      [
        "identical arrays return empty array",
        [1, 2],
        [1, 2],
        [],
      ],
      [
        "missing key vs explicit null or undefined is treated as no change",
        { a: 1 },
        { a: 1, b: null, c: undefined },
        [],
      ],
    ])("%s", (_label, before, after, expected) => {
      expect(changedKeys(before, after)).toEqual(expected);
    });
  });
});

// Hồi quy cho nghi vấn job admin-tests (Claude sửa code, 02/11/2026).
describe("Phase 11.1 — hồi quy nghi vấn Gemini", () => {
  it.each([["2026-02-30", undefined], ["2026-99-99", undefined], ["2028-02-29", "2028-02-29"]])("auditFilter bỏ ngày không có thật: %s", (d, v) => {
    expect(auditFilter.parse({ from: d, to: d })).toMatchObject({ from: v, to: v });
  });
  it.each([["   ", null], [" 12 ", 12]])("ô chỉ khoảng trắng là để trống: %j", (raw, v) => {
    expect(lowStockSchema.parse({ market: "AE", value: raw }).value).toBe(v);
    expect(hoursSchema.safeParse({ market: "AE", from: raw, to: raw === "   " ? "  " : "20" }).success).toBe(true);
  });
  it("changedKeys không phụ thuộc thứ tự khóa trong object lồng nhau", () => {
    expect(changedKeys({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toEqual([]);
  });
});

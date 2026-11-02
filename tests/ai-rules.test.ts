import { describe, expect, it } from "vitest";
import { norm, parseAssistant, parseSearch, type SearchCtx, type SearchOut } from "@/adapters/llm/replay";
import { costUsd, DEFAULT_PRICES } from "@/adapters/llm/pricing";
import { redactDeep, redactText } from "@/modules/ai/redact";
import type { ToolUse } from "@/adapters/llm/interface";

const MARKETS: SearchCtx["markets"] = [
  { id: "mkt-ae", code: "AE", name: "UAE" },
  { id: "mkt-sa", code: "SA", name: "Saudi Arabia" },
  { id: "mkt-de", code: "DE", name: "Germany" },
];

const BASE_CTX: SearchCtx = {
  today: "2026-11-02",
  markets: MARKETS,
};

describe("norm", () => {
  it.each([
    ["Đơn hàng tại Đức", "don hang tai duc"],
    ["Straße München", "strasse munchen"],
    ["Khách Hàng VIP", "khach hang vip"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(norm(input)).toBe(expected);
  });
});

describe("parseSearch", () => {
  const cases: [string, string, SearchCtx, SearchOut][] = [
    [
      "target orders by keyword",
      "đơn",
      BASE_CTX,
      { target: "orders", filters: {}, explain: [] },
    ],
    [
      "target customers by default / keyword",
      "khách hàng",
      BASE_CTX,
      { target: "customers", filters: {}, explain: [] },
    ],
    [
      "fulfillment FAILED implies orders target",
      "giao thất bại",
      BASE_CTX,
      {
        target: "orders",
        filters: { fulfillment: "FAILED" },
        explain: [{ field: "fulfillment", value: "FAILED", phrase: "giao thất bại" }],
      },
    ],
    [
      "fulfillment RETURNED",
      "đơn hoàn hàng",
      BASE_CTX,
      {
        target: "orders",
        filters: { fulfillment: "RETURNED" },
        explain: [{ field: "fulfillment", value: "RETURNED", phrase: "hoàn hàng" }],
      },
    ],
    [
      "fulfillment IN_TRANSIT",
      "đơn đang giao",
      BASE_CTX,
      {
        target: "orders",
        filters: { fulfillment: "IN_TRANSIT" },
        explain: [{ field: "fulfillment", value: "IN_TRANSIT", phrase: "đang giao" }],
      },
    ],
    [
      "fulfillment DELIVERED",
      "đơn đã giao",
      BASE_CTX,
      {
        target: "orders",
        filters: { fulfillment: "DELIVERED" },
        explain: [{ field: "fulfillment", value: "DELIVERED", phrase: "đã giao" }],
      },
    ],
    [
      "fulfillment UNFULFILLED",
      "đơn chưa giao",
      BASE_CTX,
      {
        target: "orders",
        filters: { fulfillment: "UNFULFILLED" },
        explain: [{ field: "fulfillment", value: "UNFULFILLED", phrase: "chưa giao" }],
      },
    ],
    [
      "cancelled order status",
      "đơn đã hủy",
      BASE_CTX,
      {
        target: "orders",
        filters: { status: "CANCELLED" },
        explain: [{ field: "status", value: "CANCELLED", phrase: "đã hủy" }],
      },
    ],
    [
      "repeat customer filter",
      "khách mua lại",
      BASE_CTX,
      {
        target: "customers",
        filters: { repeat: "1" },
        explain: [{ field: "repeat", value: "1", phrase: "mua lại" }],
      },
    ],
    [
      "period today on orders",
      "đơn hôm nay",
      BASE_CTX,
      {
        target: "orders",
        filters: { from: "2026-11-02", to: "2026-11-02" },
        explain: [
          { field: "from", value: "2026-11-02", phrase: "hôm nay" },
          { field: "to", value: "2026-11-02", phrase: "hôm nay" },
        ],
      },
    ],
    [
      "period yesterday on orders",
      "đơn hôm qua",
      BASE_CTX,
      {
        target: "orders",
        filters: { from: "2026-11-01", to: "2026-11-01" },
        explain: [
          { field: "from", value: "2026-11-01", phrase: "hôm qua" },
          { field: "to", value: "2026-11-01", phrase: "hôm qua" },
        ],
      },
    ],
    [
      "period last_7_days on orders",
      "đơn 7 ngày qua",
      BASE_CTX,
      {
        target: "orders",
        filters: { from: "2026-10-27", to: "2026-11-02" },
        explain: [
          { field: "from", value: "2026-10-27", phrase: "7 ngày qua" },
          { field: "to", value: "2026-11-02", phrase: "7 ngày qua" },
        ],
      },
    ],
    [
      "period this_month on orders",
      "đơn tháng này",
      BASE_CTX,
      {
        target: "orders",
        filters: { from: "2026-11-01", to: "2026-11-02" },
        explain: [
          { field: "from", value: "2026-11-01", phrase: "tháng này" },
          { field: "to", value: "2026-11-02", phrase: "tháng này" },
        ],
      },
    ],
    [
      "period last_month on orders",
      "đơn tháng trước",
      BASE_CTX,
      {
        target: "orders",
        filters: { from: "2026-10-01", to: "2026-10-31" },
        explain: [
          { field: "from", value: "2026-10-01", phrase: "tháng trước" },
          { field: "to", value: "2026-10-31", phrase: "tháng trước" },
        ],
      },
    ],
    [
      "period last_month across year boundary (today 2026-01-15)",
      "đơn tháng trước",
      { today: "2026-01-15", markets: MARKETS },
      {
        target: "orders",
        filters: { from: "2025-12-01", to: "2025-12-31" },
        explain: [
          { field: "from", value: "2025-12-01", phrase: "tháng trước" },
          { field: "to", value: "2025-12-31", phrase: "tháng trước" },
        ],
      },
    ],
    [
      "period last_30_days on customers sets lastFrom/lastTo",
      "khách 30 ngày qua",
      BASE_CTX,
      {
        target: "customers",
        filters: { lastFrom: "2026-10-04", lastTo: "2026-11-02" },
        explain: [
          { field: "lastFrom", value: "2026-10-04", phrase: "30 ngày qua" },
          { field: "lastTo", value: "2026-11-02", phrase: "30 ngày qua" },
        ],
      },
    ],
    [
      "market by phrase (dubai -> AE)",
      "đơn dubai",
      BASE_CTX,
      {
        target: "orders",
        filters: { market: "mkt-ae" },
        explain: [{ field: "market", value: "mkt-ae", phrase: "dubai" }],
      },
    ],
    [
      "market by phrase (saudi -> SA)",
      "khách saudi",
      BASE_CTX,
      {
        target: "customers",
        filters: { market: "mkt-sa" },
        explain: [{ field: "market", value: "mkt-sa", phrase: "saudi" }],
      },
    ],
    [
      "market by bare code (DE)",
      "đơn DE",
      BASE_CTX,
      {
        target: "orders",
        filters: { market: "mkt-de" },
        explain: [{ field: "market", value: "mkt-de", phrase: "DE" }],
      },
    ],
    [
      "quoted customer name sets q",
      'khách "Nguyễn Văn An"',
      BASE_CTX,
      {
        target: "customers",
        filters: { q: "Nguyễn Văn An" },
        explain: [{ field: "q", value: "Nguyễn Văn An", phrase: "Nguyễn Văn An" }],
      },
    ],
    [
      "order code sets q",
      "đơn ORD-1024",
      BASE_CTX,
      {
        target: "orders",
        filters: { q: "ORD-1024" },
        explain: [{ field: "q", value: "ORD-1024", phrase: "ORD-1024" }],
      },
    ],
  ];

  it.each(cases)("%s: %s", (_label, query, ctx, expected) => {
    expect(parseSearch(query, ctx)).toEqual(expected);
  });
});

describe("parseAssistant", () => {
  const ctx = { today: "2026-11-02" };
  const cases: [string, string, ToolUse[]][] = [
    [
      "appointment with quoted customer at 10h tomorrow",
      'Đặt hẹn với "Anna Keller" lúc 10h ngày mai',
      [
        {
          name: "tao_lich_hen",
          input: {
            customer: "Anna Keller",
            at: "2026-11-03T03:00:00.000Z",
            title: "Hẹn với Anna Keller",
          },
        },
      ],
    ],
    [
      "appointment with customer after khách at 14:30 today",
      "Lịch hẹn khách Minh lúc 14:30 hôm nay",
      [
        {
          name: "tao_lich_hen",
          input: {
            customer: "Minh",
            at: "2026-11-02T07:30:00.000Z",
            title: "Hẹn với Minh",
          },
        },
      ],
    ],
    [
      "appointment without customer at 3 pm tomorrow",
      "Schedule a meeting tomorrow at 3 pm",
      [
        {
          name: "tao_lich_hen",
          input: {
            customer: null,
            at: "2026-11-03T08:00:00.000Z",
            title: "Lịch hẹn",
          },
        },
      ],
    ],
    [
      "task with customer after khách tomorrow default 09:00",
      "Nhắc tôi gọi khách Lan vào ngày mai",
      [
        {
          name: "tao_nhiem_vu",
          input: {
            customer: "Lan",
            dueAt: "2026-11-03T02:00:00.000Z",
            title: "Nhắc tôi gọi khách Lan vào ngày mai",
          },
        },
      ],
    ],
    [
      "task without customer today at 14:30",
      "Tạo việc kiểm tra kho lúc 14:30 hôm nay",
      [
        {
          name: "tao_nhiem_vu",
          input: {
            customer: null,
            dueAt: "2026-11-02T07:30:00.000Z",
            title: "Tạo việc kiểm tra kho lúc 14:30 hôm nay",
          },
        },
      ],
    ],
    [
      "report default metric REV-03 without groupBy",
      "Báo cáo doanh thu",
      [{ name: "hoi_bao_cao", input: { metric: "REV-03", groupBy: "none" } }],
    ],
    [
      "report REV-01 grouped by market",
      "Báo cáo giá trị đặt theo thị trường",
      [{ name: "hoi_bao_cao", input: { metric: "REV-01", groupBy: "market" } }],
    ],
    [
      "report REV-02 without groupBy",
      "Báo cáo doanh thu xác nhận",
      [{ name: "hoi_bao_cao", input: { metric: "REV-02", groupBy: "none" } }],
    ],
    [
      "report REV-04 grouped by market (English phrase)",
      "revenue report collected by market",
      [{ name: "hoi_bao_cao", input: { metric: "REV-04", groupBy: "market" } }],
    ],
    [
      "find order intent",
      "Tìm đơn ORD-1024",
      [{ name: "tim_don", input: { query: "Tìm đơn ORD-1024" } }],
    ],
    [
      "find customer intent with name after khách",
      "Tìm khách Nguyễn Văn An",
      [{ name: "tim_khach", input: { q: "Nguyễn Văn An" } }],
    ],
    [
      "find customer via quoted name without intent keyword",
      'Kiểm tra "Trần Thị B"',
      [{ name: "tim_khach", input: { q: "Trần Thị B" } }],
    ],
    [
      "unmatched prompt returns empty tool calls",
      "Xin chào trợ lý",
      [],
    ],
  ];

  it.each(cases)("%s", (_label, prompt, expected) => {
    expect(parseAssistant(prompt, ctx)).toEqual(expected);
  });
});

describe("redactText and redactDeep", () => {
  const cases: [string, string, { pii: boolean }, string][] = [
    [
      "redacts sk- API key",
      "Key sk-proj1234567890abcdef in log",
      { pii: true },
      "Key [đã ẩn] in log",
    ],
    [
      "redacts Bearer token",
      "Header: Bearer abcdefghijklmnop1234",
      { pii: true },
      "Header: [đã ẩn]",
    ],
    [
      "redacts password=...",
      "Config password=mySuperSecret123!",
      { pii: true },
      "Config [đã ẩn]",
    ],
    [
      "redacts connection string with user:pass",
      "DB postgres://admin:secretpass@localhost:5432/crm",
      { pii: true },
      "DB [đã ẩn]",
    ],
    [
      "redacts JWT token",
      "Token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      { pii: true },
      "Token [đã ẩn]",
    ],
    [
      "redacts 40-char hex hash/secret",
      "Commit 0123456789abcdef0123456789abcdef01234567",
      { pii: true },
      "Commit [đã ẩn]",
    ],
    [
      "keeps email and phone when pii: true",
      "Liên hệ anna.keller@mail.de hoặc +971 50 123 4567",
      { pii: true },
      "Liên hệ anna.keller@mail.de hoặc +971 50 123 4567",
    ],
    [
      "masks email and phone when pii: false",
      "Liên hệ anna.keller@mail.de hoặc +971 50 123 4567",
      { pii: false },
      "Liên hệ an•••@mail.de hoặc +971 5•••••567",
    ],
  ];

  it.each(cases)("%s", (_label, input, opts, expected) => {
    expect(redactText(input, opts)).toBe(expected);
  });

  it("redactDeep masks secrets and PII recursively in nested objects and arrays", () => {
    const input = {
      customer: "Anna Keller",
      contact: {
        email: "anna.keller@mail.de",
        phones: ["+971 50 123 4567"],
      },
      notes: ["password=topsecret", "normal note"],
      count: 3,
    };
    expect(redactDeep(input, { pii: false })).toEqual({
      customer: "Anna Keller",
      contact: {
        email: "an•••@mail.de",
        phones: ["+971 5•••••567"],
      },
      notes: ["[đã ẩn]", "normal note"],
      count: 3,
    });
  });
});

describe("costUsd", () => {
  const cases: [string, string, number, number, number][] = [
    ["replay model is always 0", "replay", 100_000, 50_000, 0],
    ["claude-sonnet-5-5 1M in + 1M out = 12", "claude-sonnet-5-5", 1_000_000, 1_000_000, 12],
    ["unknown model returns 0", "unknown-model-x", 500_000, 500_000, 0],
    ["claude-haiku-5-5 small numbers (10k in, 2k out)", "claude-haiku-5-5", 10_000, 2_000, 0.002],
    ["claude-haiku-5-5 tiny numbers (1k in, 500 out)", "claude-haiku-5-5", 1_000, 500, 0.00035],
    ["claude-opus-5-5 250k in + 50k out = 2", "claude-opus-5-5", 250_000, 50_000, 2],
  ];

  it.each(cases)("%s", (_label, model, inputTokens, outputTokens, expected) => {
    expect(costUsd(model, inputTokens, outputTokens, DEFAULT_PRICES).toNumber()).toBe(expected);
  });
});

// Hồi quy (Claude, sau nghi vấn của job ai-tests): khớp nguyên từ theo ranh giới Unicode; tên khách không bị hiểu thành ngày.
describe("parseAssistant / parseSearch — khớp nguyên từ, đa ngôn ngữ", () => {
  const ctx = { today: "2026-11-02" };
  const mk = { today: "2026-11-02", markets: [{ id: "m-ae", code: "AE", name: "UAE" }, { id: "m-de", code: "DE", name: "Đức" }] };
  it.each([
    ["khách tên Mai + hôm nay → hôm nay", 'Nhắc tôi gọi khách "Mai Anh" hôm nay lúc 15h', "tao_nhiem_vu", "Mai Anh", "2026-11-02T08:00:00.000Z"],
    ["'email' không phải 'mai'", "Nhắc tôi gửi email cho khách Omar lúc 9h hôm nay", "tao_nhiem_vu", "Omar", "2026-11-02T02:00:00.000Z"],
    ["tiếng Đức: Termin morgen um 10 uhr", "Termin mit Kunde Sara morgen um 10 uhr", "tao_lich_hen", "Sara", "2026-11-03T03:00:00.000Z"],
    ["tiếng Ả Rập: موعد غدا", "موعد مع العميل سارة غدا", "tao_lich_hen", "سارة", "2026-11-03T02:00:00.000Z"],
  ])("%s", (_n, prompt, tool, customer, at) => {
    const [call] = parseAssistant(prompt, ctx);
    expect(call.name).toBe(tool);
    expect(call.input.customer).toBe(customer);
    expect(call.input.at ?? call.input.dueAt).toBe(at);
  });
  it.each([
    ["de: fehlgeschlagene Bestellungen in Deutschland diesen Monat", "Bestellung fehlgeschlagen Deutschland diesen monat", { fulfillment: "FAILED", market: "m-de", from: "2026-11-01", to: "2026-11-02" }],
    ["ar: طلبات فشل التوصيل في الإمارات", "طلبات فشل التوصيل في الإمارات", { fulfillment: "FAILED", market: "m-ae" }],
    ["en: repeat customers (không có từ chỉ đơn → tìm khách)", "repeat customers in UAE", { repeat: "1", market: "m-ae" }],
  ])("%s", (_n, q, filters) => {
    expect(parseSearch(q, mk).filters).toEqual(filters);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  INTENT_KEYWORDS,
  band3,
  rfmSegment,
  scoreLead,
  scoreRfm,
  scoreSupport,
  scoreTxnRisk,
  type LeadInput,
  type RfmInput,
  type SupportInput,
  type TxnInput,
  type Weights,
} from "@/modules/scoring/formulas";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000);

describe("band3 boundaries", () => {
  it.each<[number, string]>([
    [0, "THAP"],
    [39, "THAP"],
    [40, "VUA"],
    [69, "VUA"],
    [70, "CAO"],
    [100, "CAO"],
  ])("band3(%i) -> %s", (score, expected) => {
    expect(band3(score)).toBe(expected);
  });
});

describe("rfmSegment segments and boundaries", () => {
  it.each<[number, number, number, string]>([
    [5, 5, 5, "CHAMPIONS"],
    [4, 4, 4, "CHAMPIONS"],
    [4, 4, 3, "TRUNG_THANH"],
    [5, 1, 5, "MOI"],
    [4, 2, 1, "MOI"],
    [2, 5, 5, "CO_NGUY_CO"],
    [2, 3, 1, "CO_NGUY_CO"],
    [1, 1, 1, "NGU_DONG"],
    [2, 2, 5, "NGU_DONG"],
    [3, 3, 3, "TRUNG_THANH"],
    [3, 5, 5, "TRUNG_THANH"],
    [3, 2, 5, "CAN_CHAM_SOC"],
    [3, 1, 1, "CAN_CHAM_SOC"],
  ])("rfmSegment(%i, %i, %i) -> %s", (r, f, m, expected) => {
    expect(rfmSegment(r, f, m)).toBe(expected);
  });
});

describe("scoreRfm", () => {
  it.each<[string, RfmInput, number | null, string, string | null, string | null]>([
    [
      "insufficient when r is null",
      { r: null, f: 3, m: 3, recencyDays: null, deliveredOrders: 2, rev03: "1.000.000" },
      null,
      "CHUA_DU_DU_LIEU",
      null,
      null,
    ],
    [
      "insufficient when f is null",
      { r: 3, f: null, m: 3, recencyDays: 10, deliveredOrders: 2, rev03: "1.000.000" },
      null,
      "CHUA_DU_DU_LIEU",
      null,
      null,
    ],
    [
      "insufficient when m is null",
      { r: 3, f: 3, m: null, recencyDays: 10, deliveredOrders: 2, rev03: "1.000.000" },
      null,
      "CHUA_DU_DU_LIEU",
      null,
      null,
    ],
    [
      "insufficient when deliveredOrders is 0",
      { r: 3, f: 3, m: 3, recencyDays: 10, deliveredOrders: 0, rev03: "0" },
      null,
      "CHUA_DU_DU_LIEU",
      null,
      null,
    ],
    [
      "valid CHAMPIONS with rev03 visible",
      { r: 5, f: 4, m: 5, recencyDays: 5, deliveredOrders: 6, rev03: "12.500.000" },
      545,
      "CHAMPIONS",
      "REV-03 12 tháng 12.500.000 VND",
      "Giữ chân: ưu đãi riêng, mời dùng sản phẩm mới",
    ],
    [
      "valid MOI with rev03 null (masked money permission)",
      { r: 4, f: 1, m: 2, recencyDays: 12, deliveredOrders: 1, rev03: null },
      412,
      "MOI",
      "REV-03 12 tháng (cần quyền xem tiền)",
      "Chăm sóc sau mua lần đầu, hướng dẫn sử dụng",
    ],
    [
      "valid CO_NGUY_CO value = r*100 + f*10 + m",
      { r: 2, f: 4, m: 3, recencyDays: 120, deliveredOrders: 4, rev03: "5.000.000" },
      243,
      "CO_NGUY_CO",
      "REV-03 12 tháng 5.000.000 VND",
      "Liên hệ lại sớm trước khi mất khách",
    ],
  ])("%s", (_label, input, expectedVal, expectedBand, expectedMEvidence, expectedAction) => {
    const res = scoreRfm(input);
    expect(res.value).toBe(expectedVal);
    expect(res.band).toBe(expectedBand);
    expect(res.suggestedAction).toBe(expectedAction);
    if (expectedVal === null) {
      expect(res.reasons).toEqual([]);
      expect(res.missingData).toEqual(["chưa có đơn giao thành công trong 12 tháng"]);
    } else {
      expect(res.missingData).toEqual([]);
      expect(res.reasons[2]?.evidence).toBe(expectedMEvidence);
    }
  });
});

describe("scoreTxnRisk", () => {
  const W = DEFAULT_WEIGHTS.TXN_RISK;

  it.each<[string, TxnInput, number | null, string, string[], string | null]>([
    [
      "confirmedOrders = 0 -> insufficient",
      { confirmedOrders: 0, failedByCustomer: 0, hasPhone: true, hasEmail: true, hasAddress: true },
      null,
      "CHUA_DU_DU_LIEU",
      ["dưới 2 đơn xác nhận"],
      null,
    ],
    [
      "confirmedOrders = 1 with missing phone and address -> insufficient with missing list",
      { confirmedOrders: 1, failedByCustomer: 1, hasPhone: false, hasEmail: true, hasAddress: false },
      null,
      "CHUA_DU_DU_LIEU",
      ["dưới 2 đơn xác nhận", "thiếu SĐT", "chưa có địa chỉ giao"],
      null,
    ],
    [
      "0% failure, full contact & address -> 0 (THAP)",
      { confirmedOrders: 4, failedByCustomer: 0, hasPhone: true, hasEmail: true, hasAddress: true },
      0,
      "THAP",
      [],
      null,
    ],
    [
      "25% failure, full contact & address -> 30 (THAP)",
      { confirmedOrders: 4, failedByCustomer: 1, hasPhone: true, hasEmail: true, hasAddress: true },
      30,
      "THAP",
      [],
      null,
    ],
    [
      "25% failure + missing email -> 30 + 8 = 38 (THAP)",
      { confirmedOrders: 4, failedByCustomer: 1, hasPhone: true, hasEmail: false, hasAddress: true },
      38,
      "THAP",
      ["thiếu email"],
      null,
    ],
    [
      "25% failure + missing phone -> 30 + 12 = 42 (VUA)",
      { confirmedOrders: 4, failedByCustomer: 1, hasPhone: false, hasEmail: true, hasAddress: true },
      42,
      "VUA",
      ["thiếu SĐT"],
      "Nhắn xác nhận địa chỉ và thời gian nhận",
    ],
    [
      "50% failure, full contact & address -> 60 (VUA)",
      { confirmedOrders: 4, failedByCustomer: 2, hasPhone: true, hasEmail: true, hasAddress: true },
      60,
      "VUA",
      [],
      "Nhắn xác nhận địa chỉ và thời gian nhận",
    ],
    [
      "50% failure + missing address -> 60 + 20 = 80 (CAO)",
      { confirmedOrders: 4, failedByCustomer: 2, hasPhone: true, hasEmail: true, hasAddress: false },
      80,
      "CAO",
      ["chưa có địa chỉ giao"],
      "Gọi xác nhận trước khi giao COD",
    ],
    [
      "100% failure (clamped at max failRate 60) + all missing -> 60 + 20 + 20 = 100 (CAO)",
      { confirmedOrders: 3, failedByCustomer: 3, hasPhone: false, hasEmail: false, hasAddress: false },
      100,
      "CAO",
      ["thiếu SĐT", "thiếu email", "chưa có địa chỉ giao"],
      "Gọi xác nhận trước khi giao COD",
    ],
    [
      "0% failure + missing phone, email, address -> 0 + 20 + 20 = 40 (VUA)",
      { confirmedOrders: 2, failedByCustomer: 0, hasPhone: false, hasEmail: false, hasAddress: false },
      40,
      "VUA",
      ["thiếu SĐT", "thiếu email", "chưa có địa chỉ giao"],
      "Nhắn xác nhận địa chỉ và thời gian nhận",
    ],
  ])("%s", (_label, input, expectedVal, expectedBand, expectedMissing, expectedAction) => {
    const res = scoreTxnRisk(input, W);
    expect(res.value).toBe(expectedVal);
    expect(res.band).toBe(expectedBand);
    expect(res.missingData).toEqual(expectedMissing);
    expect(res.suggestedAction).toBe(expectedAction);
  });
});

describe("scoreSupport", () => {
  const W = DEFAULT_WEIGHTS.SUPPORT_NEED;

  it.each<[string, SupportInput, number, string, [number, number, number], string, string, string | null]>([
    [
      "0 tickets, priority 0, wait 0h (null)",
      { openTickets: 0, maxOpenPriority: 0, oldestOpenAt: null },
      0,
      "THAP",
      [0, 0, 0],
      "không có",
      "không chờ",
      null,
    ],
    [
      "1 ticket, priority 1 (Thấp), wait 0h",
      { openTickets: 1, maxOpenPriority: 1, oldestOpenAt: NOW },
      30,
      "THAP",
      [20, 10, 0],
      "Thấp",
      "ticket mở lâu nhất 0 giờ",
      null,
    ],
    [
      "1 ticket, priority 2 (Trung bình), wait 8h",
      { openTickets: 1, maxOpenPriority: 2, oldestOpenAt: hoursAgo(8) },
      46,
      "VUA",
      [20, 20, 6],
      "Trung bình",
      "ticket mở lâu nhất 8 giờ",
      "Theo dõi ticket, cập nhật cho khách",
    ],
    [
      "1 ticket, priority 3 (Cao), wait 24h",
      { openTickets: 1, maxOpenPriority: 3, oldestOpenAt: hoursAgo(24) },
      62,
      "VUA",
      [20, 30, 12],
      "Cao",
      "ticket mở lâu nhất 24 giờ",
      "Theo dõi ticket, cập nhật cho khách",
    ],
    [
      "2 tickets, priority 3 (Cao), wait 24h",
      { openTickets: 2, maxOpenPriority: 3, oldestOpenAt: hoursAgo(24) },
      82,
      "CAO",
      [40, 30, 12],
      "Cao",
      "ticket mở lâu nhất 24 giờ",
      "Ưu tiên CSKH liên hệ trong ngày",
    ],
    [
      "3 tickets (2+), priority 4 (Khẩn), wait 48h",
      { openTickets: 3, maxOpenPriority: 4, oldestOpenAt: hoursAgo(48) },
      100,
      "CAO",
      [40, 40, 20],
      "Khẩn",
      "ticket mở lâu nhất 48 giờ",
      "Ưu tiên CSKH liên hệ trong ngày",
    ],
  ])("%s", (_label, input, expectedVal, expectedBand, expectedPts, expectedSevEv, expectedWaitEv, expectedAction) => {
    const res = scoreSupport(input, W, NOW);
    expect(res.value).toBe(expectedVal);
    expect(res.band).toBe(expectedBand);
    expect(res.reasons.map((r) => r.points)).toEqual(expectedPts);
    expect(res.reasons[1]?.evidence).toBe(expectedSevEv);
    expect(res.reasons[2]?.evidence).toBe(expectedWaitEv);
    expect(res.suggestedAction).toBe(expectedAction);
  });
});

describe("scoreLead intent keyword detection (vi, en, ar, de)", () => {
  const W = DEFAULT_WEIGHTS.SALES_PRIORITY;

  it.each<[keyof typeof INTENT_KEYWORDS, "vi" | "en" | "ar" | "de", string, string]>([
    ["price", "vi", "Sản phẩm này giá bao nhiêu?", "hỏi giá"],
    ["price", "en", "What is the price and how much does it cost?", "hỏi giá"],
    ["price", "ar", "كم سعر هذا المنتج وبكم؟", "hỏi giá"],
    ["price", "de", "Was ist der Preis und was kostet das?", "hỏi giá"],
    ["delivery", "vi", "Shop có giao hàng tận nơi không?", "hỏi giao hàng"],
    ["delivery", "en", "When can you ship and deliver to me?", "hỏi giao hàng"],
    ["delivery", "ar", "هل يوجد توصيل وشحن سريع؟", "hỏi giao hàng"],
    ["delivery", "de", "Wie schnell ist die Lieferung und der Versand?", "hỏi giao hàng"],
    ["variant", "vi", "Còn size M màu trắng và số lượng kích thước này không?", "chọn mẫu/số lượng"],
    ["variant", "en", "What colour and quantity of 10 pcs are available?", "chọn mẫu/số lượng"],
    ["variant", "ar", "ما هو مقاس ولون وكمية المنتج؟", "chọn mẫu/số lượng"],
    ["variant", "de", "Welche Größe, Farbe und Menge pro Stück gibt es?", "chọn mẫu/số lượng"],
    ["order", "vi", "Tôi muốn đặt chốt lấy luôn hôm nay", "muốn đặt/COD"],
    ["order", "en", "I want to buy and place an order with COD", "muốn đặt/COD"],
    ["order", "ar", "أريد أن أطلب واشتري مع الدفع عند الاستلام", "muốn đặt/COD"],
    ["order", "de", "Ich möchte jetzt bestellen und per Nachnahme kaufen", "muốn đặt/COD"],
  ])("intent %s (%s)", (group, _lang, text, expectedEvidence) => {
    expect(INTENT_KEYWORDS[group].test(text)).toBe(true);
    const res = scoreLead(
      {
        interest: "Serum",
        hasBudget: false,
        hasBrandMarket: false,
        stage: "MOI",
        inbound: [{ text, at: hoursAgo(1) }],
        hasNextAction: false,
      },
      W,
      NOW,
    );
    // fit: round(0.4 * 25) = 10; intent: round(0.25 * 35) = 9; engagement: round(0.6 * 25) = 15; readiness: 0 -> total 34
    expect(res.reasons[1]?.points).toBe(9);
    expect(res.reasons[1]?.evidence).toBe(expectedEvidence);
    expect(res.value).toBe(34);
    expect(res.band).toBe("THAP");
  });
});

describe("scoreLead recency, stages, readiness, max 100 and custom weights", () => {
  const W = DEFAULT_WEIGHTS.SALES_PRIORITY;

  it.each<[string, LeadInput, Weights, number | null, string, number[], string[]]>([
    [
      "insufficient when no inbound, no interest, no budget",
      {
        interest: null,
        hasBudget: false,
        hasBrandMarket: false,
        stage: "MOI",
        inbound: [],
        hasNextAction: false,
      },
      W,
      null,
      "CHUA_DU_DU_LIEU",
      [],
      ["chưa có tin nhắn của khách", "chưa ghi sản phẩm quan tâm", "chưa có ngân sách"],
    ],
    [
      "recency 1h (<=24h -> 0.6), stage MOI, full fit, hasBudget readiness",
      {
        interest: "Kem dưỡng",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "MOI",
        inbound: [{ text: "Xin chào shop", at: hoursAgo(1) }],
        hasNextAction: false,
      },
      W,
      44,
      "VUA",
      [25, 0, 15, 4],
      [],
    ],
    [
      "recency 48h (<=72h -> 0.4), stage MOI",
      {
        interest: "Kem dưỡng",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "MOI",
        inbound: [{ text: "Xin chào shop", at: hoursAgo(48) }],
        hasNextAction: false,
      },
      W,
      39,
      "THAP",
      [25, 0, 10, 4],
      [],
    ],
    [
      "recency 5 days (120h <=168h -> 0.2), stage MOI",
      {
        interest: "Kem dưỡng",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "MOI",
        inbound: [{ text: "Xin chào shop", at: hoursAgo(120) }],
        hasNextAction: false,
      },
      W,
      34,
      "THAP",
      [25, 0, 5, 4],
      [],
    ],
    [
      "recency 10 days (240h >168h -> 0), stage MOI",
      {
        interest: "Kem dưỡng",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "MOI",
        inbound: [{ text: "Xin chào shop", at: hoursAgo(240) }],
        hasNextAction: false,
      },
      W,
      29,
      "THAP",
      [25, 0, 0, 4],
      [],
    ],
    [
      "stage DANG_TU_VAN adds 0.2 progress + readiness with budget & nextAction (0.5 -> 8 pts)",
      {
        interest: "Kem dưỡng",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "DANG_TU_VAN",
        inbound: [{ text: "Tư vấn giúp mình", at: hoursAgo(48) }],
        hasNextAction: true,
      },
      W,
      48,
      "VUA",
      [25, 0, 15, 8],
      [],
    ],
    [
      "stage CHO_QUYET_DINH boosts intent floor to 0.75 (26 pts), progress 0.4, readiness 0.5 (8 pts)",
      {
        interest: "Kem dưỡng",
        hasBudget: false,
        hasBrandMarket: false,
        stage: "CHO_QUYET_DINH",
        inbound: [{ text: "Để mình suy nghĩ thêm", at: hoursAgo(48) }],
        hasNextAction: false,
      },
      W,
      64,
      "VUA",
      [10, 26, 20, 8],
      ["chưa có ngân sách"],
    ],
    [
      "total max 100 with default weights when all 4 intent groups hit + CHO_QUYET_DINH + 1h recency",
      {
        interest: "Combo",
        hasBudget: true,
        hasBrandMarket: true,
        stage: "CHO_QUYET_DINH",
        inbound: [{ text: "Giá bao nhiêu, giao hàng size M, tôi chốt đặt luôn", at: hoursAgo(1) }],
        hasNextAction: true,
      },
      W,
      100,
      "CAO",
      [25, 35, 25, 15],
      [],
    ],
    [
      "custom weights scale component points proportionally",
      {
        interest: "Serum",
        hasBudget: true,
        hasBrandMarket: false,
        stage: "DANG_TU_VAN",
        inbound: [{ text: "Báo giá và phí giao hàng giúp mình", at: hoursAgo(1) }],
        hasNextAction: true,
      },
      { fit: 40, intent: 20, engagement: 20, readiness: 20 },
      64,
      "VUA",
      [28, 10, 16, 10],
      [],
    ],
    [
      "no inbound messages but has interest & nextAction -> scored with Infinity hours (recency 0)",
      {
        interest: "Kem chống nắng",
        hasBudget: false,
        hasBrandMarket: false,
        stage: "MOI",
        inbound: [],
        hasNextAction: true,
      },
      W,
      14,
      "THAP",
      [10, 0, 0, 4],
      ["chưa có tin nhắn của khách", "chưa có ngân sách"],
    ],
  ])("%s", (_label, input, weights, expectedVal, expectedBand, expectedPts, expectedMissing) => {
    const res = scoreLead(input, weights, NOW);
    expect(res.value).toBe(expectedVal);
    expect(res.band).toBe(expectedBand);
    expect(res.reasons.map((r) => r.points)).toEqual(expectedPts);
    expect(res.missingData).toEqual(expectedMissing);
  });
});

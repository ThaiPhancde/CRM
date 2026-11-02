import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FAILURE_REASONS,
  FAILURE_REASON_CODES,
   normalizeReason,
  reasonLabel,
  type FailureReason,
} from "@/modules/fulfillment/reasons";
import {
  MAX_ROWS,
  PasteError,
  parseAmount,
  parseDay,
  parseSettlementPaste,
  type PasteRow,
} from "@/modules/fulfillment/paste";
import {
  addDec,
  codSteps,
  type CodLine,
  type CodShipment,
  type CodStep,
} from "@/modules/fulfillment/milestones";

describe("fulfillment/reasons — pure helpers", () => {
  describe("CUSTOMER_FAILURE_REASONS & reasonLabel", () => {
    it("CUSTOMER_FAILURE_REASONS equals exactly customer_refused, unreachable, wrong_address", () => {
      expect(CUSTOMER_FAILURE_REASONS).toEqual(["customer_refused", "unreachable", "wrong_address"]);
      expect(FAILURE_REASON_CODES).toContain("other");
    });

    it.each<[string | null | undefined, string]>([
      [null, "Không rõ lý do"],
      [undefined, "Không rõ lý do"],
      ["", "Không rõ lý do"],
      ["customer_refused", "Khách từ chối nhận"],
      ["unreachable", "Không liên lạc được"],
      ["wrong_address", "Sai địa chỉ"],
      ["carrier_delay", "Hãng vận chuyển chậm"],
      ["damaged", "Hàng hư hỏng"],
      ["lost", "Thất lạc"],
      ["returned_item", "Khách trả hàng"],
      ["other", "Lý do khác"],
      ["custom_carrier_code", "custom_carrier_code"],
    ])("reasonLabel(%j) -> %s", (input, expected) => {
      expect(reasonLabel(input)).toBe(expected);
    });
  });

  describe("normalizeReason", () => {
    it.each<[string | null | undefined, FailureReason | null]>([
      // null / empty / whitespace
      [null, null],
      [undefined, null],
      ["", null],
      ["   \t\n  ", null],
      // canonical codes kept
      ["customer_refused", "customer_refused"],
      ["unreachable", "unreachable"],
      ["wrong_address", "wrong_address"],
      ["carrier_delay", "carrier_delay"],
      ["damaged", "damaged"],
      ["lost", "lost"],
      ["returned_item", "returned_item"],
      ["other", "other"],
      // upper-case and underscore variants
      ["CUSTOMER_REFUSED", "customer_refused"],
      ["WRONG_ADDRESS", "wrong_address"],
      ["UNREACHABLE", "unreachable"],
      ["CARRIER_DELAY", "carrier_delay"],
      ["RETURNED_ITEM", "returned_item"],
      ["DAMAGED", "damaged"],
      ["LOST", "lost"],
      ["OTHER", "other"],
      // wrong_address: en / vi (diacritics + folded) / ar / fr / de
      ["Recipient moved - wrong address provided", "wrong_address"],
      ["Giao thất bại do sai địa chỉ nhận hàng", "wrong_address"],
      ["Khong tim thay dia chi cua khach", "wrong_address"],
      ["عنوان خاطئ للعميل", "wrong_address"],
      ["Colis non livré : adresse incorrecte", "wrong_address"],
      ["Empfänger unter falsche Adresse", "wrong_address"],
      // unreachable: en / vi (diacritics + folded) / ar / fr / de
      ["Customer not available, phone off", "unreachable"],
      ["Gọi nhiều lần không liên lạc được", "unreachable"],
      ["Khach khong nghe may, thue bao", "unreachable"],
      ["لا يرد على الهاتف", "unreachable"],
      ["Destinataire injoignable", "unreachable"],
      ["Kunde nicht erreichbar", "unreachable"],
      // customer_refused: en / vi (diacritics + folded) / ar / fr / de
      ["Recipient refused COD parcel", "customer_refused"],
      ["Khách từ chối nhận hàng tại cửa", "customer_refused"],
      ["Khach huy don khong nhan hang", "customer_refused"],
      ["رفض العميل استلام الشحنة", "customer_refused"],
      ["Colis refusé par le client", "customer_refused"],
      ["Annahme verweigert", "customer_refused"],
      // damaged: en / vi (diacritics + folded) / ar / fr / de
      ["Outer box damaged in transit", "damaged"],
      ["Kiện hàng bị hư hỏng nặng", "damaged"],
      ["Hang bi vo khi van chuyen", "damaged"],
      ["الطرد تالف", "damaged"],
      ["Colis endommagé", "damaged"],
      ["Paket beschädigt", "damaged"],
      // lost: en / vi (diacritics + folded) / ar / fr / de
      ["Missing parcel at sorting hub", "lost"],
      ["Kiện hàng bị thất lạc", "lost"],
      ["Mat hang tai kho trung chuyen", "lost"],
      ["الشحنة مفقود", "lost"],
      ["Colis perdu en transit", "lost"],
      ["Sendung verloren", "lost"],
      // carrier_delay: en / vi (diacritics + folded) / ar / fr / de
      ["Delivery delayed due to bad weather", "carrier_delay"],
      ["Giao chậm do quá tải tuyến", "carrier_delay"],
      ["Hang giao tre 2 ngay", "carrier_delay"],
      ["تأخير في التوصيل", "carrier_delay"],
      ["Livraison en retard", "carrier_delay"],
      ["Lieferung verspätet", "carrier_delay"],
      // returned_item: en / vi (diacritics + folded) / ar / fr / de
      ["Processed as returned item", "returned_item"],
      ["Khách trả hàng sau khi mở hộp", "returned_item"],
      ["Khach yeu cau tra hang", "returned_item"],
      ["مرتجع من العميل", "returned_item"],
      ["Retour client validé", "returned_item"],
      ["Rücksendung durch Kunden", "returned_item"],
      // priority: "wrong address" wins over generic delay/refused words
      ["Wrong address caused delivery delay and customer refused", "wrong_address"],
      ["Sai địa chỉ nên giao trễ và khách từ chối", "wrong_address"],
      // unknown text -> "other"
      ["Held at customs inspection", "other"],
      ["Chưa rõ nguyên nhân hoàn", "other"],
    ])("normalizeReason(%j) -> %j", (raw, expected) => {
      expect(normalizeReason(raw)).toBe(expected);
    });
  });
});

describe("fulfillment/paste — pure helpers", () => {
  describe("parseAmount", () => {
    it.each<[string | undefined, string | null]>([
      ["163", "163"],
      ["160,00", "160.00"],
      ["1,234.50", "1234.50"],
      ["1.234,50", "1234.50"],
      ["1 234,5", "1234.5"],
      ["13.200", "13.200"],
      ["AED 99", "99"],
      ["99.50 SAR", "99.50"],
      ["007", "7"],
      ["0", "0"],
      ["1,234", "1234"],
      ["-5", null],
      ["abc", null],
      ["", null],
      [undefined, null],
      ["1.2.3", null],
    ])("parseAmount(%j) -> %j", (input, expected) => {
      expect(parseAmount(input)).toBe(expected);
    });
  });

  describe("parseDay", () => {
    it.each<[string | undefined, string | null]>([
      ["15/05/2026", "2026-05-15T00:00:00.000Z"],
      ["5/6/2026", "2026-06-05T00:00:00.000Z"],
      ["2026-05-15", "2026-05-15T00:00:00.000Z"],
      ["15/05/2026 14:30", "2026-05-15T14:30:00.000Z"],
      ["15/05/2026 14:30:45", "2026-05-15T14:30:00.000Z"],
      ["2026-05-15 09:05", "2026-05-15T09:05:00.000Z"],
      ["2026-05-15T18:45:00.000Z", "2026-05-15T18:45:00.000Z"],
      ["29/02/2028", "2028-02-29T00:00:00.000Z"],
      ["2028-02-29", "2028-02-29T00:00:00.000Z"],
      ["29/02/2026", null],
      ["31/04/2026", null],
      ["15/05/2026 25:00", null],
      ["2026-05-15 12:60", null],
      ["garbage", null],
      ["", null],
      [undefined, null],
    ])("parseDay(%j) -> %j", (input, expectedIso) => {
      const actual = parseDay(input);
      expect(actual ? actual.toISOString() : null).toBe(expectedIso);
    });
  });

  describe("parseSettlementPaste", () => {
    it.each<[string, string, PasteRow[]]>([
      [
        "tab separator with Vietnamese headers and blank lines skipped while keeping source rowNo",
        "Mã vận đơn\tSố tiền\tNgày về\tTiền tệ\nAWB-001\t163\t15/05/2026\tAED\n\n   \nAWB-002\t13.200\t16/05/2026\tKWD",
        [
          { rowNo: 2, raw: { tracking: "AWB-001", amount: "163", date: "15/05/2026", currency: "AED" } },
          { rowNo: 5, raw: { tracking: "AWB-002", amount: "13.200", date: "16/05/2026", currency: "KWD" } },
        ],
      ],
      [
        "comma separator with BOM stripped and English/alias headers (AWB, cod_amount, remitted_at)",
        "\uFEFFAWB,ma_don,cod_amount,remitted_at,currency\nTRK-10,ORD-10,250.50,2026-05-20,SAR",
        [
          { rowNo: 2, raw: { tracking: "TRK-10", order: "ORD-10", amount: "250.50", date: "2026-05-20", currency: "SAR" } },
        ],
      ],
      [
        "order column accepted when tracking column is absent",
        "Số đơn\tTiền về\tNgày đối soát\nSO-99\t500\t20/05/2026",
        [
          { rowNo: 2, raw: { order: "SO-99", amount: "500", date: "20/05/2026" } },
        ],
      ],
    ])("%s", (_label, text, expected) => {
      expect(parseSettlementPaste(text)).toEqual(expected);
    });

    it.each<[string, string]>([
      ["empty input", "   \n  "],
      ["missing required amount column", "Mã vận đơn\tNgày về\nAWB-1\t15/05/2026"],
      ["missing tracking and order columns", "Số tiền\tNgày về\n100\t15/05/2026"],
      ["header only (no data rows)", "Mã vận đơn,Số tiền,Ngày về\n   \n"],
      [
        `${MAX_ROWS + 1} data rows exceeds limit`,
        ["AWB,amount,date", ...Array.from({ length: MAX_ROWS + 1 }, (_, i) => `AWB-${i},10,2026-05-15`)].join("\n"),
      ],
    ])("throws PasteError on %s", (_label, badText) => {
      expect(() => parseSettlementPaste(badText)).toThrow(PasteError);
    });
  });
});

describe("fulfillment/milestones — pure helpers", () => {
  describe("addDec", () => {
    it.each<[string[], string]>([
      [["160.00", "0"], "160"],
      [["10.1234", "0.0006"], "10.124"],
      [["1.0001", "2.0002", "3.0003"], "6.0006"],
      [["100.50", "-20.25"], "80.25"],
      [["-10.5", "-0.25"], "-10.75"],
      [["50", "-120.1250"], "-70.125"],
      [[], "0"],
    ])("addDec(%j) -> %s", (xs, expected) => {
      expect(addDec(xs)).toBe(expected);
    });
  });

  describe("codSteps", () => {
    const BASE_ORDER = {
      bookedAt: "2026-05-01T08:00:00.000Z",
      netAmount: "300.00",
      status: "CONFIRMED",
    };

    it.each<
      [
        string,
        { bookedAt: Date | string; netAmount: string; status: string },
        CodShipment[],
        CodLine[],
        CodStep[] | null,
      ]
    >([
      [
        "non-COD order (no shipment has codAmount) -> null",
        BASE_ORDER,
        [{ trackingNo: "AWB-PREPAID", status: "DELIVERED", codAmount: null, deliveredAt: "2026-05-03T10:00:00.000Z", collectedAt: null }],
        [],
        null,
      ],
      [
        "booked only (COD shipment in transit)",
        BASE_ORDER,
        [{ trackingNo: "AWB-1", status: "IN_TRANSIT", codAmount: "300.00", deliveredAt: null, collectedAt: null }],
        [],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "done", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: undefined },
          { key: "delivered", label: "Giao thành công", metric: "REV-03", state: "pending", at: null, amount: null, note: undefined },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "pending", at: null, amount: null },
          { key: "remitted", label: "Đã về (đối soát)", metric: "CASH-02 · REV-04", state: "pending", at: null, amount: null, note: undefined },
        ],
      ],
      [
        "delivered + collected, awaiting settlement",
        BASE_ORDER,
        [
          {
            trackingNo: "AWB-1",
            status: "DELIVERED",
            codAmount: "300.00",
            deliveredAt: "2026-05-04T12:00:00.000Z",
            collectedAt: "2026-05-04T12:05:00.000Z",
          },
        ],
        [],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "done", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: undefined },
          { key: "delivered", label: "Giao thành công", metric: "REV-03", state: "done", at: "2026-05-04T12:00:00.000Z", amount: null, note: undefined },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "done", at: "2026-05-04T12:05:00.000Z", amount: "300" },
          { key: "remitted", label: "Đã về (đối soát)", metric: "CASH-02 · REV-04", state: "pending", at: null, amount: null, note: undefined },
        ],
      ],
      [
        "remitted with reference note",
        BASE_ORDER,
        [
          {
            trackingNo: "AWB-1",
            status: "DELIVERED",
            codAmount: "300.00",
            deliveredAt: "2026-05-04T12:00:00.000Z",
            collectedAt: "2026-05-04T12:05:00.000Z",
          },
        ],
        [{ trackingNo: "AWB-1", amount: "300.00", remittedAt: "2026-05-07T09:00:00.000Z", reference: "COD-2026-05A" }],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "done", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: undefined },
          { key: "delivered", label: "Giao thành công", metric: "REV-03", state: "done", at: "2026-05-04T12:00:00.000Z", amount: null, note: undefined },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "done", at: "2026-05-04T12:05:00.000Z", amount: "300" },
          {
            key: "remitted",
            label: "Đã về (đối soát)",
            metric: "CASH-02 · REV-04",
            state: "done",
            at: "2026-05-07T09:00:00.000Z",
            amount: "300",
            note: "Bảng COD-2026-05A",
          },
        ],
      ],
      [
        "partial (2 COD shipments, 1 delivered & collected -> partial)",
        BASE_ORDER,
        [
          {
            trackingNo: "AWB-1",
            status: "DELIVERED",
            codAmount: "180.50",
            deliveredAt: "2026-05-04T12:00:00.000Z",
            collectedAt: "2026-05-04T12:05:00.000Z",
          },
          {
            trackingNo: "AWB-2",
            status: "IN_TRANSIT",
            codAmount: "119.50",
            deliveredAt: null,
            collectedAt: null,
          },
        ],
        [{ trackingNo: "AWB-1", amount: "180.50", remittedAt: "2026-05-07T09:00:00.000Z", reference: "COD-2026-05A" }],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "done", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: undefined },
          { key: "delivered", label: "Giao thành công", metric: "REV-03", state: "partial", at: "2026-05-04T12:00:00.000Z", amount: null, note: undefined },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "partial", at: "2026-05-04T12:05:00.000Z", amount: "180.5" },
          {
            key: "remitted",
            label: "Đã về (đối soát)",
            metric: "CASH-02 · REV-04",
            state: "partial",
            at: "2026-05-07T09:00:00.000Z",
            amount: "180.5",
            note: "Bảng COD-2026-05A",
          },
        ],
      ],
      [
        "failed shipment -> delivered failed and collected/remitted skipped",
        BASE_ORDER,
        [{ trackingNo: "AWB-FAIL", status: "FAILED", codAmount: "300.00", deliveredAt: null, collectedAt: null }],
        [],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "done", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: undefined },
          {
            key: "delivered",
            label: "Giao thành công",
            metric: "REV-03",
            state: "failed",
            at: null,
            amount: null,
            note: "Giao thất bại / hoàn — không có mốc thu và về tiền",
          },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "skipped", at: null, amount: null },
          { key: "remitted", label: "Đã về (đối soát)", metric: "CASH-02 · REV-04", state: "skipped", at: null, amount: null, note: undefined },
        ],
      ],
      [
        "cancelled order -> booked failed and subsequent steps skipped",
        { ...BASE_ORDER, status: "CANCELLED" },
        [{ trackingNo: "AWB-CANC", status: "CANCELLED", codAmount: "300.00", deliveredAt: null, collectedAt: null }],
        [],
        [
          { key: "booked", label: "Đặt", metric: "REV-01", state: "failed", at: "2026-05-01T08:00:00.000Z", amount: "300.00", note: "Đơn đã hủy" },
          { key: "delivered", label: "Giao thành công", metric: "REV-03", state: "skipped", at: null, amount: null, note: undefined },
          { key: "collected", label: "Đã thu COD", metric: "CASH-01", state: "skipped", at: null, amount: null },
          { key: "remitted", label: "Đã về (đối soát)", metric: "CASH-02 · REV-04", state: "skipped", at: null, amount: null, note: undefined },
        ],
      ],
    ])("%s", (_label, order, shipments, lines, expected) => {
      expect(codSteps(order, shipments, lines)).toEqual(expected);
    });
  });
});

// Hồi quy cho 4 nghi vấn job p10-tests nêu (Claude sửa code, 02/11/2026).
describe("Phase 10 — hồi quy nghi vấn Gemini", () => {
  it("codSteps đếm vận đơn đã về, không đếm số dòng đối soát", () => {
    const sh = (tn: string) => ({ trackingNo: tn, status: "DELIVERED", codAmount: "50", deliveredAt: "2026-10-03T00:00:00Z", collectedAt: "2026-10-03T00:00:00Z" });
    const ln = (tn: string) => ({ trackingNo: tn, amount: "50", remittedAt: "2026-10-10T00:00:00Z", reference: "R" });
    const o = { bookedAt: "2026-10-01T00:00:00Z", netAmount: "100", status: "CONFIRMED" };
    expect(codSteps(o, [sh("A"), sh("B")], [ln("A"), ln("A")])![3].state).toBe("partial"); // B chưa về dù có 2 dòng
    expect(codSteps(o, [sh("A")], [ln("A"), ln("A")])![3].state).toBe("done");
  });
  it.each([
    ["15/05/2026 14:30:99", null], ["2026-05-15 14:30:60", null], ["2026-05-15T14:30:59Z", "2026-05-15T14:30:00.000Z"],
  ])("parseDay giây không hợp lệ: %s", (s, iso) => expect(parseDay(s)?.toISOString() ?? null).toBe(iso));
  it.each([["12,34,56", null], ["1,234,567", "1234567"]])("parseAmount nhóm nghìn: %s", (s, v) => expect(parseAmount(s)).toBe(v));
  it("rowNo giữ đúng số dòng gốc khi có dòng trống trước tiêu đề", () => {
    expect(parseSettlementPaste("\n\nma_van_don\tso_tien\tngay_ve\nA1\t10\t01/10/2026").map((r) => r.rowNo)).toEqual([4]);
  });
});

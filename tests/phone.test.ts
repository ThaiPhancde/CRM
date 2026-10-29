import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  supportedPhoneCountries,
  type Phone,
} from "@/lib/phone";

describe("normalizePhone", () => {
  it("lists all 7 supported countries", () => {
    expect(supportedPhoneCountries).toEqual(["VN", "US", "DE", "FR", "AE", "SA", "KW"]);
  });

  const vnCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["VN international with +", "+84901234567", undefined, { e164: "+84901234567", country: "VN" }],
    ["VN international with 00", "0084901234567", null, { e164: "+84901234567", country: "VN" }],
    ["VN national mobile with trunk 0", "0901234567", "VN", { e164: "+84901234567", country: "VN" }],
    ["VN national 10-digit significant (landline)", "02812345678", "VN", { e164: "+842812345678", country: "VN" }],
    ["VN digits with country code and no +", "84901234567", "VN", { e164: "+84901234567", country: "VN" }],
    ["VN formatted with spaces, dashes, brackets", "(090) 123-4567", "vn", { e164: "+84901234567", country: "VN" }],
    ["VN international with redundant trunk 0", "+84 090 123 4567", "VN", { e164: "+84901234567", country: "VN" }],
    ["VN too short returns null", "09012345", "VN", null],
    ["VN too long returns null", "090123456789", "VN", null],
  ];

  const usCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["US international with +", "+12025550125", undefined, { e164: "+12025550125", country: "US" }],
    ["US international with 00", "0012025550125", undefined, { e164: "+12025550125", country: "US" }],
    ["US national with trunk 1", "1-202-555-0125", "US", { e164: "+12025550125", country: "US" }],
    ["US national 10 digits without trunk", "2025550125", "US", { e164: "+12025550125", country: "US" }],
    ["US digits with country code 1 and no +", "12025550125", "US", { e164: "+12025550125", country: "US" }],
    ["US formatted with brackets, spaces, dashes", "(202) 555-0125", "us", { e164: "+12025550125", country: "US" }],
    ["US too short returns null", "202555012", "US", null],
    ["US too long returns null", "120255501259", "US", null],
  ];

  const deCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["DE international with +", "+4915123456789", undefined, { e164: "+4915123456789", country: "DE" }],
    ["DE international with 00", "00493012345678", undefined, { e164: "+493012345678", country: "DE" }],
    ["DE international with redundant trunk 0", "+49 (0) 151 23456789", undefined, { e164: "+4915123456789", country: "DE" }],
    ["DE national with trunk 0", "015123456789", "DE", { e164: "+4915123456789", country: "DE" }],
    ["DE short 6-digit national number", "0301234", "DE", { e164: "+49301234", country: "DE" }],
    ["DE digits with country code and no +", "4915123456789", "DE", { e164: "+4915123456789", country: "DE" }],
    ["DE formatted with spaces and dashes", "030 1234-5678", "DE", { e164: "+493012345678", country: "DE" }],
    ["DE too short (5 digits after trunk) returns null", "012345", "DE", null],
    ["DE too long (12 digits after trunk) returns null", "0151234567890", "DE", null],
  ];

  const frCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["FR international with +", "+33612345678", undefined, { e164: "+33612345678", country: "FR" }],
    ["FR international with 00", "0033612345678", undefined, { e164: "+33612345678", country: "FR" }],
    ["FR national with trunk 0", "0612345678", "FR", { e164: "+33612345678", country: "FR" }],
    ["FR digits with country code and no +", "33612345678", "FR", { e164: "+33612345678", country: "FR" }],
    ["FR formatted with spaces and dots", "06.12.34.56.78", "FR", { e164: "+33612345678", country: "FR" }],
    ["FR international with trunk 0 in brackets", "+33 (0)6 12 34 56 78", "FR", { e164: "+33612345678", country: "FR" }],
    ["FR too short returns null", "061234567", "FR", null],
    ["FR too long returns null", "06123456789", "FR", null],
  ];

  const aeCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["AE international with +", "+971501234567", undefined, { e164: "+971501234567", country: "AE" }],
    ["AE international with 00", "00971501234567", undefined, { e164: "+971501234567", country: "AE" }],
    ["AE national mobile (9 digits) with trunk 0", "0501234567", "AE", { e164: "+971501234567", country: "AE" }],
    ["AE national landline (8 digits) with trunk 0", "041234567", "AE", { e164: "+97141234567", country: "AE" }],
    ["AE digits with country code and no +", "971501234567", "AE", { e164: "+971501234567", country: "AE" }],
    ["AE formatted with spaces and dashes", "(050) 123-4567", "AE", { e164: "+971501234567", country: "AE" }],
    ["AE too short returns null", "05012345", "AE", null],
    ["AE too long returns null", "05012345678", "AE", null],
  ];

  const saCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["SA international with +", "+966501234567", undefined, { e164: "+966501234567", country: "SA" }],
    ["SA international with 00", "00966501234567", undefined, { e164: "+966501234567", country: "SA" }],
    ["SA national mobile (9 digits) with trunk 0", "0501234567", "SA", { e164: "+966501234567", country: "SA" }],
    ["SA national landline (8 digits) with trunk 0", "011234567", "SA", { e164: "+96611234567", country: "SA" }],
    ["SA digits with country code and no +", "966501234567", "SA", { e164: "+966501234567", country: "SA" }],
    ["SA formatted with spaces and dashes", "050-123 4567", "SA", { e164: "+966501234567", country: "SA" }],
    ["SA too short returns null", "05012345", "SA", null],
    ["SA too long returns null", "05012345678", "SA", null],
  ];

  const kwCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["KW international with +", "+96550123456", undefined, { e164: "+96550123456", country: "KW" }],
    ["KW international with 00", "0096550123456", undefined, { e164: "+96550123456", country: "KW" }],
    ["KW national 8 digits (no trunk prefix)", "50123456", "KW", { e164: "+96550123456", country: "KW" }],
    ["KW digits with country code and no +", "96550123456", "KW", { e164: "+96550123456", country: "KW" }],
    ["KW formatted with spaces, dashes, brackets", "(5012) - 3456", "KW", { e164: "+96550123456", country: "KW" }],
    ["KW leading 0 is not stripped (no trunk rule) so 9 digits returns null", "050123456", "KW", null],
    ["KW too short returns null", "5012345", "KW", null],
    ["KW too long returns null", "501234567", "KW", null],
  ];

  const edgeCases: Array<[string, string | null | undefined, string | null | undefined, Phone | null]> = [
    ["empty string returns null", "", "VN", null],
    ["whitespace only returns null", "   ", "US", null],
    ["null input returns null", null, "DE", null],
    ["undefined input returns null", undefined, "FR", null],
    ["non-digit punctuation only returns null", "+()- .", "AE", null],
    ["unknown default country returns null", "0901234567", "JP", null],
    ["missing default country on national number returns null", "0901234567", undefined, null],
    ["unknown international country code returns null", "+819012345678", "VN", null],
  ];

  it.each([
    ...vnCases,
    ...usCases,
    ...deCases,
    ...frCases,
    ...aeCases,
    ...saCases,
    ...kwCases,
    ...edgeCases,
  ])("%s: normalizePhone(%j, %j) -> %j", (_label, input, defaultCountry, expected) => {
    expect(normalizePhone(input, defaultCountry)).toEqual(expected);
  });
});

describe("maskPhone", () => {
  it.each<Array<[string, string | null | undefined, string | null]>[number]>([
    ["UAE E.164 phone keeps cc, first digit, last 3 digits", "+971501234567", "+971 5•••••567"],
    ["VN E.164 phone", "+84901234567", "+84 9•••••567"],
    ["US E.164 phone", "+12025550125", "+1 2••••••125"],
    ["KW E.164 phone", "+96550123456", "+965 5••••456"],
    ["phone without + masks without country prefix", "0901234567", "0••••••567"],
    ["short national part (<= 4 digits) masks all remaining digits", "+841234", "+84 ••••"],
    ["very short raw digits", "123", "•••"],
    ["null or empty returns null", null, null],
    ["empty string returns null", "", null],
  ])("%s: maskPhone(%j) -> %j", (_label, input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });
});

describe("maskEmail", () => {
  it.each<Array<[string, string | null | undefined, string | null]>[number]>([
    ["standard email keeps first 2 chars of local part and domain", "anna.keller@mail.de", "an•••@mail.de"],
    ["single-char local part keeps 1 char", "a@example.com", "a•••@example.com"],
    ["two-char local part keeps 2 chars", "ab@domain.vn", "ab•••@domain.vn"],
    ["string without @ returns three dots", "not-an-email", "•••"],
    ["string ending with @ (empty domain) returns three dots", "user@", "•••"],
    ["null returns null", null, null],
    ["undefined returns null", undefined, null],
    ["empty string returns null", "", null],
  ])("%s: maskEmail(%j) -> %j", (_label, input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});

describe("normalizeEmail", () => {
  it.each<Array<[string, string | null | undefined, string | null]>[number]>([
    ["trims and lowercases valid email", "  Anna.Keller@Mail.DE ", "anna.keller@mail.de"],
    ["keeps valid email with plus tag", "Customer+VIP@LevelUp.com", "customer+vip@levelup.com"],
    ["rejects string without @", "not-an-email", null],
    ["rejects string without domain dot", "user@localhost", null],
    ["rejects email with spaces", "user name@mail.com", null],
    ["empty string returns null", "", null],
    ["null returns null", null, null],
    ["undefined returns null", undefined, null],
  ])("%s: normalizeEmail(%j) -> %j", (_label, input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});

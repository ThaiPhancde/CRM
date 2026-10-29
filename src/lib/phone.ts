// Chuẩn hóa SĐT về E.164 (HLD §6.1, D-08) cho các quốc gia trong phạm vi demo.
// ponytail: bảng quy tắc theo quốc gia (mã vùng, độ dài số quốc gia, tiền tố trung kế) thay vì libphonenumber — đủ cho
// 7 thị trường hiện có; thêm thị trường mới = thêm một dòng vào RULES. Không kiểm loại số (di động/cố định) hay số có thật.

type Rule = { cc: string; lengths: number[]; trunk?: string };

const RULES: Record<string, Rule> = {
  VN: { cc: "84", lengths: [9, 10], trunk: "0" },
  US: { cc: "1", lengths: [10], trunk: "1" },
  DE: { cc: "49", lengths: [6, 7, 8, 9, 10, 11], trunk: "0" },
  FR: { cc: "33", lengths: [9], trunk: "0" },
  AE: { cc: "971", lengths: [8, 9], trunk: "0" },
  SA: { cc: "966", lengths: [8, 9], trunk: "0" },
  KW: { cc: "965", lengths: [8] },
};

// Mã vùng dài thử trước để "+1…" không nuốt nhầm.
const BY_CC = Object.entries(RULES).sort((a, b) => b[1].cc.length - a[1].cc.length);

export type Phone = { e164: string; country: string };

function fit(country: string, national: string): Phone | null {
  const r = RULES[country];
  // Số quốc gia của các nước trong bảng không bắt đầu bằng tiền tố trung kế → có tiền tố thì luôn bỏ.
  let n = national;
  if (r.trunk && n.startsWith(r.trunk)) n = n.slice(r.trunk.length);
  return r.lengths.includes(n.length) ? { e164: `+${r.cc}${n}`, country } : null;
}

/**
 * Trả E.164 hoặc null nếu không chắc chắn (không đoán). `defaultCountry` dùng cho số không có mã quốc gia,
 * thường lấy từ quốc gia giao hàng của đơn.
 */
export function normalizePhone(input: string | null | undefined, defaultCountry?: string | null): Phone | null {
  if (!input) return null;
  const trimmed = input.trim();
  const intl = trimmed.startsWith("+") || trimmed.replace(/[\s().-]/g, "").startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (intl) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    for (const [country, r] of BY_CC) {
      if (!digits.startsWith(r.cc)) continue;
      const rest = digits.slice(r.cc.length);
      // "+49 0151…" (thừa số 0 trung kế sau mã vùng) vẫn gặp trong dữ liệu nhập tay.
      const p = fit(country, rest);
      if (p) return p;
    }
    return null;
  }
  const dc = defaultCountry?.toUpperCase();
  if (!dc || !RULES[dc]) return null;
  const r = RULES[dc];
  // Số viết liền mã vùng nhưng thiếu "+", ví dụ "971501234567".
  if (digits.startsWith(r.cc) && !(r.trunk && digits.startsWith(r.trunk)) && r.lengths.includes(digits.length - r.cc.length)) {
    return { e164: `+${digits}`, country: dc };
  }
  return fit(dc, digits);
}

export const supportedPhoneCountries = Object.keys(RULES);

/** "+971501234567" → "+971 5•••••567": giữ mã vùng, chữ số đầu và 3 số cuối (docs/permissions.md mục 3). */
export function maskPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  const cc = BY_CC.find(([, r]) => p.startsWith("+") && digits.startsWith(r.cc))?.[1].cc ?? "";
  const rest = digits.slice(cc.length);
  if (rest.length <= 4) return `${cc ? `+${cc} ` : ""}${"•".repeat(rest.length)}`;
  return `${cc ? `+${cc} ` : ""}${rest[0]}${"•".repeat(rest.length - 4)}${rest.slice(-3)}`;
}

/** "anna.keller@mail.de" → "an•••@mail.de" */
export function maskEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const [local, domain] = e.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 2)}•••@${domain}`;
}

export const normalizeEmail = (e: string | null | undefined) => {
  const s = e?.trim().toLowerCase();
  return s && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
};

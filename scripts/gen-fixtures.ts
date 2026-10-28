// Sinh dữ liệu phát lại 12 tháng cho 5 shop mẫu (D-18). Tất định: cùng hạt + cùng ngày kết thúc → cùng dữ liệu.
// Dữ liệu HƯ CẤU. Định dạng bản ghi theo mapper src/adapters/connectors/{pancake,shopify}.ts (Pancake là định dạng giả định — CXM).
// Kịch bản gài sẵn (để demo và kiểm thử trên dữ liệu lớn): gửi lặp, bản cũ đến muộn, giao/hoàn một phần, COD thu tiền,
// đơn Shopify được Pancake xử lý (có mã tham chiếu → tự liên kết), và vài đơn nghi trùng không có mã (→ hàng đợi xác minh).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Catalog = { products: { code: string; brand: string; name_vi: string; name_en: string; variants: { sku: string; prices: Record<string, string> }[] }[] };
type Ev = { visibleAt: string; record: unknown };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES: Record<string, { first: string[]; last: string[]; cc: string; len: number }> = {
  AE: { first: ["Ahmed", "Fatima", "Omar", "Mariam", "Khalid", "Aisha", "Yousef", "Noura", "Hamdan", "Layla"], last: ["Al Mansoori", "Al Hashimi", "Al Nuaimi", "Al Suwaidi", "Al Mazrouei", "Haddad"], cc: "+971", len: 9 },
  SA: { first: ["Abdullah", "Sara", "Faisal", "Reem", "Turki", "Hessa", "Saud", "Lama", "Nasser", "Dana"], last: ["Al Qahtani", "Al Otaibi", "Al Ghamdi", "Al Harbi", "Al Shehri", "Al Dosari"], cc: "+966", len: 9 },
  KW: { first: ["Bader", "Shaikha", "Mishal", "Dalal", "Fahad", "Haya", "Talal", "Maryam"], last: ["Al Sabah", "Al Mutairi", "Al Ajmi", "Al Rashidi", "Al Kandari"], cc: "+965", len: 8 },
  US: { first: ["Emily", "Jacob", "Olivia", "Michael", "Sophia", "Daniel", "Ava", "Ethan", "Mia", "Noah"], last: ["Johnson", "Miller", "Davis", "Garcia", "Wilson", "Moore", "Taylor", "Clark"], cc: "+1", len: 10 },
  DE: { first: ["Anna", "Lukas", "Lea", "Jonas", "Mia", "Felix", "Hannah", "Paul", "Lena", "Max"], last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann"], cc: "+49", len: 10 },
  FR: { first: ["Camille", "Louis", "Chloé", "Hugo", "Manon", "Lucas", "Léa", "Jules", "Inès", "Arthur"], last: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand"], cc: "+33", len: 9 },
};
const CURRENCY: Record<string, string> = { AE: "AED", SA: "SAR", KW: "KWD", US: "USD", DE: "EUR", FR: "EUR" };
const SHIP_FEE: Record<string, string> = { AED: "15.00", SAR: "15.00", KWD: "1.500", USD: "6.95", EUR: "4.90" };
const CARRIER: Record<string, string> = { AE: "Aramex", SA: "SMSA", KW: "Aramex", US: "UPS", DE: "DHL", FR: "Colissimo" };

type Customer = { id: string; name: string; phone: string; email: string | null; country: string };

type StorePlan = { code: string; platform: "pancake" | "shopify"; brand: string; markets: [string, number][]; orders: number; cod: boolean; prefix: string };

export const STORES: StorePlan[] = [
  { code: "LUMI-PK-AE", platform: "pancake", brand: "LUMI", markets: [["AE", 1]], orders: 500, cod: true, prefix: "LAE" },
  { code: "LUMI-PK-SA", platform: "pancake", brand: "LUMI", markets: [["SA", 0.75], ["KW", 0.25]], orders: 450, cod: true, prefix: "LSA" },
  { code: "NOVA-SH-US", platform: "shopify", brand: "NOVA", markets: [["US", 1]], orders: 400, cod: false, prefix: "" },
  { code: "ORBI-SH-EU", platform: "shopify", brand: "ORBI", markets: [["DE", 0.6], ["FR", 0.4]], orders: 400, cod: false, prefix: "" },
  { code: "ORBI-PK-DE", platform: "pancake", brand: "ORBI", markets: [["DE", 1]], orders: 210, cod: false, prefix: "ODE" },
];

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString();
const round = (n: number, cur: string) => n.toFixed(cur === "KWD" ? 3 : 2);

type Line = { sku: string; name: string; qty: number; price: string; delivered: number; returned: number };
type Version = { t: number; stage: "new" | "confirmed" | "shipping" | "delivered" | "failed" | "returned" | "cancelled"; lines: Line[]; events: { status: string; at: number; reason?: string }[]; refunded?: string };

/** Vòng đời một đơn → danh sách phiên bản (mỗi phiên bản là một lần nguồn cập nhật). */
function lifecycle(r: () => number, t0: number, lines: Omit<Line, "delivered" | "returned">[], cod: boolean, end: number): Version[] {
  const base = lines.map((l) => ({ ...l, delivered: 0, returned: 0 }));
  const out: Version[] = [{ t: t0, stage: "new", lines: base, events: [] }];
  const tc = t0 + (1 + r() * 20) * 3600000;
  if (tc > end) return out;
  if (r() < (cod ? 0.1 : 0.03)) return [...out, { t: tc, stage: "cancelled", lines: base, events: [] }];
  out.push({ t: tc, stage: "confirmed", lines: base, events: [] });
  const ts = tc + (0.5 + r() * 2) * DAY;
  if (ts > end) return out;
  const shipEvents = [{ status: "picked", at: ts }, { status: "in_transit", at: ts + 0.4 * DAY }];
  out.push({ t: ts + 0.4 * DAY, stage: "shipping", lines: base, events: shipEvents });
  const td = ts + (1.5 + r() * 4) * DAY;
  if (td > end) return out;
  const fail = r() < (cod ? 0.22 : 0.06);
  if (fail) {
    const reason = ["customer_refused", "unreachable", "wrong_address", "carrier_delay"][Math.floor(r() * 4)];
    const failed = { t: td, stage: "failed" as const, lines: base, events: [...shipEvents, { status: "failed", at: td, reason }] };
    out.push(failed);
    const tr = td + (2 + r() * 5) * DAY;
    if (tr <= end) out.push({ t: tr, stage: "returned", lines: base, events: [...failed.events, { status: "returned", at: tr }] });
    return out;
  }
  // Giao một phần: đơn nhiều dòng, 8% chỉ giao được dòng đầu.
  const partial = base.length > 1 && r() < 0.08;
  const delivered = base.map((l, i) => ({ ...l, delivered: partial && i > 0 ? 0 : l.qty }));
  const evs = [...shipEvents, { status: "delivering", at: td - 0.2 * DAY }, { status: "delivered", at: td }];
  if (cod) evs.push({ status: "cod_collected", at: td + 0.1 * DAY });
  out.push({ t: td + (cod ? 0.1 * DAY : 0), stage: "delivered", lines: delivered, events: evs });
  // Trả lại sau khi giao (một phần): 5%.
  const tret = td + (5 + r() * 10) * DAY;
  if (tret <= end && r() < 0.05) {
    const ret = delivered.map((l, i) => ({ ...l, returned: i === 0 && l.delivered > 0 ? 1 : 0 }));
    const refunded = ret[0].price;
    out.push({ t: tret, stage: "delivered", lines: ret, events: evs, refunded });
  }
  return out;
}

const PK_STATUS: Record<Version["stage"], number> = { new: 0, confirmed: 1, shipping: 2, delivered: 3, returned: 4, cancelled: 5, failed: 6 };

function pancakeRecord(id: string, code: string, cust: Customer, currency: string, cod: boolean, t0: number, v: Version, note: string | null, carrier: string) {
  const goods = v.lines.reduce((s, l) => s + Number(l.price) * l.qty, 0);
  const total = round(goods + Number(SHIP_FEE[currency]), currency);
  return {
    id, order_code: code, status: PK_STATUS[v.stage], inserted_at: iso(t0), updated_at: iso(v.t),
    confirmed_at: v.stage === "new" || v.stage === "cancelled" ? null : iso(t0 + 3600000), currency, is_cod: cod,
    customer: { id: cust.id, name: cust.name, phone_number: cust.phone, email: cust.email },
    shipping_address: { country_code: cust.country },
    items: v.lines.map((l) => ({ sku: l.sku, name: l.name, quantity: l.qty, price: l.price, delivered_quantity: l.delivered, returned_quantity: l.returned })),
    total_discount: "0", shipping_fee: SHIP_FEE[currency], cod_amount: cod ? total : null,
    payments: !cod && v.stage !== "new" && v.stage !== "cancelled" ? [{ method: "bank_transfer", amount: total, paid_at: iso(t0 + 3600000) }] : [],
    refunds: v.refunded ? [{ amount: v.refunded, at: iso(v.t), reason: "returned_item" }] : [],
    partner: v.events.length ? { name: carrier, tracking_code: `${carrier.slice(0, 3).toUpperCase()}${id.replace(/\D/g, "").padStart(8, "0")}`, events: v.events.map((e) => ({ status: e.status, at: iso(e.at), reason: e.reason ?? null })) } : null,
    note,
  };
}

const SH_EVENT: Record<string, string | null> = { picked: "CONFIRMED", in_transit: "IN_TRANSIT", delivering: "OUT_FOR_DELIVERY", delivered: "DELIVERED", failed: "FAILURE", returned: null, cod_collected: null };

function shopifyRecord(n: number, cust: Customer, currency: string, t0: number, v: Version, carrier: string) {
  const [first, ...rest] = cust.name.split(" ");
  const goods = v.lines.reduce((s, l) => s + Number(l.price) * l.qty, 0);
  const total = round(goods + Number(SHIP_FEE[currency]), currency);
  const cancelled = v.stage === "cancelled";
  const events = v.events.map((e) => ({ status: SH_EVENT[e.status], happenedAt: iso(e.at) })).filter((e) => e.status) as { status: string; happenedAt: string }[];
  return {
    id: `gid://shopify/Order/${5000000 + n}`, name: `#${1000 + n}`, createdAt: iso(t0), updatedAt: iso(v.t), processedAt: iso(t0 + 60000),
    cancelledAt: cancelled ? iso(v.t) : null,
    displayFinancialStatus: v.refunded ? "PARTIALLY_REFUNDED" : cancelled ? "REFUNDED" : "PAID",
    displayFulfillmentStatus: v.stage === "delivered" ? "FULFILLED" : v.events.length ? "IN_PROGRESS" : "UNFULFILLED",
    currencyCode: currency,
    customer: { id: `gid://shopify/Customer/${cust.id}`, firstName: first, lastName: rest.join(" "), email: cust.email, phone: cust.phone },
    shippingAddress: { countryCodeV2: cust.country },
    lineItems: v.lines.map((l) => ({ sku: l.sku, title: l.name, quantity: l.qty, originalUnitPrice: l.price, fulfilledQuantity: l.delivered, returnedQuantity: l.returned })),
    totalDiscounts: "0", totalShipping: SHIP_FEE[currency], tags: [], note: null,
    transactions: [{ kind: "SALE", status: "SUCCESS", gateway: "shopify_payments", amount: total, processedAt: iso(t0 + 60000) }],
    refunds: [...(cancelled ? [{ createdAt: iso(v.t), totalRefunded: total, note: "cancelled" }] : []), ...(v.refunded ? [{ createdAt: iso(v.t), totalRefunded: v.refunded, note: "returned_item" }] : [])],
    fulfillments: events.length ? [{ trackingCompany: carrier, trackingNumber: `1Z${String(n).padStart(10, "0")}`, events }] : [],
  };
}

export function generate(outDir: string, end = Date.parse("2026-10-28T00:00:00Z"), seed = 20261028) {
  const r = rng(seed);
  const catalog = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "catalog.json"), "utf8")) as Catalog;
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const start = end - 365 * DAY;

  // Khách theo quốc gia; một phần khách mua nhiều lần (phân phối lệch).
  const customers: Record<string, Customer[]> = {};
  let cid = 0;
  for (const [cc, count] of [["AE", 120], ["SA", 90], ["KW", 30], ["US", 80], ["DE", 70], ["FR", 40]] as [string, number][]) {
    const n = NAMES[cc];
    customers[cc] = Array.from({ length: count }, () => {
      cid++;
      const name = `${pick(n.first)} ${pick(n.last)}`;
      const digits = Array.from({ length: n.len }, (_, i) => (i === 0 ? 5 + Math.floor(r() * 4) : Math.floor(r() * 10))).join("");
      return { id: `C${cid}`, name, phone: `${n.cc} ${digits}`, email: cc === "AE" || cc === "SA" || cc === "KW" ? (r() < 0.3 ? `${name.split(" ")[0].toLowerCase()}${cid}@mail.invalid` : null) : `${name.split(" ")[0].toLowerCase()}.${cid}@mail.invalid`, country: cc };
    });
  }
  const buyer = (cc: string) => {
    const list = customers[cc];
    return list[Math.floor(Math.pow(r(), 2.2) * list.length)]; // khách đầu danh sách mua nhiều hơn
  };

  const files: Record<string, Ev[]> = Object.fromEntries(STORES.map((s) => [s.code, []]));
  const push = (store: string, visible: number, record: unknown) => {
    if (visible <= end) files[store].push({ visibleAt: iso(visible), record });
  };
  /** Đẩy các phiên bản; 2% gửi lặp (cùng phiên bản thấy lại sau), 2% bản cũ đến muộn (sau phiên bản mới hơn). */
  const emit = (store: string, versions: Version[], toRecord: (v: Version) => unknown) => {
    versions.forEach((v, i) => {
      const lag = r() * 5 * 60000;
      const next = versions[i + 1];
      // Đến muộn: phiên bản này chỉ tới SAU phiên bản mới hơn (không gửi đúng lúc) → phải bị bỏ qua (STALE).
      if (i > 0 && next && r() < 0.03) {
        push(store, next.t + (30 + r() * 120) * 60000, toRecord(v));
        return;
      }
      push(store, v.t + lag, toRecord(v));
      if (r() < 0.02) push(store, v.t + lag + (1 + r() * 30) * 60000, toRecord(v)); // gửi lặp → DUPLICATE
    });
  };

  const lineFor = (brand: string, currency: string) => {
    const prods = catalog.products.filter((p) => p.brand === brand);
    const n = r() < 0.7 ? 1 : r() < 0.7 ? 2 : 3;
    const seen = new Set<string>();
    const out: Omit<Line, "delivered" | "returned">[] = [];
    while (out.length < n) {
      const p = pick(prods);
      const v = pick(p.variants);
      if (seen.has(v.sku)) continue;
      seen.add(v.sku);
      out.push({ sku: v.sku, name: p.name_en, qty: r() < 0.8 ? 1 : 2, price: v.prices[currency] });
    }
    return out;
  };

  const shopifyEu: { n: number; cust: Customer; currency: string; t0: number; lines: Omit<Line, "delivered" | "returned">[] }[] = [];

  for (const s of STORES) {
    for (let i = 1; i <= s.orders; i++) {
      const roll = r();
      let acc = 0;
      const cc = s.markets.find(([, w]) => (acc += w) >= roll)?.[0] ?? s.markets[0][0];
      const currency = CURRENCY[cc];
      // Mùa vụ: cuối năm và Ramadan (tháng 3) đông hơn.
      let t0 = start + r() * 365 * DAY;
      const m = new Date(t0).getUTCMonth();
      if ((m === 2 || m >= 10) && r() < 0.3) t0 = start + r() * 365 * DAY;
      const cust = buyer(cc);
      const lines = lineFor(s.brand, currency);
      const versions = lifecycle(r, t0, lines, s.cod, end);
      if (s.platform === "pancake") {
        const id = `${s.prefix}-${i}`;
        emit(s.code, versions, (v) => pancakeRecord(id, `${s.prefix}${String(i).padStart(5, "0")}`, cust, currency, s.cod, t0, v, null, CARRIER[cc]));
      } else {
        const n = s.code === "NOVA-SH-US" ? i : 5000 + i;
        emit(s.code, versions, (v) => shopifyRecord(n, cust, currency, t0, v, CARRIER[cc]));
        if (s.code === "ORBI-SH-EU" && cc === "DE") shopifyEu.push({ n, cust, currency, t0, lines });
      }
    }
  }

  // Đơn Shopify (Orbi, Đức) được Pancake xử lý: Pancake tạo đơn sau 3–20 phút, ghi chú có mã Shopify → tự liên kết.
  shopifyEu.slice(0, 40).forEach((o, k) => {
    const t0 = o.t0 + (3 + r() * 17) * 60000;
    const versions = lifecycle(r, t0, o.lines, false, end);
    const id = `ODE-S${k + 1}`;
    emit("ORBI-PK-DE", versions, (v) => pancakeRecord(id, `ODES${String(k + 1).padStart(4, "0")}`, o.cust, o.currency, false, t0, v, `Đơn từ Shopify #${1000 + o.n}`, "DHL"));
  });
  // Nghi trùng: cùng khách, cùng hàng, cách vài phút nhưng không có mã tham chiếu → hàng đợi xác minh.
  shopifyEu.slice(40, 43).forEach((o, k) => {
    const t0 = o.t0 + (4 + k * 3) * 60000;
    const versions = lifecycle(r, t0, o.lines, false, end).slice(0, 2);
    const id = `ODE-Q${k + 1}`;
    emit("ORBI-PK-DE", versions, (v) => pancakeRecord(id, `ODEQ${k + 1}`, o.cust, o.currency, false, t0, v, null, "DHL"));
  });

  mkdirSync(outDir, { recursive: true });
  const summary: Record<string, number> = {};
  for (const [code, evs] of Object.entries(files)) {
    evs.sort((a, b) => a.visibleAt.localeCompare(b.visibleAt));
    writeFileSync(path.join(outDir, `${code}.json`), JSON.stringify(evs));
    summary[code] = evs.length;
  }
  return summary;
}

if (process.argv[1]?.endsWith("gen-fixtures.ts")) {
  console.log(generate(path.join(process.cwd(), "fixtures", "replay")));
}

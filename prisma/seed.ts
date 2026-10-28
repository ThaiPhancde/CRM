// Seed danh mục + người mẫu cho demo (D-18). Dữ liệu HƯ CẤU, không phản ánh team thật dùng nền tảng nào (D-28).
// Idempotent: chỉ tạo cái chưa có, không ghi đè chỉnh sửa trên giao diện. Chạy: npm run db:seed
import { PaymentMode, PrismaClient, type Role } from "@prisma/client";

const db = new PrismaClient();

const MARKETS: Record<string, { name: string; currency: string; paymentMode: PaymentMode; timezone: string; locale: string }> = {
  US: { name: "Hoa Kỳ", currency: "USD", paymentMode: "PREPAID", timezone: "America/New_York", locale: "en-US" },
  DE: { name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" },
  FR: { name: "Pháp", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Paris", locale: "fr-FR" },
  AE: { name: "UAE", currency: "AED", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" },
  SA: { name: "Saudi Arabia", currency: "SAR", paymentMode: "COD", timezone: "Asia/Riyadh", locale: "ar-SA" },
  KW: { name: "Kuwait", currency: "KWD", paymentMode: "COD", timezone: "Asia/Kuwait", locale: "ar-KW" },
};

// Tỷ giá demo cố định (D-09), sửa được ở Danh mục. 1 đơn vị = rateToUsd USD.
const FX: Record<string, string> = { USD: "1", EUR: "1.08", AED: "0.27229", SAR: "0.26667", KWD: "3.25" };
const FX_DATE = new Date("2026-01-01");

const WORKSPACES = [
  {
    code: "PIALPHA",
    name: "Team PiAlpha",
    markets: ["AE", "SA", "KW", "US"],
    teams: [{ code: "SALES-ME", name: "Sales Trung Đông" }, { code: "MKT", name: "Marketing" }],
    brands: [
      { code: "LUMI", name: "Lumi Home", stores: [
        { code: "LUMI-PK-AE", name: "Lumi UAE", platform: "pancake", markets: ["AE"] },
        { code: "LUMI-PK-SA", name: "Lumi KSA", platform: "pancake", markets: ["SA", "KW"] },
      ] },
      { code: "NOVA", name: "Nova Beauty", stores: [
        { code: "NOVA-SH-US", name: "Nova US Store", platform: "shopify", markets: ["US"] },
      ] },
    ],
  },
  {
    code: "TEAM-EU",
    name: "Team EU",
    markets: ["DE", "FR", "US"],
    teams: [{ code: "SALES-EU", name: "Sales châu Âu" }],
    brands: [
      { code: "ORBI", name: "Orbi Living", stores: [
        { code: "ORBI-SH-EU", name: "Orbi EU Store", platform: "shopify", markets: ["DE", "FR"] },
        { code: "ORBI-PK-DE", name: "Orbi Đức", platform: "pancake", markets: ["DE"] },
      ] },
    ],
  },
];

// Một người mỗi vai trò (docs/permissions.md mục 5). Email domain .invalid để không bao giờ gửi được thật.
const USERS: { email: string; name: string; isCompanyAdmin?: boolean; memberships: { ws: string; roles: Role[]; team?: string }[] }[] = [
  { email: "admin@demo.invalid", name: "Quản trị công ty", isCompanyAdmin: true, memberships: [] },
  { email: "quanly@demo.invalid", name: "Trần Quản Lý", memberships: [{ ws: "PIALPHA", roles: ["MANAGER"] }, { ws: "TEAM-EU", roles: ["MANAGER"] }] },
  { email: "truongnhom@demo.invalid", name: "Lê Trưởng Nhóm", memberships: [{ ws: "PIALPHA", roles: ["SALES_LEAD"], team: "SALES-ME" }] },
  { email: "sales@demo.invalid", name: "Phạm Sales", memberships: [{ ws: "PIALPHA", roles: ["SALES"], team: "SALES-ME" }] },
  { email: "marketing@demo.invalid", name: "Đỗ Marketing", memberships: [{ ws: "PIALPHA", roles: ["MARKETING"], team: "MKT" }] },
  { email: "vandon@demo.invalid", name: "Vũ Vận Đơn", memberships: [{ ws: "PIALPHA", roles: ["FULFILLMENT"] }] },
  { email: "muahang@demo.invalid", name: "Hoàng Mua Hàng", memberships: [{ ws: "PIALPHA", roles: ["PURCHASING_VIEW"] }] },
  { email: "ketoan@demo.invalid", name: "Ngô Kế Toán", memberships: [{ ws: "PIALPHA", roles: ["FINANCE_VIEW"] }, { ws: "TEAM-EU", roles: ["FINANCE_VIEW"] }] },
  { email: "sales.eu@demo.invalid", name: "Bùi Sales EU", memberships: [{ ws: "TEAM-EU", roles: ["SALES"], team: "SALES-EU" }] },
];

async function main() {
  const wsIds: Record<string, string> = {};
  const teamIds: Record<string, string> = {};
  for (const w of WORKSPACES) {
    const ws = await db.workspace.upsert({ where: { code: w.code }, update: {}, create: { code: w.code, name: w.name } });
    wsIds[w.code] = ws.id;
    const marketIds: Record<string, string> = {};
    for (const code of w.markets) {
      const m = await db.market.upsert({
        where: { workspaceId_code: { workspaceId: ws.id, code } },
        update: {},
        create: { workspaceId: ws.id, code, ...MARKETS[code] },
      });
      marketIds[code] = m.id;
    }
    for (const currency of new Set(w.markets.map((c) => MARKETS[c].currency).concat("USD"))) {
      await db.fxRate.upsert({
        where: { workspaceId_currency_validFrom: { workspaceId: ws.id, currency, validFrom: FX_DATE } },
        update: {},
        create: { workspaceId: ws.id, currency, rateToUsd: FX[currency], validFrom: FX_DATE },
      });
    }
    for (const t of w.teams) {
      const team = await db.team.upsert({ where: { workspaceId_code: { workspaceId: ws.id, code: t.code } }, update: {}, create: { workspaceId: ws.id, ...t } });
      teamIds[`${w.code}/${t.code}`] = team.id;
    }
    for (const b of w.brands) {
      const brand = await db.brand.upsert({
        where: { workspaceId_code: { workspaceId: ws.id, code: b.code } },
        update: {},
        create: { workspaceId: ws.id, code: b.code, name: b.name },
      });
      for (const s of b.stores) {
        await db.store.upsert({
          where: { workspaceId_code: { workspaceId: ws.id, code: s.code } },
          update: {},
          create: {
            workspaceId: ws.id, brandId: brand.id, code: s.code, name: s.name, platform: s.platform,
            markets: { connect: s.markets.map((c) => ({ id: marketIds[c] })) },
          },
        });
      }
    }
  }
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, isCompanyAdmin: u.isCompanyAdmin ?? false },
    });
    for (const m of u.memberships) {
      await db.membership.upsert({
        where: { workspaceId_userId: { workspaceId: wsIds[m.ws], userId: user.id } },
        update: {},
        create: { workspaceId: wsIds[m.ws], userId: user.id, roles: m.roles, teamId: m.team ? teamIds[`${m.ws}/${m.team}`] : null },
      });
    }
  }
  const counts = await Promise.all([db.workspace.count(), db.market.count(), db.store.count(), db.user.count(), db.membership.count()]);
  console.log(`seed xong: workspace=${counts[0]} market=${counts[1]} store=${counts[2]} user=${counts[3]} membership=${counts[4]}`);
}

main().finally(() => db.$disconnect());

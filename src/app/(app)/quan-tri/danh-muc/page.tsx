import { pageUser } from "@/lib/current-user";
import { getCatalog } from "@/modules/admin/service";
import { CatalogView, type Tab } from "./view";

const TABS: Tab[] = ["brand", "store", "market", "team", "fxRate"];

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await pageUser("admin.settings");
  const { tab } = await searchParams;
  const c = await getCatalog(user);
  return (
    <CatalogView
      tab={TABS.includes(tab as Tab) ? (tab as Tab) : "brand"}
      brands={c.brands.map((b) => ({ id: b.id, code: b.code, name: b.name, active: b.active, stores: b._count.stores }))}
      stores={c.stores.map((s) => ({ id: s.id, code: s.code, name: s.name, active: s.active, platform: s.platform, externalId: s.externalId, brandId: s.brandId, brandName: s.brand.name, marketIds: s.markets.map((m) => m.id), marketCodes: s.markets.map((m) => m.code) }))}
      markets={c.markets.map((m) => ({ id: m.id, code: m.code, name: m.name, active: m.active, currency: m.currency, paymentMode: m.paymentMode, timezone: m.timezone, locale: m.locale }))}
      teams={c.teams.map((t) => ({ id: t.id, code: t.code, name: t.name, active: t.active, members: t._count.members }))}
      fxRates={c.fxRates.map((r) => ({ id: r.id, currency: r.currency, rateToUsd: r.rateToUsd.toString(), validFrom: r.validFrom.toISOString().slice(0, 10) }))}
    />
  );
}

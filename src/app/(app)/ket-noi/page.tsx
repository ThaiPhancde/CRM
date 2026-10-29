import { pageUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { listConnections } from "@/modules/connectors/service";
import { ConnectionsView } from "./view";

export default async function ConnectionsPage() {
  const user = await pageUser("integration.view");
  const data = await listConnections(user);
  return (
    <ConnectionsView
      canManage={can(user.roles, "integration.manage")}
      stores={data.storesWithoutConnection.map((s) => ({ value: s.id, label: `${s.name} (${s.platform})` }))}
      connections={data.connections.map((c) => ({
        id: c.id,
        store: c.store.name,
        brand: c.store.brand.name,
        markets: c.store.markets.map((m) => m.code),
        platform: c.platform,
        platformLabel: c.platformInfo?.label ?? c.platform,
        verification: c.platformInfo?.verification ?? null,
        mode: c.mode,
        status: c.status,
        pollIntervalMin: c.pollIntervalMin,
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        lastError: c.lastError,
        links: c._count.links,
        errorEvents: c.errorEvents,
        runs: c.runs.map((r) => ({ id: r.id, mode: r.mode, status: r.status, startedAt: r.startedAt.toISOString(), applied: r.applied, linked: r.linked, stale: r.stale, notOwner: r.notOwner, duplicate: r.duplicate, errors: r.errors, reviews: r.reviews, error: r.error })),
      }))}
    />
  );
}

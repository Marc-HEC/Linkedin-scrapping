import { getIntegrationsStatusAction } from "./actions";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await getIntegrationsStatusAction();

  const byProvider = Object.fromEntries(
    integrations.map((i) => [i.provider, i])
  ) as Record<string, { is_active: boolean; last4?: string; updated_at?: string } | undefined>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intégrations</h1>
        <p className="text-muted-foreground">
          Tes credentials sont chiffrés avec AES-256-GCM et ne sont jamais exposés côté client.
        </p>
      </div>
      <IntegrationsClient integrations={byProvider} />
    </div>
  );
}

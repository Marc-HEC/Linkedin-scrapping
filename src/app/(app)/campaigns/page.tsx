import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  name: string;
  channel: "email" | "linkedin_connect" | "linkedin_message";
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type Stat = { campaign_id: string; status: string; count: number };

export default async function CampaignsPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, name, channel, status, started_at, completed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Stats par campagne
  const ids = (campaigns ?? []).map((c) => c.id);
  const statsByCampaign = new Map<string, Record<string, number>>();
  if (ids.length) {
    const { data: msgs } = await admin
      .from("messages_generated")
      .select("campaign_id, status")
      .in("campaign_id", ids);
    for (const m of (msgs ?? []) as Pick<Stat, "campaign_id" | "status">[]) {
      const e = statsByCampaign.get(m.campaign_id) ?? {};
      e[m.status] = (e[m.status] ?? 0) + 1;
      statsByCampaign.set(m.campaign_id, e);
    }
  }

  const rows = (campaigns ?? []) as CampaignRow[];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campagnes</h1>
          <p className="text-muted-foreground">
            Lance une campagne en choisissant un template et des tags de ciblage par ordre de priorité.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>+ Nouvelle campagne</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Aucune campagne pour le moment.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const s = statsByCampaign.get(c.id) ?? {};
            const total = Object.values(s).reduce((a, b) => a + b, 0);
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.channel} · créée {new Date(c.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant={c.status === "completed" ? "secondary" : "default"}>{c.status}</Badge>
                      <span>{s.sent ?? 0} envoyés · {s.pending ?? 0} en attente · {s.failed ?? 0} échecs · {total} total</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

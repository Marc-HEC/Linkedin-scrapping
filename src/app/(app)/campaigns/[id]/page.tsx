import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignDetailClient } from "./campaign-detail-client";
import { getDecryptedCredential } from "../../integrations/actions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, name, channel, status, started_at, completed_at, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!campaign) notFound();

  const { data: messages } = await admin
    .from("messages_generated")
    .select("id, contact_id, subject, body_rendered, ai_refined, status, sent_at, error_message")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const msgs = messages ?? [];
  const contactIds = msgs.map((m) => m.contact_id);
  const { data: contacts } = contactIds.length
    ? await admin
        .from("contacts")
        .select("id, first_name, last_name, email, linkedin_url, company_name")
        .in("id", contactIds)
    : { data: [] };

  const contactsMap = new Map((contacts ?? []).map((c) => [c.id, c]));

  const mistralCreds = await getDecryptedCredential(user.id, "mistral");
  const hasMistral = !!mistralCreds;

  const statusCounts = msgs.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  const rows = msgs.map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body_rendered,
    ai_refined: m.ai_refined ?? false,
    status: m.status as string,
    sent_at: m.sent_at,
    error_message: m.error_message,
    contact: contactsMap.get(m.contact_id) ?? null,
  }));

  const isDraft = campaign.status === "draft";

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← Campagnes
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <p className="text-xs text-muted-foreground">
              {campaign.channel} · {isDraft ? "en attente de révision" : `créée ${new Date(campaign.created_at).toLocaleString("fr-FR")}`}
            </p>
          </div>
          <Badge variant={
            campaign.status === "completed" ? "secondary"
            : campaign.status === "cancelled" ? "outline"
            : campaign.status === "draft" ? "default"
            : "default"
          }>
            {campaign.status === "draft" ? "À réviser" : campaign.status}
          </Badge>
        </div>
      </div>

      {!isDraft && (
        <Card>
          <CardHeader><CardTitle className="text-base">Statistiques</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <span>{statusCounts.pending ?? 0} en attente</span>
            <span>{statusCounts.sent ?? 0} envoyés</span>
            <span>{statusCounts.failed ?? 0} échecs</span>
            <span>{statusCounts.skipped ?? 0} ignorés</span>
            <span className="ml-auto font-medium">{msgs.length} total</span>
          </CardContent>
        </Card>
      )}

      {isDraft && (
        <p className="text-sm text-muted-foreground">
          {msgs.length} message{msgs.length > 1 ? "s" : ""} générés
          {hasMistral ? " par Mistral AI" : ""} — relu chacun avant d&apos;envoyer.
        </p>
      )}

      <CampaignDetailClient
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        rows={rows}
        channel={campaign.channel}
        hasMistral={hasMistral}
      />
    </div>
  );
}

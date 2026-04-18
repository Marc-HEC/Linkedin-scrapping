import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NewCampaignClient } from "./new-campaign-client";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const [{ data: templates }, { data: tags }] = await Promise.all([
    admin
      .from("templates")
      .select("id, name, channel, subject, body_text, variables_used")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    admin.rpc("list_user_tags", { p_user: user.id }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nouvelle campagne</h1>
        <p className="text-muted-foreground">
          Choisis un template et des tags de ciblage ordonnés par priorité. Les contacts qui
          matchent le plus de tags (et les tags les plus prioritaires) seront contactés en premier.
        </p>
      </div>
      <NewCampaignClient
        templates={(templates ?? []) as TemplateLite[]}
        availableTags={((tags ?? []) as Array<{ tag: string; usage_count: number }>).map((t) => t.tag)}
      />
    </div>
  );
}

export type TemplateLite = {
  id: string;
  name: string;
  channel: "email" | "linkedin_connect" | "linkedin_message";
  subject: string | null;
  body_text: string;
  variables_used: string[];
};

import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { GdprClient } from "./gdpr-client";

export const dynamic = "force-dynamic";

type SuppressionRow = {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  created_at: string;
};

export default async function GdprPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("suppression_list")
    .select("id, email, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as SuppressionRow[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conformité RGPD</h1>
        <p className="text-muted-foreground">
          Les emails présents dans cette liste sont exclus de toutes tes campagnes.
          Ils y sont ajoutés automatiquement quand un destinataire clique sur le lien de
          désinscription, ou manuellement par toi.
        </p>
      </div>
      <GdprClient rows={rows} />
    </div>
  );
}

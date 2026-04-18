import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

export type TemplateRow = {
  id: string;
  name: string;
  channel: "email" | "linkedin_connect" | "linkedin_message";
  subject: string | null;
  body_text: string;
  variables_used: string[];
  updated_at: string;
};

export default async function TemplatesPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("templates")
    .select("id, name, channel, subject, body_text, variables_used, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">
          Utilise des variables entre crochets : <code>[Prénom]</code>, <code>[NomEntreprise]</code>, <code>[Rôle]</code>… Elles seront remplacées pour chaque contact lors de l&apos;envoi.
        </p>
      </div>
      <TemplatesClient templates={(data ?? []) as TemplateRow[]} />
    </div>
  );
}

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSegmentsAction } from "./actions";
import { SegmentsClient } from "./segments-client";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const [segments, { data: tags }] = await Promise.all([
    getSegmentsAction(),
    admin.rpc("list_user_tags", { p_user: user.id }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Segments</h1>
        <p className="text-muted-foreground">
          Sauvegarde tes combinaisons de tags pour les réutiliser rapidement dans les campagnes.
        </p>
      </div>
      <SegmentsClient
        segments={segments}
        availableTags={((tags ?? []) as Array<{ tag: string }>).map((t) => t.tag)}
      />
    </div>
  );
}

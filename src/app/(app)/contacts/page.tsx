import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ContactsClient } from "./contacts-client";

export const dynamic = "force-dynamic";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  role: string | null;
  tags: string[];
};

export default async function ContactsPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email, linkedin_url, company_name, role, tags")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const contacts = (data ?? []) as ContactRow[];

  const { data: tagsData } = await admin.rpc("list_user_tags", { p_user: user.id });
  const knownTags = (tagsData ?? []) as Array<{ tag: string; usage_count: number }>;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">
          Tagge tes contacts. Les campagnes cibleront par tags (par ordre de priorité).
        </p>
      </div>
      <ContactsClient contacts={contacts} knownTags={knownTags.map((t) => t.tag)} />
    </div>
  );
}

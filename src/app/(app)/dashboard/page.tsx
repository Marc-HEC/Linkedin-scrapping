import { createSupabaseServer } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: profile } = await supabase.from("profiles").select("full_name, onboarding_completed").single();

  const name = profile?.full_name?.split(" ")[0] ?? "là";

  const [{ count: contactCount }, { count: campaignCount }, { count: templateCount }] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("templates").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {name} 👋</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de ta prospection B2B</p>
      </div>

      {!profile?.onboarding_completed && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          ⚡ Configure tes intégrations pour démarrer —{" "}
          <a href="/onboarding" className="font-medium text-primary underline underline-offset-4">
            Finaliser l&apos;onboarding
          </a>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Contacts", value: contactCount ?? 0, href: "/contacts" },
          { label: "Templates", value: templateCount ?? 0, href: "/templates" },
          { label: "Campagnes", value: campaignCount ?? 0, href: "/campaigns" },
        ].map((kpi) => (
          <a
            key={kpi.label}
            href={kpi.href}
            className="rounded-lg border bg-background p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold">{kpi.value}</p>
          </a>
        ))}
      </div>

      <div className="rounded-lg border bg-background p-6 shadow-sm">
        <h2 className="font-semibold mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/contacts", label: "Importer des contacts" },
            { href: "/templates", label: "Créer un template" },
            { href: "/campaigns", label: "Lancer une campagne" },
            { href: "/integrations", label: "Configurer mes intégrations" },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Outreach B2B Multicanal</h1>
      <p className="max-w-xl text-center text-muted-foreground">
        Génère des messages personnalisés pour LinkedIn et email à partir de tes templates.
        Variables dynamiques, segmentation, conformité RGPD.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Créer un compte
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}

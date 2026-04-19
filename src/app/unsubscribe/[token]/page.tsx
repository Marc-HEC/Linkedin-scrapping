import { verifyUnsubscribeToken } from "@/lib/crypto/encrypt";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = verifyUnsubscribeToken(token);

  if (!decoded) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="text-2xl font-bold">Lien invalide</h1>
        <p className="text-muted-foreground">
          Ce lien de désinscription n&apos;est pas reconnu ou a été altéré.
        </p>
      </div>
    );
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("suppression_list")
    .upsert(
      { user_id: decoded.userId, email: decoded.email, reason: "unsubscribe" },
      { onConflict: "user_id,email" }
    );

  return (
    <div className="mx-auto max-w-md space-y-3 p-8 text-center">
      <h1 className="text-2xl font-bold">Désinscription confirmée</h1>
      <p className="text-muted-foreground">
        L&apos;adresse <strong>{decoded.email}</strong> ne recevra plus de messages de notre part.
      </p>
      {error && (
        <p className="text-sm text-destructive">
          Erreur technique lors de l&apos;enregistrement. Contacte-nous si tu reçois encore des emails.
        </p>
      )}
    </div>
  );
}

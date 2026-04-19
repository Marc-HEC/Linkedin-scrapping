"use client";

import { useRouter } from "next/navigation";
import { CredentialForm } from "./components/credential-form";
import {
  saveSMTPAction, saveMistralAction, saveUnipileAction,
  saveDropcontactAction, saveOutxAction, saveApolloAction,
  deleteIntegrationAction,
} from "./actions";

type Integration = { is_active: boolean; last4?: string; updated_at?: string } | undefined;

interface Props {
  integrations: Record<string, Integration>;
}

export function IntegrationsClient({ integrations }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const smtp = integrations["smtp"];
  const mistral = integrations["mistral"];
  const unipile = integrations["unipile"];
  const dropcontact = integrations["dropcontact"];
  const outx = integrations["outx"];
  const apollo = integrations["apollo"];

  return (
    <div className="space-y-4">
      {/* SMTP */}
      <CredentialForm
        title="Email — SMTP"
        description={
          <>Envoie tes cold emails B2B via ton propre serveur SMTP (Gmail, Brevo, Postmark…)</>
        }
        isConnected={!!(smtp?.is_active)}
        last4={smtp?.last4}
        updatedAt={smtp?.updated_at}
        fields={[
          { name: "host", label: "Hôte SMTP", placeholder: "smtp.gmail.com", required: true },
          { name: "port", label: "Port", placeholder: "587", defaultValue: "587", required: true },
          { name: "user", label: "Email de connexion", type: "email", required: true },
          { name: "password", label: "Mot de passe / App password", type: "password", required: true },
          { name: "from_name", label: "Nom affiché de l'expéditeur", placeholder: "Marc Buffry", required: true },
          { name: "from_email", label: "Email d'envoi", type: "email", required: true },
        ]}
        onSave={async (fd) => { const r = await saveSMTPAction(fd); refresh(); return r; }}
        onTest={saveSMTPAction}
        onDisconnect={async () => { await deleteIntegrationAction("smtp"); refresh(); }}
      />

      {/* Mistral */}
      <CredentialForm
        title="IA — Mistral (génération de messages)"
        description="Optionnel : raffine tes messages avec l'IA Mistral (données hébergées en Europe, conforme RGPD)."
        isConnected={!!(mistral?.is_active)}
        last4={mistral?.last4}
        updatedAt={mistral?.updated_at}
        fields={[
          { name: "api_key", label: "Clé API Mistral", type: "password", placeholder: "sk-...", required: true },
          { name: "model", label: "Modèle", placeholder: "mistral-small-latest", defaultValue: "mistral-small-latest" },
        ]}
        onSave={async (fd) => { const r = await saveMistralAction(fd); refresh(); return r; }}
        onTest={saveMistralAction}
        onDisconnect={async () => { await deleteIntegrationAction("mistral"); refresh(); }}
      />

      {/* Unipile */}
      <CredentialForm
        title="LinkedIn — Unipile"
        description={
          <>
            Envoi automatique d&apos;invitations et messages LinkedIn via l&apos;API Unipile
            (partenaire officiel, conforme aux CGU LinkedIn).
          </>
        }
        isConnected={!!(unipile?.is_active)}
        last4={unipile?.last4}
        updatedAt={unipile?.updated_at}
        fields={[
          { name: "api_key", label: "Clé API Unipile", type: "password", placeholder: "upli_...", required: true },
          { name: "dsn", label: "DSN Unipile", placeholder: "api8.unipile.com:13851", required: true },
          { name: "account_id", label: "Account ID LinkedIn (Unipile)", placeholder: "acc_...", required: true },
        ]}
        onSave={async (fd) => { const r = await saveUnipileAction(fd); refresh(); return r; }}
        onDisconnect={async () => { await deleteIntegrationAction("unipile"); refresh(); }}
      />

      {/* OutX */}
      <CredentialForm
        title="LinkedIn — OutX (alternative)"
        description="Provider LinkedIn alternatif, souvent moins cher qu'Unipile. Ajoute la recherche de profils. Si configuré, il est utilisé en priorité."
        isConnected={!!(outx?.is_active)}
        last4={outx?.last4}
        updatedAt={outx?.updated_at}
        fields={[
          { name: "api_key", label: "Clé API OutX", type: "password", placeholder: "otx_...", required: true },
        ]}
        onSave={async (fd) => { const r = await saveOutxAction(fd); refresh(); return r; }}
        onDisconnect={async () => { await deleteIntegrationAction("outx"); refresh(); }}
      />

      {/* Dropcontact */}
      <CredentialForm
        title="Enrichissement — Dropcontact"
        description="Enrichis tes contacts (email pro, taille d'entreprise…) via Dropcontact, conforme RGPD/CNIL."
        isConnected={!!(dropcontact?.is_active)}
        last4={dropcontact?.last4}
        updatedAt={dropcontact?.updated_at}
        fields={[
          { name: "api_key", label: "Clé API Dropcontact", type: "password", placeholder: "dpc_...", required: true },
        ]}
        onSave={async (fd) => { const r = await saveDropcontactAction(fd); refresh(); return r; }}
        onDisconnect={async () => { await deleteIntegrationAction("dropcontact"); refresh(); }}
      />

      {/* Apollo */}
      <CredentialForm
        title="Contacts B2B — Apollo"
        description="Recherche et import de leads depuis Apollo.io (plan gratuit disponible). Utilisé côté /contacts."
        isConnected={!!(apollo?.is_active)}
        last4={apollo?.last4}
        updatedAt={apollo?.updated_at}
        fields={[
          { name: "api_key", label: "Clé API Apollo", type: "password", placeholder: "apollo_...", required: true },
        ]}
        onSave={async (fd) => { const r = await saveApolloAction(fd); refresh(); return r; }}
        onDisconnect={async () => { await deleteIntegrationAction("apollo"); refresh(); }}
      />

      <div className="rounded-lg border border-muted bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>🔒 <strong>Sécurité</strong> : tous tes credentials sont chiffrés avec AES-256-GCM (envelope encryption). La clé maître n&apos;est jamais stockée en base de données.</p>
        <p>⚠️ Ne partage jamais tes credentials en screenshot ou dans une conversation.</p>
        <p>🔄 Change tes mots de passe / clés API tous les 90 jours pour limiter l&apos;exposition.</p>
      </div>
    </div>
  );
}

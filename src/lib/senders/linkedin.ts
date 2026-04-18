// Envoi LinkedIn via Unipile (API officielle compatible CGU LinkedIn).
// Doc : https://developer.unipile.com/
// L'utilisateur doit fournir :
//  - api_key : clé X-API-KEY
//  - dsn : le sous-domaine/port attribués (ex: api8.unipile.com:13851)
//  - account_id : l'account Unipile LinkedIn connecté

export type UnipileCreds = {
  api_key: string;
  dsn: string;        // ex: api8.unipile.com:13851
  account_id: string; // id du compte LinkedIn dans Unipile
};

export type UnipilePayload = {
  linkedin_url: string;
  text: string;
  mode: "invite" | "message";
};

function base(dsn: string): string {
  return dsn.startsWith("http") ? dsn : `https://${dsn}/api/v1`;
}

async function resolveProviderId(creds: UnipileCreds, linkedinUrl: string): Promise<string> {
  // Unipile : GET /users/{public_identifier}?account_id=...
  const publicId = extractLinkedInSlug(linkedinUrl);
  if (!publicId) throw new Error(`URL LinkedIn invalide: ${linkedinUrl}`);

  const url = `${base(creds.dsn)}/users/${encodeURIComponent(publicId)}?account_id=${encodeURIComponent(creds.account_id)}`;
  const res = await fetch(url, { headers: { "X-API-KEY": creds.api_key } });
  if (!res.ok) throw new Error(`Unipile lookup ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { provider_id?: string; id?: string };
  const pid = json.provider_id ?? json.id;
  if (!pid) throw new Error("provider_id introuvable pour ce profil");
  return pid;
}

function extractLinkedInSlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function sendViaUnipile(creds: UnipileCreds, payload: UnipilePayload): Promise<string> {
  const providerId = await resolveProviderId(creds, payload.linkedin_url);

  if (payload.mode === "invite") {
    const res = await fetch(`${base(creds.dsn)}/users/invite`, {
      method: "POST",
      headers: {
        "X-API-KEY": creds.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: creds.account_id,
        provider_id: providerId,
        message: payload.text.slice(0, 300),
      }),
    });
    if (!res.ok) throw new Error(`Unipile invite ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { invitation_id?: string; id?: string };
    return json.invitation_id ?? json.id ?? "unipile-invite-sent";
  }

  // Message direct (crée un chat s'il n'existe pas)
  const res = await fetch(`${base(creds.dsn)}/chats`, {
    method: "POST",
    headers: {
      "X-API-KEY": creds.api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account_id: creds.account_id,
      attendees_ids: [providerId],
      text: payload.text,
    }),
  });
  if (!res.ok) throw new Error(`Unipile message ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { chat_id?: string; id?: string };
  return json.chat_id ?? json.id ?? "unipile-message-sent";
}

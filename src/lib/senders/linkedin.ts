// Provider LinkedIn : interface commune pour Unipile + OutX, avec factory par user.
// Unipile = API officielle partenaire LinkedIn (recommandée, conforme CGU).
// OutX = alternative souvent moins chère. Priorise OutX si configuré, fallback Unipile.

import "server-only";

// ============================================================
// Types communs
// ============================================================

export type LinkedinProviderName = "unipile" | "outx";

export interface LinkedinSearchParams {
  keywords: string;
  title?: string;
  company?: string;
  location?: string;
  limit?: number;
}

export interface LinkedinProfileResult {
  full_name: string;
  linkedin_url: string;
  headline?: string;
  company?: string;
  title?: string;
  location?: string;
  email?: string;
}

export type SendConnectionInput = {
  linkedin_url: string;
  text: string; // message de l'invitation (max ~300 chars)
};

export type SendMessageInput = {
  linkedin_url: string;
  text: string;
};

export type SendResult = {
  providerMessageId: string;
};

export interface LinkedinSender {
  readonly provider: LinkedinProviderName;
  sendConnectionRequest(input: SendConnectionInput): Promise<SendResult>;
  sendMessage(input: SendMessageInput): Promise<SendResult>;
  searchProfiles?(params: LinkedinSearchParams): Promise<LinkedinProfileResult[]>;
}

// ============================================================
// Implémentation Unipile (legacy — conserve API existante)
// ============================================================

export type UnipileCreds = {
  api_key: string;
  dsn: string; // ex: api8.unipile.com:13851
  account_id: string; // id du compte LinkedIn dans Unipile
};

export type UnipilePayload = {
  linkedin_url: string;
  text: string;
  mode: "invite" | "message";
};

function unipileBase(dsn: string): string {
  return dsn.startsWith("http") ? dsn : `https://${dsn}/api/v1`;
}

function extractLinkedInSlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

async function unipileResolveProviderId(creds: UnipileCreds, linkedinUrl: string): Promise<string> {
  const publicId = extractLinkedInSlug(linkedinUrl);
  if (!publicId) throw new Error(`URL LinkedIn invalide: ${linkedinUrl}`);
  const url = `${unipileBase(creds.dsn)}/users/${encodeURIComponent(publicId)}?account_id=${encodeURIComponent(creds.account_id)}`;
  const res = await fetch(url, { headers: { "X-API-KEY": creds.api_key } });
  if (!res.ok) throw new Error(`Unipile lookup ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { provider_id?: string; id?: string };
  const pid = json.provider_id ?? json.id;
  if (!pid) throw new Error("provider_id introuvable pour ce profil");
  return pid;
}

/** @deprecated Utilise `getLinkedinSenderForUser(userId)` + `.sendMessage/.sendConnectionRequest` */
export async function sendViaUnipile(creds: UnipileCreds, payload: UnipilePayload): Promise<string> {
  const providerId = await unipileResolveProviderId(creds, payload.linkedin_url);

  if (payload.mode === "invite") {
    const res = await fetch(`${unipileBase(creds.dsn)}/users/invite`, {
      method: "POST",
      headers: { "X-API-KEY": creds.api_key, "Content-Type": "application/json" },
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

  const res = await fetch(`${unipileBase(creds.dsn)}/chats`, {
    method: "POST",
    headers: { "X-API-KEY": creds.api_key, "Content-Type": "application/json" },
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

class UnipileLinkedinSender implements LinkedinSender {
  readonly provider = "unipile" as const;
  constructor(private readonly creds: UnipileCreds) {}

  async sendConnectionRequest(input: SendConnectionInput): Promise<SendResult> {
    const id = await sendViaUnipile(this.creds, {
      linkedin_url: input.linkedin_url,
      text: input.text,
      mode: "invite",
    });
    return { providerMessageId: id };
  }

  async sendMessage(input: SendMessageInput): Promise<SendResult> {
    const id = await sendViaUnipile(this.creds, {
      linkedin_url: input.linkedin_url,
      text: input.text,
      mode: "message",
    });
    return { providerMessageId: id };
  }

  async searchProfiles(params: LinkedinSearchParams): Promise<LinkedinProfileResult[]> {
    const { searchProfiles } = await import("@/lib/clients/unipile");
    return searchProfiles(params, this.creds.api_key, this.creds.dsn, this.creds.account_id);
  }
}

// ============================================================
// Implémentation OutX (via client dédié)
// ============================================================

class OutxLinkedinSender implements LinkedinSender {
  readonly provider = "outx" as const;
  constructor(private readonly apiKey: string, private readonly baseUrl: string) {}

  async sendConnectionRequest(input: SendConnectionInput): Promise<SendResult> {
    const { sendConnectionRequest } = await import("@/lib/clients/outx");
    return sendConnectionRequest(input, this.apiKey, this.baseUrl);
  }

  async sendMessage(input: SendMessageInput): Promise<SendResult> {
    const { sendMessage } = await import("@/lib/clients/outx");
    return sendMessage(input, this.apiKey, this.baseUrl);
  }

  async searchProfiles(params: LinkedinSearchParams): Promise<LinkedinProfileResult[]> {
    const { searchProfiles } = await import("@/lib/clients/outx");
    return searchProfiles(params, this.apiKey, this.baseUrl);
  }
}

// ============================================================
// FallbackLinkedinSender : essaie primary, bascule sur fallback si erreur
// ============================================================

class FallbackLinkedinSender implements LinkedinSender {
  readonly provider: LinkedinProviderName;

  constructor(
    private readonly primary: LinkedinSender,
    private readonly fallback: LinkedinSender,
  ) {
    this.provider = primary.provider;
  }

  async sendConnectionRequest(input: SendConnectionInput): Promise<SendResult> {
    try {
      return await this.primary.sendConnectionRequest(input);
    } catch (e) {
      console.log(`[LinkedIn] primary (${this.primary.provider}) failed: ${(e as Error).message}, trying fallback (${this.fallback.provider})`);
      try {
        return await this.fallback.sendConnectionRequest(input);
      } catch (fe) {
        console.log(`[LinkedIn] fallback (${this.fallback.provider}) also failed: ${(fe as Error).message}`);
        throw fe;
      }
    }
  }

  async sendMessage(input: SendMessageInput): Promise<SendResult> {
    try {
      return await this.primary.sendMessage(input);
    } catch (e) {
      console.log(`[LinkedIn] primary (${this.primary.provider}) failed: ${(e as Error).message}, trying fallback (${this.fallback.provider})`);
      try {
        return await this.fallback.sendMessage(input);
      } catch (fe) {
        console.log(`[LinkedIn] fallback (${this.fallback.provider}) also failed: ${(fe as Error).message}`);
        throw fe;
      }
    }
  }

  async searchProfiles(params: LinkedinSearchParams): Promise<LinkedinProfileResult[]> {
    if (this.primary.searchProfiles) {
      try {
        return await this.primary.searchProfiles(params);
      } catch (e) {
        console.log(`[LinkedIn] primary search (${this.primary.provider}) failed: ${(e as Error).message}, trying fallback`);
      }
    }
    if (this.fallback.searchProfiles) {
      return this.fallback.searchProfiles(params);
    }
    throw new Error("searchProfiles not available on either provider");
  }
}

// ============================================================
// Factory : sélectionne le provider configuré pour l'utilisateur
// ============================================================

/**
 * Retourne un sender LinkedIn selon l'intégration active du user.
 * Priorité : OutX (si configuré) > Unipile (fallback).
 * Throw si aucun provider configuré.
 */
export async function getLinkedinSenderForUser(userId: string): Promise<LinkedinSender> {
  const { getDecryptedCredential } = await import("@/app/(app)/integrations/actions");

  const [outxCreds, unipileCreds] = await Promise.all([
    getDecryptedCredential<{ api_key: string; base_url?: string }>(userId, "outx"),
    getDecryptedCredential<UnipileCreds>(userId, "unipile"),
  ]);

  let outxSender: OutxLinkedinSender | null = null;
  if (outxCreds?.api_key) {
    const baseUrl = outxCreds.base_url ?? process.env.OUTX_API_BASE_URL ?? "https://api.outx.ai";
    if (!baseUrl) throw new Error("OUTX_API_BASE_URL is not set in environment");
    outxSender = new OutxLinkedinSender(outxCreds.api_key, baseUrl);
  }

  const unipileSender =
    unipileCreds?.api_key && unipileCreds.dsn && unipileCreds.account_id
      ? new UnipileLinkedinSender(unipileCreds)
      : null;

  if (outxSender && unipileSender) return new FallbackLinkedinSender(outxSender, unipileSender);
  if (outxSender) return outxSender;
  if (unipileSender) return unipileSender;
  throw new Error("Aucune intégration LinkedIn configurée (OutX ou Unipile).");
}

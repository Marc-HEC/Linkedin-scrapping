// Client OutX — API tierce d'outreach LinkedIn (alternative Unipile, souvent moins chère).
// Les endpoints ci-dessous suivent un pattern REST générique ; si ton instance OutX
// utilise d'autres routes, adapte `paths` en haut du fichier uniquement.
//
// Doc : https://outx.io/docs (consulter pour valider les endpoints exacts)
// Env : OUTX_API_BASE_URL (ex https://api.outx.io/v1)

import "server-only";
import type {
  LinkedinSearchParams,
  LinkedinProfileResult,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "@/lib/senders/linkedin";

const paths = {
  search: "/linkedin/search",
  invite: "/linkedin/invite",
  message: "/linkedin/message",
};

function base(): string {
  const url = process.env.OUTX_API_BASE_URL;
  if (!url) throw new Error("OUTX_API_BASE_URL manquante dans l'environnement");
  return url.replace(/\/+$/, "");
}

type Headers = Record<string, string>;
function headers(apiKey: string): Headers {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function searchProfiles(
  params: LinkedinSearchParams,
  apiKey: string
): Promise<LinkedinProfileResult[]> {
  const res = await fetch(`${base()}${paths.search}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      keywords: params.keywords,
      title: params.title,
      company: params.company,
      location: params.location,
      limit: params.limit ?? 25,
    }),
  });
  if (!res.ok) throw new Error(`OutX search ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { results?: RawProfile[] } | RawProfile[];
  const rows = Array.isArray(json) ? json : (json.results ?? []);
  return rows.map(normalizeProfile).filter((p) => !!p.linkedin_url);
}

export async function sendConnectionRequest(
  input: SendConnectionInput,
  apiKey: string
): Promise<SendResult> {
  const res = await fetch(`${base()}${paths.invite}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      profile_url: input.linkedin_url,
      message: input.text.slice(0, 300),
    }),
  });
  if (!res.ok) throw new Error(`OutX invite ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { id?: string; invitation_id?: string };
  return { providerMessageId: json.invitation_id ?? json.id ?? "outx-invite-sent" };
}

export async function sendMessage(
  input: SendMessageInput,
  apiKey: string
): Promise<SendResult> {
  const res = await fetch(`${base()}${paths.message}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      profile_url: input.linkedin_url,
      text: input.text,
    }),
  });
  if (!res.ok) throw new Error(`OutX message ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { id?: string; message_id?: string };
  return { providerMessageId: json.message_id ?? json.id ?? "outx-message-sent" };
}

// ---- helpers ----

type RawProfile = {
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_url?: string;
  linkedin_url?: string;
  url?: string;
  headline?: string;
  title?: string;
  company?: string;
  company_name?: string;
  location?: string;
  email?: string;
};

function normalizeProfile(p: RawProfile): LinkedinProfileResult {
  const linkedin_url = p.linkedin_url ?? p.profile_url ?? p.url ?? "";
  const full_name =
    p.full_name ??
    p.name ??
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return {
    full_name: full_name || "—",
    linkedin_url,
    headline: p.headline,
    title: p.title,
    company: p.company ?? p.company_name,
    location: p.location,
    email: p.email,
  };
}

import "server-only";
import type {
  LinkedinSearchParams,
  LinkedinProfileResult,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "@/lib/senders/linkedin";

function norm(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

type Hdrs = Record<string, string>;
function headers(apiKey: string): Hdrs {
  return { "x-api-key": apiKey, "Content-Type": "application/json" };
}

function extractSlug(linkedinUrl: string): string {
  const m = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!m) throw new Error(`Cannot extract profile slug from URL: ${linkedinUrl}`);
  return decodeURIComponent(m[1]).replace(/\/$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchProfileUrn(slug: string, apiKey: string, baseUrl: string): Promise<string> {
  const fetchUrl = `${norm(baseUrl)}/linkedin-agent/fetch-profile`;
  console.log(`[OutX] POST ${fetchUrl} slug=${slug}`);
  const res = await fetch(fetchUrl, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ profile_slug: slug }),
  });
  const fetchBody = await res.text();
  console.log(`[OutX] response status=${res.status} body=${fetchBody}`);
  if (!res.ok) throw new Error(`OutX fetch-profile ${res.status}: ${fetchBody}`);
  const { api_agent_task_id } = JSON.parse(fetchBody) as { success: boolean; api_agent_task_id: string };

  const pollUrl = `${norm(baseUrl)}/linkedin-agent/get-task-status?api_agent_task_id=${encodeURIComponent(api_agent_task_id)}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(3000);
    console.log(`[OutX] GET ${pollUrl} attempt=${attempt + 1}`);
    const pollRes = await fetch(pollUrl, { headers: { "x-api-key": apiKey } });
    const pollBody = await pollRes.text();
    console.log(`[OutX] response status=${pollRes.status} body=${pollBody}`);
    if (!pollRes.ok) throw new Error(`OutX get-task-status ${pollRes.status}: ${pollBody}`);
    const data = JSON.parse(pollBody) as {
      status: string;
      task_output?: { profile?: { profile_urn?: string } };
    };
    if (data.status === "completed") {
      if (!data.task_output?.profile) throw new Error("OutX fetch-profile: no profile in response");
      const urn = data.task_output.profile.profile_urn;
      if (!urn) throw new Error("OutX fetch-profile: profile_urn missing");
      return urn;
    }
  }
  throw new Error("OutX fetch-profile timed out");
}

export async function sendConnectionRequest(
  input: SendConnectionInput,
  apiKey: string,
  baseUrl: string
): Promise<SendResult> {
  const slug = extractSlug(input.linkedin_url);
  const profileUrn = await fetchProfileUrn(slug, apiKey, baseUrl);
  const url = `${norm(baseUrl)}/linkedin-agent/send-connection-request`;
  console.log(`[OutX] POST ${url} slug=${slug}`);
  const res = await fetch(url, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ profile_urn: profileUrn }),
  });
  const body = await res.text();
  console.log(`[OutX] response status=${res.status} body=${body}`);
  if (!res.ok) throw new Error(`OutX send-connection-request ${res.status}: ${body}`);
  const json = JSON.parse(body) as { success: boolean; api_agent_task_id: string };
  return { providerMessageId: json.api_agent_task_id };
}

export async function sendMessage(
  input: SendMessageInput,
  apiKey: string,
  baseUrl: string
): Promise<SendResult> {
  const slug = extractSlug(input.linkedin_url);
  const profileUrn = await fetchProfileUrn(slug, apiKey, baseUrl);
  const url = `${norm(baseUrl)}/linkedin-agent/send-message`;
  console.log(`[OutX] POST ${url} slug=${slug}`);
  const res = await fetch(url, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ recipient_urn: profileUrn, message: input.text }),
  });
  const body = await res.text();
  console.log(`[OutX] response status=${res.status} body=${body}`);
  if (!res.ok) throw new Error(`OutX send-message ${res.status}: ${body}`);
  const json = JSON.parse(body) as { success: boolean; api_agent_task_id: string };
  return { providerMessageId: json.api_agent_task_id };
}

export async function searchProfiles(
  params: LinkedinSearchParams,
  apiKey: string,
  baseUrl: string
): Promise<LinkedinProfileResult[]> {
  const body = JSON.stringify({
    keywords: params.keywords,
    title: params.title,
    company: params.company,
    location: params.location,
    limit: params.limit ?? 25,
  });

  const postUrl = `${norm(baseUrl)}/linkedin-agent/search-profiles`;
  console.log(`[OutX] POST ${postUrl} keywords=${params.keywords}`);
  const res = await fetch(postUrl, { method: "POST", headers: headers(apiKey), body });
  const text = await res.text();
  console.log(`[OutX] response status=${res.status} body=${text}`);
  if (!res.ok) throw new Error(`OutX search-profiles ${res.status}: ${text}`);

  const json = JSON.parse(text) as
    | { api_agent_task_id: string; success: boolean }
    | { results?: RawProfile[] }
    | RawProfile[];

  // Réponse synchrone (certains plans retournent les profils directement)
  if (Array.isArray(json)) return json.map(normalizeProfile).filter((p) => !!p.linkedin_url);
  if ("results" in json && json.results) return json.results.map(normalizeProfile).filter((p) => !!p.linkedin_url);

  // Réponse asynchrone : OutX a créé une tâche en background, on poll le résultat
  if (!("api_agent_task_id" in json) || !json.api_agent_task_id) {
    throw new Error(`OutX search: réponse inattendue — ${text}`);
  }
  const taskId = json.api_agent_task_id;
  const pollUrl = `${norm(baseUrl)}/linkedin-agent/get-task-status?api_agent_task_id=${encodeURIComponent(taskId)}`;

  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    console.log(`[OutX] GET ${pollUrl} attempt=${attempt + 1}`);
    const pollRes = await fetch(pollUrl, { headers: { "x-api-key": apiKey } });
    const pollText = await pollRes.text();
    console.log(`[OutX] poll status=${pollRes.status} body=${pollText}`);
    if (!pollRes.ok) continue;

    const data = JSON.parse(pollText) as {
      status: string;
      task_output?: {
        profiles?: RawProfile[];
        results?: RawProfile[];
        people?: RawProfile[];
      };
    };

    if (data.status === "completed") {
      const rows =
        data.task_output?.profiles ??
        data.task_output?.results ??
        data.task_output?.people ??
        [];
      return rows.map(normalizeProfile).filter((p) => !!p.linkedin_url);
    }
    if (data.status === "failed") {
      throw new Error(`OutX search task failed`);
    }
  }
  throw new Error("OutX search timed out (15 tentatives × 2s)");
}

// ---- helpers ----

type RawProfile = {
  full_name?: string; name?: string; first_name?: string; last_name?: string;
  profile_url?: string; linkedin_url?: string; url?: string;
  headline?: string; title?: string; company?: string; company_name?: string;
  location?: string; email?: string;
};

function normalizeProfile(p: RawProfile): LinkedinProfileResult {
  const linkedin_url = p.linkedin_url ?? p.profile_url ?? p.url ?? "";
  const full_name = p.full_name ?? p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
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

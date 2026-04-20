import "server-only";
import type { LinkedinSearchParams, LinkedinProfileResult } from "@/lib/senders/linkedin";

function base(dsn: string): string {
  return dsn.startsWith("http") ? dsn : `https://${dsn}/api/v1`;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20;

export async function searchProfiles(
  params: LinkedinSearchParams,
  apiKey: string,
  dsn: string,
  accountId: string
): Promise<LinkedinProfileResult[]> {
  // Correct Unipile endpoint: POST /api/v1/linkedin/search?account_id=...
  const url = `${base(dsn)}/linkedin/search?account_id=${accountId}`;

  const body: Record<string, unknown> = {
    api: "classic",
    category: "people",
  };
  if (params.keywords) body.keywords = params.keywords;
  if (params.title)    body.title    = params.title;
  if (params.company)  body.company  = { include: [params.company] };
  if (params.location) body.location = params.location;
  if (params.limit)    body.count    = params.limit;

  console.log(`[Unipile] POST ${url} keywords=${params.keywords}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Unipile search ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { items?: RawProfile[] } | RawProfile[];
  const rows = Array.isArray(json) ? json : (json.items ?? []);

  let results = rows.map(normalize).filter((p) => !!p.linkedin_url);

  // Unipile has no native location filter — apply client-side if provided
  if (params.location) {
    const loc = params.location.toLowerCase();
    results = results.filter((p) => p.location?.toLowerCase().includes(loc));
  }

  return results;
}

type RawProfile = {
  public_identifier?: string;
  profile_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  headline?: string;
  title?: string;
  company_name?: string;
  location?: string;
  email?: string;
};

function normalize(p: RawProfile): LinkedinProfileResult {
  const slug = p.public_identifier;
  const linkedin_url =
    p.profile_url ?? (slug ? `https://www.linkedin.com/in/${slug}` : "");
  return {
    full_name:
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      "—",
    linkedin_url,
    headline: p.headline,
    title: p.title ?? p.headline,
    company: p.company_name,
    location: p.location,
    email: p.email,
  };
}

import "server-only";
import type { LinkedinSearchParams, LinkedinProfileResult } from "@/lib/senders/linkedin";

function base(dsn: string): string {
  return dsn.startsWith("http") ? dsn : `https://${dsn}/api/v1`;
}

export async function searchProfiles(
  params: LinkedinSearchParams,
  apiKey: string,
  dsn: string,
  accountId: string
): Promise<LinkedinProfileResult[]> {
  const url = new URL(`${base(dsn)}/users`);
  url.searchParams.set("account_id", accountId);
  url.searchParams.set("keywords", params.keywords);
  if (params.limit)   url.searchParams.set("limit", String(params.limit));
  if (params.title)   url.searchParams.set("title_filter", params.title);
  if (params.company) url.searchParams.set("company_filter", params.company);

  const res = await fetch(url.toString(), {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) throw new Error(`Unipile search ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { items?: RawProfile[] } | RawProfile[];
  const rows = Array.isArray(json) ? json : (json.items ?? []);

  let results = rows.map(normalize).filter((p) => !!p.linkedin_url);

  // Unipile has no native location filter — apply client-side if provided.
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

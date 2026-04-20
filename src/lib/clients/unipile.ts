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
  // Correct Unipile endpoint: POST /api/v1/linkedin/search?account_id=...
  const url = `${base(dsn)}/linkedin/search?account_id=${accountId}`;

  const body: Record<string, unknown> = {
    api: "classic",
    category: "people",
  };
  // Company IDs non disponibles en Classic → concatène dans keywords
  const kw = [params.keywords, params.company].filter(Boolean).join(" ");
  if (kw) body.keywords = kw;
  // title sous advanced_keywords uniquement en Classic
  if (params.title) body.advanced_keywords = { title: params.title };
  // location attend des IDs Unipile, pas un string libre → filtre client-side après
  // count n'existe pas en Classic → pas de limite par body

  console.log(`[Unipile] POST ${url} keywords=${params.keywords}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Unipile search ${res.status}: ${await res.text()}`);

  const raw = await res.json() as Record<string, unknown>;
  console.log(`[Unipile] raw response=${JSON.stringify(raw).slice(0, 400)}`);

  const rows: RawProfile[] = Array.isArray(raw)
    ? (raw as RawProfile[])
    : Array.isArray(raw.items)   ? (raw.items as RawProfile[])
    : Array.isArray(raw.results) ? (raw.results as RawProfile[])
    : Array.isArray(raw.data)    ? (raw.data as RawProfile[])
    : [];
  console.log(`[Unipile] rows found=${rows.length}`);

  let results = rows.map(normalize);
  console.log(`[Unipile] after normalize=${results.length} sample=${JSON.stringify(results[0] ?? {}).slice(0, 150)}`);
  results = results.filter((p) => !!p.linkedin_url);
  console.log(`[Unipile] after url filter=${results.length}`);

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
  public_profile_url?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  headline?: string;
  title?: string;
  company_name?: string;
  location?: string;
  email?: string;
  current_positions?: Array<{ company?: string; role?: string; title?: string }>;
};

function slugToName(slug?: string): string {
  if (!slug) return "";
  return slug.split("-").slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalize(p: RawProfile): LinkedinProfileResult {
  const slug = p.public_identifier;
  const raw_url = p.profile_url ?? p.public_profile_url ?? "";
  const linkedin_url = raw_url
    ? raw_url.split("?")[0]
    : slug ? `https://www.linkedin.com/in/${slug}` : "";
  return {
    full_name:
      p.name ||
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      slugToName(p.public_identifier) ||
      "—",
    linkedin_url,
    headline: p.headline,
    title: p.title ?? p.current_positions?.[0]?.role ?? p.current_positions?.[0]?.title ?? p.headline,
    company: p.company_name ?? p.current_positions?.[0]?.company,
    location: p.location,
    email: p.email,
  };
}

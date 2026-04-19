// Client Apollo.io — API officielle REST d'enrichissement de contacts B2B.
// Doc : https://docs.apollo.io/reference/people-search
// Env : APOLLO_API_BASE_URL (default https://api.apollo.io/api/v1)

import "server-only";

export interface ApolloSearchParams {
  keywords?: string;
  title?: string;
  company?: string;
  location?: string;
  limit?: number; // per_page (max 100)
}

export interface ApolloContact {
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  location?: string;
}

function base(): string {
  const url = process.env.APOLLO_API_BASE_URL ?? "https://api.apollo.io/api/v1";
  return url.replace(/\/+$/, "");
}

type ApolloPerson = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: { name?: string };
};

export async function searchPeople(
  params: ApolloSearchParams,
  apiKey: string
): Promise<ApolloContact[]> {
  const body: Record<string, unknown> = {
    per_page: Math.min(params.limit ?? 25, 100),
  };
  if (params.keywords) body.q_keywords = params.keywords;
  if (params.title) body.person_titles = [params.title];
  if (params.company) body.q_organization_name = params.company;
  if (params.location) body.person_locations = [params.location];

  const res = await fetch(`${base()}/mixed_people/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apollo search ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { people?: ApolloPerson[] };
  return (json.people ?? []).map(toContact);
}

function toContact(p: ApolloPerson): ApolloContact {
  const full_name =
    p.name ??
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ??
    "—";
  const location = [p.city, p.state, p.country].filter(Boolean).join(", ");
  return {
    full_name: full_name || "—",
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email && p.email !== "email_not_unlocked@domain.com" ? p.email : undefined,
    title: p.title,
    company: p.organization?.name,
    linkedin_url: p.linkedin_url,
    location: location || undefined,
  };
}

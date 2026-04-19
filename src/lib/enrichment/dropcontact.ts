// Dropcontact — enrichissement email / société à partir de nom+entreprise, conforme RGPD.
// Doc : https://developer.dropcontact.com/
// API asynchrone : POST /batch → request_id → GET /batch/{id}

import "server-only";

export type DropcontactInput = {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string; // ils attendent `company` ou `website`
  website?: string;
};

export type DropcontactOutput = {
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  website?: string;
  linkedin?: string;
  civility?: string;
  phone?: string;
};

const BASE = "https://api.dropcontact.io";

export async function enrichBatch(
  rows: DropcontactInput[],
  apiKey: string,
  opts: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<DropcontactOutput[]> {
  if (rows.length === 0) return [];
  const start = await fetch(`${BASE}/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Access-Token": apiKey },
    body: JSON.stringify({ data: rows, siren: true, language: "fr" }),
  });
  if (!start.ok) throw new Error(`Dropcontact batch ${start.status}: ${await start.text()}`);
  const { request_id } = (await start.json()) as { request_id?: string };
  if (!request_id) throw new Error("Dropcontact : pas de request_id");

  const timeout = opts.timeoutMs ?? 120_000;
  const poll = opts.pollIntervalMs ?? 4_000;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, poll));
    const res = await fetch(`${BASE}/batch/${request_id}`, {
      headers: { "X-Access-Token": apiKey },
    });
    if (!res.ok) throw new Error(`Dropcontact poll ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      success?: boolean;
      data?: DropcontactOutput[];
      error?: string;
    };
    if (json.success === true) return json.data ?? [];
    if (json.success === false && json.error) throw new Error(`Dropcontact: ${json.error}`);
  }
  throw new Error("Dropcontact : timeout d'enrichissement");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getLinkedinSenderForUser } from "@/lib/senders/linkedin";
import { searchPeople as apolloSearchPeople } from "@/lib/clients/apollo";
import { enrichBatch as dropcontactEnrichBatch } from "@/lib/enrichment/dropcontact";
import { getDecryptedCredential } from "../integrations/actions";

async function getUserId(): Promise<string> {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

const contactSchema = z.object({
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  linkedin_url: z.string().trim().url().optional().or(z.literal("")),
  company_name: z.string().trim().optional(),
  role: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

function cleanOptional<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === undefined) delete out[k];
  }
  return out;
}

export async function createContactAction(fd: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(fd);
  const tags = String(fd.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const parsed = contactSchema.safeParse({ ...raw, tags });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("contacts").insert({
    user_id: userId,
    ...cleanOptional(parsed.data),
    tags: parsed.data.tags,
  });
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateContactTagsAction(contactId: string, tags: string[]) {
  const userId = await getUserId();
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("contacts")
    .update({ tags: cleaned })
    .eq("id", contactId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteContactAction(contactId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin.from("contacts").delete().eq("id", contactId).eq("user_id", userId);
  revalidatePath("/contacts");
  return { ok: true };
}

// Import CSV : l'utilisateur colle un CSV avec en-têtes.
// Colonnes reconnues (insensibles à la casse, aliases FR) :
//   prenom/first_name, nom/last_name, email, entreprise/company, role,
//   linkedin, tags (séparés par ; ou |)
const HEADER_ALIASES: Record<string, string> = {
  prenom: "first_name",
  firstname: "first_name",
  "first name": "first_name",
  nom: "last_name",
  lastname: "last_name",
  "last name": "last_name",
  email: "email",
  mail: "email",
  entreprise: "company_name",
  societe: "company_name",
  company: "company_name",
  "company name": "company_name",
  role: "role",
  poste: "role",
  linkedin: "linkedin_url",
  "linkedin url": "linkedin_url",
  tags: "tags",
};

function normHeader(h: string): string {
  return h.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => HEADER_ALIASES[normHeader(h)] ?? normHeader(h));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delim);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export async function importContactsCsvAction(csvText: string) {
  const userId = await getUserId();
  const rows = parseCSV(csvText);
  if (rows.length === 0) return { error: "CSV vide ou invalide." };

  const toInsert = rows.map((r) => ({
    user_id: userId,
    first_name: r.first_name || null,
    last_name: r.last_name || null,
    email: r.email || null,
    linkedin_url: r.linkedin_url || null,
    company_name: r.company_name || null,
    role: r.role || null,
    tags: (r.tags ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean),
    source: "csv_import",
  }));

  const admin = createSupabaseAdmin();
  const { error, count } = await admin
    .from("contacts")
    .insert(toInsert, { count: "exact" });
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { ok: true, imported: count ?? toInsert.length };
}

// ============================================================
// Recherche + import LinkedIn (provider OutX ou Unipile si expose searchProfiles)
// ============================================================
const searchSchema = z.object({
  keywords: z.string().trim().min(1, "Mots-clés requis"),
  title: z.string().trim().optional(),
  company: z.string().trim().optional(),
  location: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function searchAndImportLinkedinContactsAction(fd: FormData) {
  const userId = await getUserId();
  const parsed = searchSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let sender;
  try {
    sender = await getLinkedinSenderForUser(userId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!sender.searchProfiles) {
    return { error: "Le provider actif ne supporte pas la recherche (configure OutX)." };
  }

  let profiles;
  try {
    profiles = await sender.searchProfiles(parsed.data);
  } catch (e) {
    return { error: `Recherche LinkedIn échouée : ${(e as Error).message}` };
  }

  const urls = profiles.map((p) => p.linkedin_url).filter(Boolean);
  if (urls.length === 0) return { ok: true, imported: 0, skipped: 0 };

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("contacts")
    .select("linkedin_url")
    .eq("user_id", userId)
    .in("linkedin_url", urls);
  const existingSet = new Set((existing ?? []).map((r) => r.linkedin_url));

  const toInsert = profiles
    .filter((p) => p.linkedin_url && !existingSet.has(p.linkedin_url))
    .map((p) => {
      const [first, ...rest] = (p.full_name || "").split(" ");
      return {
        user_id: userId,
        first_name: first || null,
        last_name: rest.join(" ") || null,
        email: p.email || null,
        linkedin_url: p.linkedin_url,
        company_name: p.company || null,
        role: p.title || p.headline || null,
        source: `linkedin_search_${sender!.provider}`,
      };
    });

  if (toInsert.length === 0) {
    revalidatePath("/contacts");
    return { ok: true, imported: 0, skipped: profiles.length };
  }

  const { error } = await admin.from("contacts").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { ok: true, imported: toInsert.length, skipped: profiles.length - toInsert.length };
}

// ============================================================
// Recherche + import Apollo
// ============================================================
export async function apolloSearchAndImportContactsAction(fd: FormData) {
  const userId = await getUserId();
  const parsed = searchSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const creds = await getDecryptedCredential<{ api_key: string }>(userId, "apollo");
  if (!creds?.api_key) return { error: "Apollo non configuré (Intégrations → Apollo)." };

  let leads;
  try {
    leads = await apolloSearchPeople(parsed.data, creds.api_key);
  } catch (e) {
    return { error: `Apollo : ${(e as Error).message}` };
  }
  if (leads.length === 0) return { ok: true, imported: 0, skipped: 0 };

  // Dédup sur email OU linkedin_url (union des deux clés)
  const emails = leads.map((l) => l.email).filter(Boolean) as string[];
  const urls = leads.map((l) => l.linkedin_url).filter(Boolean) as string[];

  const admin = createSupabaseAdmin();
  const existingEmails = new Set<string>();
  const existingUrls = new Set<string>();
  if (emails.length > 0) {
    const { data } = await admin.from("contacts").select("email").eq("user_id", userId).in("email", emails);
    for (const r of data ?? []) if (r.email) existingEmails.add(r.email);
  }
  if (urls.length > 0) {
    const { data } = await admin.from("contacts").select("linkedin_url").eq("user_id", userId).in("linkedin_url", urls);
    for (const r of data ?? []) if (r.linkedin_url) existingUrls.add(r.linkedin_url);
  }

  const toInsert = leads
    .filter((l) => {
      if (l.email && existingEmails.has(l.email)) return false;
      if (l.linkedin_url && existingUrls.has(l.linkedin_url)) return false;
      return true;
    })
    .map((l) => ({
      user_id: userId,
      first_name: l.first_name || null,
      last_name: l.last_name || null,
      email: l.email || null,
      linkedin_url: l.linkedin_url || null,
      company_name: l.company || null,
      role: l.title || null,
      source: "apollo",
    }));

  if (toInsert.length === 0) {
    revalidatePath("/contacts");
    return { ok: true, imported: 0, skipped: leads.length };
  }

  const { error } = await admin.from("contacts").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { ok: true, imported: toInsert.length, skipped: leads.length - toInsert.length };
}

// ============================================================
// Enrichissement Dropcontact : emails pro manquants
// ============================================================
export async function enrichMissingEmailsWithDropcontactAction() {
  const userId = await getUserId();
  const creds = await getDecryptedCredential<{ api_key: string }>(userId, "dropcontact");
  if (!creds?.api_key) return { error: "Dropcontact non configuré (Intégrations → Dropcontact)." };

  const admin = createSupabaseAdmin();
  const { data: targets } = await admin
    .from("contacts")
    .select("id, first_name, last_name, company_name")
    .eq("user_id", userId)
    .is("email", null)
    .not("last_name", "is", null)
    .not("company_name", "is", null)
    .limit(50);

  if (!targets || targets.length === 0) {
    return { ok: true, enriched: 0, message: "Aucun contact à enrichir (email manquant + nom + entreprise requis)." };
  }

  let enriched;
  try {
    enriched = await dropcontactEnrichBatch(
      targets.map((t) => ({
        first_name: t.first_name ?? undefined,
        last_name: t.last_name ?? undefined,
        company: t.company_name ?? undefined,
      })),
      creds.api_key
    );
  } catch (e) {
    return { error: `Dropcontact : ${(e as Error).message}` };
  }

  let updated = 0;
  for (let i = 0; i < targets.length; i++) {
    const row = enriched[i];
    if (!row?.email) continue;
    const { error } = await admin
      .from("contacts")
      .update({ email: row.email })
      .eq("id", targets[i].id)
      .eq("user_id", userId);
    if (!error) updated++;
  }

  revalidatePath("/contacts");
  return { ok: true, enriched: updated, total: targets.length };
}

// ============================================================
// Statut providers (pour UI conditionnelle)
// ============================================================
export async function getContactsProvidersStatusAction() {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("user_integrations")
    .select("provider, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);
  const providers = new Set((data ?? []).map((r) => r.provider));
  return {
    linkedin: providers.has("outx") || providers.has("unipile"),
    linkedinSearch: providers.has("outx"), // seul OutX expose searchProfiles
    apollo: providers.has("apollo"),
    dropcontact: providers.has("dropcontact"),
  };
}

export async function listUserTagsAction(): Promise<Array<{ tag: string; usage_count: number }>> {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("list_user_tags", { p_user: userId });
  return (data ?? []) as Array<{ tag: string; usage_count: number }>;
}

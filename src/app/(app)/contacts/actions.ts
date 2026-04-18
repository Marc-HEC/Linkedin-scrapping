"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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

export async function listUserTagsAction(): Promise<Array<{ tag: string; usage_count: number }>> {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("list_user_tags", { p_user: userId });
  return (data ?? []) as Array<{ tag: string; usage_count: number }>;
}

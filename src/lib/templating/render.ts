// Parser de templates avec variables entre crochets : [Prénom], [NomEntreprise], etc.
// - Remplace les variables par les valeurs du contact.
// - Supporte les accents et les alias FR (Prénom, Société, Poste...).
// - \[ permet d'échapper un crochet littéral.

const VAR_RE = /(?<!\\)\[([^\]\n]+)\]/g;

export const FR_ALIASES: Record<string, string> = {
  prenom: "first_name",
  firstname: "first_name",
  nom: "last_name",
  lastname: "last_name",
  nomentreprise: "company_name",
  entreprise: "company_name",
  societe: "company_name",
  company: "company_name",
  role: "role",
  poste: "role",
  fonction: "role",
  secteur: "industry",
  industry: "industry",
  pays: "country",
  email: "email",
  linkedin: "linkedin_url",
};

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
}

export type RenderContext = Record<string, unknown>;

export interface RenderResult {
  output: string;
  missing: string[];
}

export function renderTemplate(
  tpl: string,
  ctx: RenderContext,
  opts: { placeholder?: string | null; aliases?: Record<string, string> } = {}
): RenderResult {
  const aliases = { ...FR_ALIASES, ...(opts.aliases ?? {}) };
  const missing = new Set<string>();

  const output = tpl.replace(VAR_RE, (_match, raw: string) => {
    const key = aliases[slug(raw)] ?? slug(raw);
    const val = pickValue(ctx, key) ?? pickValue(ctx, raw);
    if (val === undefined || val === null || val === "") {
      missing.add(raw);
      return opts.placeholder ?? `[${raw}]`;
    }
    return String(val);
  }).replace(/\\\[/g, "[");

  return { output, missing: [...missing] };
}

// Va chercher la valeur dans le contact puis dans custom_fields (avec slug).
function pickValue(ctx: RenderContext, key: string): unknown {
  if (key in ctx) return ctx[key];
  const cf = ctx.custom_fields as Record<string, unknown> | undefined;
  if (cf && typeof cf === "object") {
    if (key in cf) return cf[key];
    for (const k of Object.keys(cf)) {
      if (slug(k) === slug(key)) return cf[k];
    }
  }
  return undefined;
}

export function extractVariables(tpl: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(VAR_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) found.add(m[1]);
  return [...found];
}

// ============================================================
// Rendu Mistral : délègue TOUS les [placeholders] à l'IA.
// Utilisé au lancement de campagne quand Mistral est configuré.
// ============================================================

export type ContactContext = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  company_name?: string | null;
  role?: string | null;
  industry?: string | null;
  country?: string | null;
  [key: string]: unknown;
};

export async function renderTemplateWithMistral(
  template: string,
  contact: ContactContext,
  creds: { api_key: string; model?: string }
): Promise<string> {
  const model = creds.model ?? "mistral-small-latest";

  const contextLines = [
    contact.first_name && `- Prénom : ${contact.first_name}`,
    contact.last_name && `- Nom : ${contact.last_name}`,
    contact.company_name && `- Entreprise : ${contact.company_name}`,
    contact.role && `- Rôle / Poste : ${contact.role}`,
    contact.industry && `- Secteur : ${contact.industry}`,
    contact.country && `- Pays : ${contact.country}`,
    contact.linkedin_url && `- LinkedIn : ${contact.linkedin_url}`,
    contact.email && `- Email : ${contact.email}`,
  ].filter(Boolean).join("\n") || "- (aucune donnée connue)";

  const systemPrompt = `Tu es un expert en prospection B2B. Tu reçois un template de message commercial
contenant des variables entre crochets comme [prénom], [activité de l'entreprise], [problème principal], etc.
Ton rôle : remplacer CHAQUE variable par une valeur pertinente et naturelle pour ce contact précis.
Pour les variables qui correspondent aux données du contact (prénom, entreprise, rôle…), utilise-les directement.
Pour les variables contextuelles ([actualité récente], [secteur], [produit principal]…), infère une valeur réaliste depuis tes connaissances.
Règles strictes :
- Renvoie UNIQUEMENT le message final, sans commentaires ni introduction.
- Ne laisse aucun crochet dans la réponse.
- Respecte la structure, la langue et le ton du template.
- Max 800 caractères pour un message LinkedIn (connexion), 1500 pour un email.`;

  const userPrompt = `Informations contact :
${contextLines}

Template :
${template}`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral render ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Mistral : réponse vide");
  return out;
}

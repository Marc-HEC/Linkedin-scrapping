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

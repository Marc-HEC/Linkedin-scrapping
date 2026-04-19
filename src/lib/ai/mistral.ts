// Raffinement de messages via Mistral AI.
// Utilisé optionnellement avant envoi pour adoucir / personnaliser un message.

import "server-only";

export type MistralCreds = {
  api_key: string;
  model?: string;
};

const DEFAULT_MODEL = "mistral-small-latest";
const SYSTEM_PROMPT = `Tu es un expert en prospection B2B écrite en français.
Reformule le message fourni pour le rendre naturel, chaleureux et concis (max 800 caractères).
Garde toutes les variables déjà substituées (noms, entreprises, rôles).
Ne change pas le sens ni l'appel à l'action. Réponds uniquement par le message reformulé,
sans introduction, sans guillemets, sans signature ajoutée.`;

export async function refineMessage(
  creds: MistralCreds,
  raw: string
): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: creds.model ?? DEFAULT_MODEL,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: raw },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Mistral : réponse vide");
  return out;
}

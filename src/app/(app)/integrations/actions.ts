"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptWithDek, decryptWithDek, last4 } from "@/lib/crypto/encrypt";
import {
  smtpSchema, mistralSchema, unipileSchema, dropcontactSchema,
  outxSchema, apolloSchema,
  type SmtpConfig, type MistralConfig, type UnipileConfig, type DropcontactConfig,
  type OutxConfig, type ApolloConfig,
} from "@/schemas/integration.schema";

type Provider = "smtp" | "mistral" | "unipile" | "dropcontact" | "outx" | "apollo";

/** Récupère la DEK chiffrée (base64 TEXT) de l'utilisateur via service_role */
async function getUserDek(userId: string): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("encrypted_dek")
    .eq("id", userId)
    .single();
  if (error || !data?.encrypted_dek) throw new Error("DEK introuvable");
  return data.encrypted_dek as string;
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Non authentifié");
  return user;
}

async function saveIntegration(
  userId: string,
  provider: Provider,
  payload: Record<string, unknown>,
  last4Value: string
) {
  const encryptedDek = await getUserDek(userId);
  const blob = encryptWithDek(encryptedDek, payload);
  const admin = createSupabaseAdmin();

  await admin.from("user_integrations").upsert(
    {
      user_id: userId,
      provider,
      encrypted_payload: blob.ciphertext,
      iv: blob.iv,
      auth_tag: blob.authTag,
      last4: last4Value,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  // Audit
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "integration.upserted",
    entity_type: "user_integrations",
    metadata: { provider },
  });
}

// ---- SMTP ----
export async function saveSMTPAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = smtpSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as SmtpConfig;

  // Test de connexion (vérification SMTP basique)
  if (fd.get("test") === "true") {
    try {
      await testSmtpConnection(cfg);
      return { ok: true, tested: true };
    } catch (err: unknown) {
      return { error: `Connexion SMTP échouée : ${(err as Error).message}` };
    }
  }

  await saveIntegration(user.id, "smtp", cfg, last4(cfg.password));
  return { ok: true };
}

async function testSmtpConnection(cfg: SmtpConfig) {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  await transporter.verify();
}

// ---- Mistral ----
export async function saveMistralAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = mistralSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as MistralConfig;

  if (fd.get("test") === "true") {
    const ok = await testMistralKey(cfg.api_key);
    if (!ok) return { error: "Clé Mistral invalide ou quota dépassé." };
    return { ok: true, tested: true };
  }

  await saveIntegration(user.id, "mistral", cfg, last4(cfg.api_key));
  return { ok: true };
}

async function testMistralKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Unipile ----
export async function saveUnipileAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = unipileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as UnipileConfig;
  await saveIntegration(user.id, "unipile", cfg, last4(cfg.api_key));
  return { ok: true };
}

// ---- Dropcontact ----
export async function saveDropcontactAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = dropcontactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as DropcontactConfig;
  await saveIntegration(user.id, "dropcontact", cfg, last4(cfg.api_key));
  return { ok: true };
}

// ---- OutX ----
export async function saveOutxAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = outxSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as OutxConfig;
  await saveIntegration(user.id, "outx", cfg, last4(cfg.api_key));
  return { ok: true };
}

// ---- Apollo ----
export async function saveApolloAction(fd: FormData) {
  const user = await getAuthenticatedUser();
  const parsed = apolloSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cfg = parsed.data as ApolloConfig;
  await saveIntegration(user.id, "apollo", cfg, last4(cfg.api_key));
  return { ok: true };
}

// ---- Suppression ----
export async function deleteIntegrationAction(provider: Provider) {
  const user = await getAuthenticatedUser();
  const admin = createSupabaseAdmin();
  await admin.from("user_integrations")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("provider", provider);
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "integration.deactivated",
    entity_type: "user_integrations",
    metadata: { provider },
  });
  return { ok: true };
}

// ---- Lecture statut (sans payload) ----
export async function getIntegrationsStatusAction() {
  const user = await getAuthenticatedUser();
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("user_integrations")
    .select("provider, is_active, last4, last_verified_at, updated_at")
    .eq("user_id", user.id);
  return data ?? [];
}

// ---- Utilitaire interne : récupère credentials déchiffrés (server-only) ----
export async function getDecryptedCredential<T>(userId: string, provider: Provider): Promise<T | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("user_integrations")
    .select("encrypted_payload, iv, auth_tag")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .single();

  if (!data) return null;

  const encryptedDek = await getUserDek(userId);
  return decryptWithDek<T>(encryptedDek, {
    ciphertext: data.encrypted_payload as string,
    iv: data.iv as string,
    authTag: data.auth_tag as string,
  });
}

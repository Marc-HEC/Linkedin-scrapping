"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { renderTemplate, renderTemplateWithMistral } from "@/lib/templating/render";
import { getDecryptedCredential } from "../integrations/actions";
import { sendViaSmtp, type SmtpCreds } from "@/lib/senders/email";
import { getLinkedinSenderForUser } from "@/lib/senders/linkedin";
import { makeUnsubscribeToken } from "@/lib/crypto/encrypt";
import type { MistralConfig } from "@/schemas/integration.schema";

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function withUnsubFooter(userId: string, toEmail: string, body: string): string {
  const token = makeUnsubscribeToken(userId, toEmail);
  const url = `${appUrl()}/unsubscribe/${token}`;
  return `${body}\n\n—\nPour ne plus recevoir ce type de message : ${url}`;
}

async function getUserId(): Promise<string> {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

export type MatchedContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  role: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  match_count: number;
  position_score: number;
};

export async function previewMatchesAction(
  tagsPriority: string[],
  limit = 500
): Promise<MatchedContact[]> {
  const userId = await getUserId();
  if (tagsPriority.length === 0) return [];
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("match_contacts_by_tags", {
    p_user: userId,
    p_tags: tagsPriority,
    p_limit: limit,
  });
  return (data ?? []) as MatchedContact[];
}

type LaunchInput = {
  name: string;
  templateId: string;
  tagsPriority: string[];
  dailyQuota: number;
  throttleSeconds: number;
};

// Étape 1 : génère les messages avec Mistral et crée la campagne en statut "draft".
// L'utilisateur accède ensuite à /campaigns/[id] pour réviser avant d'envoyer.
export async function launchCampaignAction(input: LaunchInput) {
  const userId = await getUserId();

  if (!input.name?.trim()) return { error: "Nom de campagne requis." };
  if (!input.templateId) return { error: "Template requis." };
  if (!input.tagsPriority?.length) return { error: "Au moins un tag de ciblage requis." };

  const admin = createSupabaseAdmin();

  const { data: tpl } = await admin
    .from("templates")
    .select("id, channel, subject, body_text")
    .eq("id", input.templateId)
    .eq("user_id", userId)
    .single();
  if (!tpl) return { error: "Template introuvable." };

  const contacts = await previewMatchesAction(input.tagsPriority, input.dailyQuota);
  if (contacts.length === 0) return { error: "Aucun contact ne matche ces tags." };

  // Filtre GDPR
  const emails = contacts.map((c) => c.email).filter(Boolean) as string[];
  const suppressedSet = new Set<string>();
  if (emails.length > 0) {
    const { data: sup } = await admin
      .from("suppression_list")
      .select("email")
      .eq("user_id", userId)
      .in("email", emails);
    for (const row of sup ?? []) suppressedSet.add(row.email);
  }
  const eligible = contacts.filter((c) => !c.email || !suppressedSet.has(c.email));
  if (eligible.length === 0) {
    return { error: "Tous les contacts ciblés sont dans ta liste de suppression." };
  }

  const { data: campaign, error: cErr } = await admin
    .from("campaigns")
    .insert({
      user_id: userId,
      name: input.name,
      channel: tpl.channel,
      template_id: tpl.id,
      status: "draft",
      daily_quota: input.dailyQuota,
      throttle_seconds: input.throttleSeconds,
    })
    .select("id")
    .single();
  if (cErr || !campaign) return { error: cErr?.message ?? "Erreur création campagne." };

  const mistralCreds = await getDecryptedCredential<MistralConfig>(userId, "mistral");

  const rendered = await Promise.all(
    eligible.map(async (c) => {
      const ctx = { ...c, ...(c.custom_fields ?? {}) };
      let body: string;
      let aiRefined = false;
      if (mistralCreds?.api_key) {
        try {
          body = await renderTemplateWithMistral(tpl.body_text, ctx, mistralCreds);
          aiRefined = true;
        } catch {
          body = renderTemplate(tpl.body_text, ctx).output;
        }
      } else {
        body = renderTemplate(tpl.body_text, ctx).output;
      }
      let subject: string | null = null;
      if (tpl.subject) {
        if (mistralCreds?.api_key) {
          try {
            subject = await renderTemplateWithMistral(tpl.subject, ctx, mistralCreds);
          } catch {
            subject = renderTemplate(tpl.subject, ctx).output;
          }
        } else {
          subject = renderTemplate(tpl.subject, ctx).output;
        }
      }
      return { contact_id: c.id, subject, body, aiRefined };
    })
  );

  const messages = rendered.map((r) => ({
    user_id: userId,
    campaign_id: campaign.id,
    contact_id: r.contact_id,
    channel: tpl.channel,
    subject: r.subject,
    body_rendered: r.body,
    ai_refined: r.aiRefined,
    status: "pending" as const,
  }));

  const { error: mErr } = await admin.from("messages_generated").insert(messages);
  if (mErr) return { error: mErr.message };

  revalidatePath("/campaigns");
  // Retourne le campaignId pour rediriger vers la page de révision
  return { ok: true, campaignId: campaign.id, queued: messages.length, needsReview: true };
}

// Étape 2 : l'utilisateur a révisé les messages et valide l'envoi.
export async function confirmAndSendCampaignAction(campaignId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("status, user_id")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();
  if (!campaign) return { error: "Campagne introuvable." };
  if (campaign.status !== "draft") return { error: "Campagne déjà lancée." };

  await admin
    .from("campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", campaignId);

  after(() =>
    processCampaignSend(userId, campaignId).catch((e) =>
      console.error("[Campaign send error]", campaignId, e)
    )
  );

  revalidatePath("/campaigns");
  return { ok: true };
}

// Régénère le message d'un contact spécifique via Mistral.
export async function regenerateMessageAction(messageId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();

  const { data: msg } = await admin
    .from("messages_generated")
    .select("contact_id, campaign_id, channel")
    .eq("id", messageId)
    .eq("user_id", userId)
    .single();
  if (!msg) return { error: "Message introuvable." };

  const { data: campaign } = await admin
    .from("campaigns")
    .select("template_id")
    .eq("id", msg.campaign_id)
    .single();
  if (!campaign?.template_id) return { error: "Template introuvable." };

  const { data: tpl } = await admin
    .from("templates")
    .select("body_text, subject")
    .eq("id", campaign.template_id)
    .single();
  if (!tpl) return { error: "Template introuvable." };

  const { data: contact } = await admin
    .from("contacts")
    .select("first_name, last_name, email, linkedin_url, company_name, role, industry, country, custom_fields")
    .eq("id", msg.contact_id)
    .single();
  if (!contact) return { error: "Contact introuvable." };

  const mistralCreds = await getDecryptedCredential<MistralConfig>(userId, "mistral");
  if (!mistralCreds?.api_key) return { error: "Mistral non configuré." };

  const ctx = { ...contact, ...(contact.custom_fields ?? {}) };
  try {
    const newBody = await renderTemplateWithMistral(tpl.body_text, ctx, mistralCreds);
    await admin
      .from("messages_generated")
      .update({ body_rendered: newBody, ai_refined: true })
      .eq("id", messageId);
    return { ok: true, newBody };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Sauvegarde une édition manuelle du corps du message.
export async function updateMessageBodyAction(messageId: string, newBody: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("messages_generated")
    .update({ body_rendered: newBody.trim(), ai_refined: false })
    .eq("id", messageId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { ok: true };
}

// Arrête une campagne en cours ou en révision.
export async function stopCampaignAction(campaignId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin
    .from("campaigns")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("user_id", userId);
  await admin
    .from("messages_generated")
    .update({ status: "skipped", error_message: "Campagne arrêtée manuellement" })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  revalidatePath("/campaigns");
  return { ok: true };
}

async function processCampaignSend(userId: string, campaignId: string) {
  console.log("[Campaign] processCampaignSend START", { userId, campaignId });
  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("channel, throttle_seconds")
    .eq("id", campaignId)
    .single();
  if (!campaign) { console.error("[Campaign] campaign not found", campaignId); return; }
  console.log("[Campaign] channel=%s throttle=%ds", campaign.channel, campaign.throttle_seconds);

  const { data: pending } = await admin
    .from("messages_generated")
    .select("id, contact_id, subject, body_rendered, channel")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (!pending?.length) { console.log("[Campaign] no pending messages"); return; }
  console.log("[Campaign] pending messages:", pending.length);

  const { data: contactRows } = await admin
    .from("contacts")
    .select("id, email, linkedin_url, first_name, last_name")
    .in("id", pending.map((p) => p.contact_id));
  const contactsMap = new Map((contactRows ?? []).map((c) => [c.id, c]));

  if (campaign.channel === "email") {
    const creds = await getDecryptedCredential<SmtpCreds>(userId, "smtp");
    if (!creds) { await markAllFailed(campaignId, "SMTP non configuré."); return; }
    console.log("[Campaign] SMTP host=%s from=%s", creds.host, creds.from_email);
    for (const msg of pending) {
      if (await isCancelled(campaignId)) { console.log("[Campaign] cancelled, stopping loop"); break; }
      const c = contactsMap.get(msg.contact_id);
      if (!c?.email) {
        await admin.from("messages_generated").update({ status: "skipped", error_message: "Pas d'email" }).eq("id", msg.id);
        continue;
      }
      console.log("[Campaign] sending email to", c.email, "msgId=", msg.id);
      try {
        const providerId = await sendViaSmtp(creds, {
          to: c.email,
          subject: msg.subject ?? "",
          text: withUnsubFooter(userId, c.email, msg.body_rendered),
        });
        console.log("[Campaign] email sent providerId=", providerId);
        await admin.from("messages_generated").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId }).eq("id", msg.id);
      } catch (e) {
        console.error("[Campaign] email failed msgId=", msg.id, e);
        await admin.from("messages_generated").update({ status: "failed", error_message: (e as Error).message }).eq("id", msg.id);
      }
      await sleep(campaign.throttle_seconds * 1000);
    }
  } else {
    let sender;
    try {
      sender = await getLinkedinSenderForUser(userId);
      console.log("[Campaign] LinkedIn provider=", sender.provider);
    } catch (e) {
      console.error("[Campaign] LinkedIn sender init failed:", e);
      await markAllFailed(campaignId, (e as Error).message);
      return;
    }
    for (const msg of pending) {
      if (await isCancelled(campaignId)) { console.log("[Campaign] cancelled, stopping loop"); break; }
      const c = contactsMap.get(msg.contact_id);
      if (!c?.linkedin_url) {
        await admin.from("messages_generated").update({ status: "skipped", error_message: "Pas d'URL LinkedIn" }).eq("id", msg.id);
        continue;
      }
      console.log("[Campaign] LinkedIn send channel=%s url=%s msgId=%s", msg.channel, c.linkedin_url, msg.id);
      try {
        const result = msg.channel === "linkedin_connect"
          ? await sender.sendConnectionRequest({ linkedin_url: c.linkedin_url, text: msg.body_rendered })
          : await sender.sendMessage({ linkedin_url: c.linkedin_url, text: msg.body_rendered });
        console.log("[Campaign] LinkedIn sent providerMsgId=", result.providerMessageId);
        await admin.from("messages_generated").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId }).eq("id", msg.id);
      } catch (e) {
        console.error("[Campaign] LinkedIn failed msgId=", msg.id, e);
        await admin.from("messages_generated").update({ status: "failed", error_message: (e as Error).message }).eq("id", msg.id);
      }
      await sleep(campaign.throttle_seconds * 1000);
    }
  }

  const { data: check } = await createSupabaseAdmin().from("campaigns").select("status").eq("id", campaignId).single();
  if (check?.status !== "cancelled") {
    await admin.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", campaignId);
    console.log("[Campaign] processCampaignSend DONE", campaignId);
  }
}

async function isCancelled(campaignId: string): Promise<boolean> {
  const { data } = await createSupabaseAdmin().from("campaigns").select("status").eq("id", campaignId).single();
  return data?.status === "cancelled";
}

async function markAllFailed(campaignId: string, reason: string) {
  const admin = createSupabaseAdmin();
  await admin.from("messages_generated").update({ status: "failed", error_message: reason }).eq("campaign_id", campaignId).eq("status", "pending");
  await admin.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", campaignId);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

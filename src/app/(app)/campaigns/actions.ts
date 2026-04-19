"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/templating/render";
import { getDecryptedCredential } from "../integrations/actions";
import { sendViaSmtp, type SmtpCreds } from "@/lib/senders/email";
import { sendViaUnipile, type UnipileCreds } from "@/lib/senders/linkedin";

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

  const { data: profile } = await admin
    .from("profiles")
    .select("linkedin_mode")
    .eq("id", userId)
    .single();
  const linkedinMode = (profile?.linkedin_mode ?? "manual") as "manual" | "unipile";
  const isLinkedIn = tpl.channel === "linkedin_connect" || tpl.channel === "linkedin_message";
  const isManualLinkedIn = isLinkedIn && linkedinMode === "manual";

  const contacts = await previewMatchesAction(input.tagsPriority, input.dailyQuota);
  if (contacts.length === 0) return { error: "Aucun contact ne matche ces tags." };

  const { data: campaign, error: cErr } = await admin
    .from("campaigns")
    .insert({
      user_id: userId,
      name: input.name,
      channel: tpl.channel,
      template_id: tpl.id,
      status: "sending",
      daily_quota: input.dailyQuota,
      throttle_seconds: input.throttleSeconds,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (cErr || !campaign) return { error: cErr?.message ?? "Erreur création campagne." };

  // Génère les messages personnalisés (un par contact ciblé).
  const messages = contacts.map((c) => {
    const ctx = { ...c, ...(c.custom_fields ?? {}) };
    const body = renderTemplate(tpl.body_text, ctx).output;
    const subject = tpl.subject ? renderTemplate(tpl.subject, ctx).output : null;
    return {
      user_id: userId,
      campaign_id: campaign.id,
      contact_id: c.id,
      channel: tpl.channel,
      subject,
      body_rendered: body,
      status: "pending" as const,
    };
  });

  const { error: mErr } = await admin.from("messages_generated").insert(messages);
  if (mErr) return { error: mErr.message };

  if (isManualLinkedIn) {
    // Mode manuel : pas d'envoi automatique. L'utilisateur copie-colle depuis /campaigns/[id].
    revalidatePath("/campaigns");
    return { ok: true, campaignId: campaign.id, queued: messages.length, manual: true };
  }

  void processCampaignSend(userId, campaign.id).catch((e) =>
    console.error("Campaign send error:", e)
  );

  revalidatePath("/campaigns");
  return { ok: true, campaignId: campaign.id, queued: messages.length };
}

export async function markMessageSentAction(messageId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("messages_generated")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  return { ok: true };
}

export async function markCampaignCompletedAction(campaignId: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin
    .from("campaigns")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("user_id", userId);
  revalidatePath("/campaigns");
  return { ok: true };
}

async function processCampaignSend(userId: string, campaignId: string) {
  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("channel, throttle_seconds")
    .eq("id", campaignId)
    .single();
  if (!campaign) return;

  const { data: pending } = await admin
    .from("messages_generated")
    .select("id, contact_id, subject, body_rendered, channel")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (!pending?.length) return;

  const { data: contactRows } = await admin
    .from("contacts")
    .select("id, email, linkedin_url, first_name, last_name")
    .in("id", pending.map((p) => p.contact_id));
  const contactsMap = new Map((contactRows ?? []).map((c) => [c.id, c]));

  if (campaign.channel === "email") {
    const creds = await getDecryptedCredential<SmtpCreds>(userId, "smtp");
    if (!creds) {
      await markAllFailed(campaignId, "SMTP non configuré.");
      return;
    }
    for (const msg of pending) {
      const c = contactsMap.get(msg.contact_id);
      if (!c?.email) {
        await admin.from("messages_generated").update({
          status: "skipped", error_message: "Pas d'email",
        }).eq("id", msg.id);
        continue;
      }
      try {
        const providerId = await sendViaSmtp(creds, {
          to: c.email,
          subject: msg.subject ?? "",
          text: msg.body_rendered,
        });
        await admin.from("messages_generated").update({
          status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId,
        }).eq("id", msg.id);
      } catch (e) {
        await admin.from("messages_generated").update({
          status: "failed", error_message: (e as Error).message,
        }).eq("id", msg.id);
      }
      await sleep(campaign.throttle_seconds * 1000);
    }
  } else {
    // LinkedIn via Unipile
    const creds = await getDecryptedCredential<UnipileCreds>(userId, "unipile");
    if (!creds) {
      await markAllFailed(campaignId, "Unipile non configuré.");
      return;
    }
    for (const msg of pending) {
      const c = contactsMap.get(msg.contact_id);
      if (!c?.linkedin_url) {
        await admin.from("messages_generated").update({
          status: "skipped", error_message: "Pas d'URL LinkedIn",
        }).eq("id", msg.id);
        continue;
      }
      try {
        const providerId = await sendViaUnipile(creds, {
          linkedin_url: c.linkedin_url,
          text: msg.body_rendered,
          mode: msg.channel === "linkedin_connect" ? "invite" : "message",
        });
        await admin.from("messages_generated").update({
          status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId,
        }).eq("id", msg.id);
      } catch (e) {
        await admin.from("messages_generated").update({
          status: "failed", error_message: (e as Error).message,
        }).eq("id", msg.id);
      }
      await sleep(campaign.throttle_seconds * 1000);
    }
  }

  await admin.from("campaigns").update({
    status: "completed", completed_at: new Date().toISOString(),
  }).eq("id", campaignId);
}

async function markAllFailed(campaignId: string, reason: string) {
  const admin = createSupabaseAdmin();
  await admin.from("messages_generated").update({
    status: "failed", error_message: reason,
  }).eq("campaign_id", campaignId).eq("status", "pending");
  await admin.from("campaigns").update({
    status: "completed", completed_at: new Date().toISOString(),
  }).eq("id", campaignId);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

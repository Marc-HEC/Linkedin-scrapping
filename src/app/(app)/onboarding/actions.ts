"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { saveSMTPAction } from "@/app/(app)/integrations/actions";

export async function saveProfileStep(fd: FormData) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const full_name = (fd.get("full_name") as string).trim();
  const company_name = (fd.get("company_name") as string).trim();
  const sender_identity = (fd.get("sender_identity") as string).trim();

  if (!full_name || !company_name) return { error: "Nom et entreprise requis." };

  const admin = createSupabaseAdmin();
  await admin.from("profiles").update({ full_name, company_name, sender_identity }).eq("id", user.id);

  return { ok: true };
}

export async function saveSmtpOnboarding(fd: FormData) {
  return saveSMTPAction(fd);
}

export async function completeOnboarding() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const admin = createSupabaseAdmin();
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "onboarding.completed",
  });

  redirect("/dashboard");
}

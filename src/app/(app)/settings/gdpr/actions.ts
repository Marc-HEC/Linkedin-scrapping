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

const suppressSchema = z.object({
  email: z.string().trim().email("Email invalide"),
  reason: z.enum(["unsubscribe", "bounce", "complaint", "manual"]).default("manual"),
});

export async function addSuppressionAction(fd: FormData) {
  const userId = await getUserId();
  const parsed = suppressSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("suppression_list")
    .upsert(
      { user_id: userId, email: parsed.data.email.toLowerCase(), reason: parsed.data.reason },
      { onConflict: "user_id,email" }
    );
  if (error) return { error: error.message };

  revalidatePath("/settings/gdpr");
  return { ok: true };
}

export async function removeSuppressionAction(id: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin.from("suppression_list").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/settings/gdpr");
  return { ok: true };
}

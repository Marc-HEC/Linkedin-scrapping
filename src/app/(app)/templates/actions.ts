"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { extractVariables } from "@/lib/templating/render";

async function getUserId(): Promise<string> {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nom requis"),
  channel: z.enum(["email", "linkedin_connect", "linkedin_message"]),
  subject: z.string().trim().optional().nullable(),
  body_text: z.string().min(1, "Corps requis"),
});

export async function saveTemplateAction(fd: FormData) {
  const userId = await getUserId();
  const input = {
    id: (fd.get("id") as string) || undefined,
    name: fd.get("name") as string,
    channel: fd.get("channel") as string,
    subject: (fd.get("subject") as string) || null,
    body_text: fd.get("body_text") as string,
  };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const variables = extractVariables(parsed.data.body_text + " " + (parsed.data.subject ?? ""));
  const admin = createSupabaseAdmin();

  if (parsed.data.id) {
    const { error } = await admin
      .from("templates")
      .update({
        name: parsed.data.name,
        channel: parsed.data.channel,
        subject: parsed.data.subject,
        body_text: parsed.data.body_text,
        variables_used: variables,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("templates").insert({
      user_id: userId,
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body_text: parsed.data.body_text,
      variables_used: variables,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplateAction(id: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin.from("templates").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/templates");
  return { ok: true };
}

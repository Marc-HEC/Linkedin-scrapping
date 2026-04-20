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

export type TagFilter = { tag: string; required: boolean };

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  tag_filters: TagFilter[];
  created_at: string;
  updated_at: string;
};

const segmentSchema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  description: z.string().trim().optional().nullable(),
  tag_filters: z.array(z.object({
    tag: z.string().trim().min(1),
    required: z.boolean(),
  })),
});

export async function getSegmentsAction(): Promise<Segment[]> {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("segments")
    .select("id, name, description, tag_filters, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as Segment[];
}

export async function createSegmentAction(
  name: string,
  description: string | null,
  tagFilters: TagFilter[]
) {
  const userId = await getUserId();
  const parsed = segmentSchema.safeParse({ name, description, tag_filters: tagFilters });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("segments").insert({
    user_id: userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    tag_filters: parsed.data.tag_filters,
  });
  if (error) return { error: error.message };
  revalidatePath("/segments");
  return { ok: true };
}

export async function updateSegmentAction(
  id: string,
  name: string,
  description: string | null,
  tagFilters: TagFilter[]
) {
  const userId = await getUserId();
  const parsed = segmentSchema.safeParse({ name, description, tag_filters: tagFilters });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("segments")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tag_filters: parsed.data.tag_filters,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/segments");
  return { ok: true };
}

export async function deleteSegmentAction(id: string) {
  const userId = await getUserId();
  const admin = createSupabaseAdmin();
  await admin.from("segments").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/segments");
  return { ok: true };
}

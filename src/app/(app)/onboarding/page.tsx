import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name, sender_identity, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <OnboardingWizard
        defaultName={profile?.full_name ?? ""}
        defaultCompany={profile?.company_name ?? ""}
        defaultSenderIdentity={profile?.sender_identity ?? ""}
      />
    </div>
  );
}

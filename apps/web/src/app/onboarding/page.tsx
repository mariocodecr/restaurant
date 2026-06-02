import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if ((count ?? 0) > 0) redirect("/dashboard");

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <OnboardingWizard ownerName={user.user_metadata.full_name ?? ""} />
      </div>
    </main>
  );
}

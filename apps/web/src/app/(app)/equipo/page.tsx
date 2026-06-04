import { redirect } from "next/navigation";

import { TeamView } from "@/components/team/team-view";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("is_active", true)
    .limit(1);
  if (!memberships || memberships.length === 0) redirect("/onboarding");
  const currentOrgId = memberships[0]!.organization_id;

  const [{ data: members, error: membersErr }, { data: branches }] =
    await Promise.all([
      supabase.rpc("list_org_members", { target_org_id: currentOrgId }),
      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true)
        .order("name"),
    ]);

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <TeamView
        organizationId={currentOrgId}
        currentUserId={user.id}
        initialMembers={members ?? []}
        branches={branches ?? []}
        loadError={membersErr?.message ?? null}
      />
    </div>
  );
}

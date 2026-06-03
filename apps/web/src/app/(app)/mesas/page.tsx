import { redirect } from "next/navigation";

import { TablesView } from "@/components/tables/tables-view";
import { createClient } from "@/lib/supabase/server";

export default async function MesasPage() {
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

  const [{ data: branches }, { data: tables }] = await Promise.all([
    supabase
      .from("branches")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("tables")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <TablesView
        organizationId={currentOrgId}
        initialBranches={branches ?? []}
        initialTables={tables ?? []}
      />
    </div>
  );
}

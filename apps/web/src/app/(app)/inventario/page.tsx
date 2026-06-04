import { redirect } from "next/navigation";

import { InventoryView } from "@/components/inventory/inventory-view";
import { createClient } from "@/lib/supabase/server";

export default async function InventarioPage() {
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

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", currentOrgId)
    .eq("is_active", true)
    .order("name");

  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("*")
    .eq("organization_id", currentOrgId)
    .order("sort_order")
    .order("name");

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <InventoryView
        organizationId={currentOrgId}
        branches={branches ?? []}
        initialIngredients={ingredients ?? []}
      />
    </div>
  );
}

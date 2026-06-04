import { redirect } from "next/navigation";

import { MenuView } from "@/components/menu/menu-view";
import { createClient } from "@/lib/supabase/server";

export default async function MenuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The (app) layout already enforces membership, but we still need the
  // current org id to scope mutations. For now pick the first; later this
  // will read the active-org cookie set by the OrgSwitcher.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("is_active", true)
    .limit(1);

  if (!memberships || memberships.length === 0) redirect("/onboarding");
  const currentOrgId = memberships[0]!.organization_id;

  const [{ data: categories }, { data: products }, { data: org }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("products")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("organizations")
        .select("currency")
        .eq("id", currentOrgId)
        .maybeSingle(),
    ]);

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <MenuView
        organizationId={currentOrgId}
        initialCategories={categories ?? []}
        initialProducts={products ?? []}
        currency={org?.currency ?? "CRC"}
      />
    </div>
  );
}

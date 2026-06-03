import { redirect } from "next/navigation";

import { OrdersList } from "@/components/orders/orders-list";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
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

  const [{ data: orders }, { data: tables }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("opened_at", { ascending: false })
      .limit(100),
    supabase
      .from("tables")
      .select("id, name, branch_id")
      .eq("organization_id", currentOrgId),
  ]);

  const tableLookup = new Map(
    (tables ?? []).map((t) => [t.id, t.name as string]),
  );

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <OrdersList
        orders={orders ?? []}
        tableLookup={Object.fromEntries(tableLookup)}
      />
    </div>
  );
}

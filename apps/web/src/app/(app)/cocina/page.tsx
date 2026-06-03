import { redirect } from "next/navigation";

import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { createClient } from "@/lib/supabase/server";

// The KDS lives off realtime. We seed it with the current snapshot so the
// first paint isn't empty, then the client subscribes for updates.
export default async function CocinaPage() {
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

  const [{ data: orders }, { data: branches }, { data: tables }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("organization_id", currentOrgId)
        .in("status", ["preparing", "ready"])
        .order("opened_at", { ascending: true }),
      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true),
      supabase
        .from("tables")
        .select("id, name, branch_id")
        .eq("organization_id", currentOrgId),
    ]);

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <KitchenBoard
        organizationId={currentOrgId}
        branches={branches ?? []}
        initialOrders={orders ?? []}
        initialItems={items ?? []}
        tableLookup={Object.fromEntries(
          (tables ?? []).map((t) => [t.id, t.name as string]),
        )}
      />
    </div>
  );
}

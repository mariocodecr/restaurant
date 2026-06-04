import { redirect } from "next/navigation";

import { BillingView } from "@/components/billing/billing-view";
import { createClient } from "@/lib/supabase/server";

export default async function BillingPage() {
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

  // Por cobrar = delivered (waiting for payment). Aggregate payments to
  // show how much is already covered per order.
  const [{ data: pendingOrders }, { data: invoices }, { data: tables }, { data: org }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, table_id, total, opened_at, delivered_at")
        .eq("organization_id", currentOrgId)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("issued_at", { ascending: false })
        .limit(200),
      supabase
        .from("tables")
        .select("id, name")
        .eq("organization_id", currentOrgId),
      supabase
        .from("organizations")
        .select("currency")
        .eq("id", currentOrgId)
        .maybeSingle(),
    ]);

  // Sum of payments per order — for pending orders only.
  const orderIds = (pendingOrders ?? []).map((o) => o.id);
  const { data: rawPayments } = orderIds.length
    ? await supabase
        .from("payments")
        .select("order_id, amount")
        .in("order_id", orderIds)
    : { data: [] };

  const paidByOrder = new Map<string, number>();
  for (const p of rawPayments ?? []) {
    paidByOrder.set(
      p.order_id,
      (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount),
    );
  }

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <BillingView
        currency={org?.currency ?? "CRC"}
        pendingOrders={(pendingOrders ?? []).map((o) => ({
          ...o,
          paidSoFar: paidByOrder.get(o.id) ?? 0,
        }))}
        invoices={invoices ?? []}
        tableLookup={Object.fromEntries(
          (tables ?? []).map((t) => [t.id, t.name as string]),
        )}
      />
    </div>
  );
}

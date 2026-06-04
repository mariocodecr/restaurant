import { notFound, redirect } from "next/navigation";

import { PaymentView } from "@/components/billing/payment-view";
import { createClient } from "@/lib/supabase/server";

interface CobrarPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function CobrarPage({ params }: CobrarPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: order }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_name_snapshot, quantity, unit_price, line_total")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (!order) notFound();

  // If the order is already paid, jump straight to the invoice. If it
  // was cancelled, send the user back to the list.
  if (order.status === "paid") {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (invoice) redirect(`/facturacion/${invoice.id}`);
  }
  if (order.status === "cancelled") redirect("/facturacion");

  const { data: tables } = await supabase
    .from("tables")
    .select("id, name")
    .eq("organization_id", order.organization_id);

  const { data: org } = await supabase
    .from("organizations")
    .select("currency")
    .eq("id", order.organization_id)
    .maybeSingle();

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <PaymentView
        order={order}
        items={items ?? []}
        payments={payments ?? []}
        currency={org?.currency ?? "USD"}
        tableName={
          order.table_id
            ? (tables ?? []).find((t) => t.id === order.table_id)?.name ?? null
            : null
        }
      />
    </div>
  );
}

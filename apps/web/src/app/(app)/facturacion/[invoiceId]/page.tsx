import { notFound, redirect } from "next/navigation";

import { InvoiceView } from "@/components/billing/invoice-view";
import { createClient } from "@/lib/supabase/server";

interface InvoicePageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) notFound();

  const [{ data: order }, { data: items }, { data: payments }, { data: org }, { data: tables }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("id", invoice.order_id)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", invoice.order_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .eq("order_id", invoice.order_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("organizations")
        .select("name, tax_id")
        .eq("id", invoice.organization_id)
        .maybeSingle(),
      supabase
        .from("tables")
        .select("id, name")
        .eq("organization_id", invoice.organization_id),
    ]);
  if (!order) notFound();

  return (
    <InvoiceView
      invoice={invoice}
      order={order}
      items={items ?? []}
      payments={payments ?? []}
      organization={org ?? { name: "", tax_id: null }}
      tableName={
        order.table_id
          ? (tables ?? []).find((t) => t.id === order.table_id)?.name ?? null
          : null
      }
    />
  );
}

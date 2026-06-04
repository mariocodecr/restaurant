import { notFound, redirect } from "next/navigation";

import { OrderDetail } from "@/components/orders/order-detail";
import { createClient } from "@/lib/supabase/server";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: order }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!order) notFound();

  const [{ data: products }, { data: categories }, { data: tables }, { data: invoice }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, category_id, is_active")
        .eq("organization_id", order.organization_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name")
        .eq("organization_id", order.organization_id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("tables")
        .select("id, name")
        .eq("organization_id", order.organization_id),
      supabase.from("invoices").select("*").eq("order_id", id).maybeSingle(),
    ]);

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-12">
      <OrderDetail
        order={order}
        items={items ?? []}
        products={products ?? []}
        categories={categories ?? []}
        tables={tables ?? []}
        payments={payments ?? []}
        invoice={invoice ?? null}
      />
    </div>
  );
}

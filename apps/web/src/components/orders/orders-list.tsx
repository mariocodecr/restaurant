"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { ORDER_STATUS, type OrderStatus } from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

import {
  ORDER_STATUS_META,
  OrderStatusPill,
} from "./order-status-pill";

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  table_id: string | null;
  subtotal: number;
  total: number;
  opened_at: string;
}

interface OrdersListProps {
  orders: OrderRow[];
  tableLookup: Record<string, string>;
}

type Filter = "active" | "all" | OrderStatus;

const ACTIVE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.OPEN,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.DELIVERED,
];

export function OrdersList({ orders, tableLookup }: OrdersListProps) {
  const [filter, setFilter] = useState<Filter>("active");

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "active")
      return orders.filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const filters: { key: Filter; label: string; count: number }[] = useMemo(() => {
    const c = (f: (o: OrderRow) => boolean) => orders.filter(f).length;
    return [
      {
        key: "active",
        label: "Activas",
        count: c((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus)),
      },
      { key: ORDER_STATUS.OPEN, label: "Abiertas", count: c((o) => o.status === ORDER_STATUS.OPEN) },
      { key: ORDER_STATUS.PREPARING, label: "En preparación", count: c((o) => o.status === ORDER_STATUS.PREPARING) },
      { key: ORDER_STATUS.READY, label: "Listas", count: c((o) => o.status === ORDER_STATUS.READY) },
      { key: ORDER_STATUS.DELIVERED, label: "Entregadas", count: c((o) => o.status === ORDER_STATUS.DELIVERED) },
      { key: ORDER_STATUS.PAID, label: "Pagadas", count: c((o) => o.status === ORDER_STATUS.PAID) },
      { key: ORDER_STATUS.CANCELLED, label: "Canceladas", count: c((o) => o.status === ORDER_STATUS.CANCELLED) },
      { key: "all", label: "Todas", count: orders.length },
    ];
  }, [orders]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
            Operaciones
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
            Órdenes
          </h1>
        </div>
        <Button asChild>
          <Link href="/ordenes/new">
            <Plus className="size-4" />
            Nueva orden
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f.key
                ? "border-[--gold-400]/60 bg-[--gold-400]/10 text-[--cream]"
                : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30 hover:text-[--cream]",
            )}
          >
            {f.label} · {f.count}
          </button>
        ))}
      </div>

      <GlassCard className="p-2 sm:p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <Receipt className="size-8 text-[--gold-400]/60" />
            <div>
              <p className="text-sm font-medium text-[--cream]">No hay órdenes</p>
              <p className="mt-1 text-xs text-[--cream]/55">
                Empezá creando una con &quot;Nueva orden&quot;.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[--gold-400]/10">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/ordenes/${o.id}`}
                  className="grid grid-cols-[80px_1fr_auto_120px] items-center gap-4 px-3 py-3 transition-colors hover:bg-[--gold-400]/5"
                >
                  <span className="text-sm font-mono font-medium text-[--gold-200]">
                    #{o.order_number}
                  </span>
                  <span className="text-sm text-[--cream]">
                    {o.table_id ? tableLookup[o.table_id] ?? "Mesa" : "Sin mesa"}
                  </span>
                  <OrderStatusPill status={o.status as OrderStatus} />
                  <span className="text-right text-sm font-semibold text-[--gold-100]">
                    {formatMoney(Number(o.total))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

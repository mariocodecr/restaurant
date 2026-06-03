"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Check, ChefHat, Clock } from "lucide-react";
import { ORDER_STATUS, type OrderStatus } from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { apiRequest } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  organization_id: string;
  branch_id: string;
  order_number: number;
  status: string;
  table_id: string | null;
  opened_at: string;
  notes: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_name_snapshot: string;
  quantity: number;
  notes: string | null;
}

interface BranchOption {
  id: string;
  name: string;
}

interface KitchenBoardProps {
  organizationId: string;
  branches: BranchOption[];
  initialOrders: OrderRow[];
  initialItems: OrderItemRow[];
  tableLookup: Record<string, string>;
}

export function KitchenBoard({
  organizationId,
  branches,
  initialOrders,
  initialItems,
  tableLookup,
}: KitchenBoardProps) {
  const router = useRouter();
  const [activeBranchId, setActiveBranchId] = useState<string | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Forces the elapsed-time row to re-render every 30s without re-fetching.
  const [, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // Realtime: subscribe to changes on orders + order_items for this org.
  // Every event triggers router.refresh() which re-runs the server fetch
  // and streams new props into the board. Simple and resilient.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`kds-org-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, router]);

  const visibleOrders = useMemo(
    () =>
      activeBranchId === "all"
        ? initialOrders
        : initialOrders.filter((o) => o.branch_id === activeBranchId),
    [initialOrders, activeBranchId],
  );

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemRow[]>();
    for (const it of initialItems) {
      const arr = map.get(it.order_id) ?? [];
      arr.push(it);
      map.set(it.order_id, arr);
    }
    return map;
  }, [initialItems]);

  async function transition(orderId: string, to: OrderStatus) {
    setBusy(orderId);
    setError(null);
    try {
      await apiRequest(`/orders/${orderId}/transitions`, {
        method: "POST",
        body: { to },
      });
      // Realtime will trigger a refresh too, but call directly so the UI
      // updates immediately if Realtime is briefly disconnected.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  const preparing = visibleOrders.filter(
    (o) => o.status === ORDER_STATUS.PREPARING,
  );
  const ready = visibleOrders.filter((o) => o.status === ORDER_STATUS.READY);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
            Cocina
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
            Pantalla de cocina
          </h1>
          <p className="text-sm text-[--cream]/60">
            Tickets en preparación + listos para servir. Actualización en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-[--cream]/40">
            Tickets
          </span>
          <span className="rounded-full border border-[--gold-400]/20 px-3 py-1 text-sm text-[--cream]">
            {preparing.length} en preparación
          </span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            {ready.length} listas
          </span>
        </div>
      </header>

      {branches.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-[--cream]/40">
            Sucursal
          </span>
          <button
            type="button"
            onClick={() => setActiveBranchId("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              activeBranchId === "all"
                ? "border-[--gold-400]/60 bg-[--gold-400]/10 text-[--cream]"
                : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
            )}
          >
            Todas
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBranchId(b.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                b.id === activeBranchId
                  ? "border-[--gold-400]/60 bg-[--gold-400]/10 text-[--cream]"
                  : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {visibleOrders.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <ChefHat className="size-10 text-[--gold-400]/60" />
            <div>
              <p className="text-lg font-medium text-[--cream]">Sin tickets activos</p>
              <p className="mt-1 text-sm text-[--cream]/55">
                Cuando un mesero envíe una orden a cocina, aparece acá al toque.
              </p>
            </div>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order) => (
            <Ticket
              key={order.id}
              order={order}
              items={itemsByOrder.get(order.id) ?? []}
              tableName={
                order.table_id ? tableLookup[order.table_id] ?? "Mesa" : "Sin mesa"
              }
              busy={busy === order.id}
              onReady={() => transition(order.id, ORDER_STATUS.READY)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Ticket({
  order,
  items,
  tableName,
  busy,
  onReady,
}: {
  order: OrderRow;
  items: OrderItemRow[];
  tableName: string;
  busy: boolean;
  onReady: () => void;
}) {
  const minutes = elapsedMinutes(order.opened_at);
  const isReady = order.status === ORDER_STATUS.READY;
  const tone = isReady
    ? "border-emerald-400/40 bg-emerald-500/8"
    : minutes < 5
      ? "border-[--gold-400]/20"
      : minutes < 15
        ? "border-amber-400/40 bg-amber-500/5"
        : "border-rose-400/50 bg-rose-500/8 shadow-[0_0_24px_rgba(244,63,94,0.18)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-[#14110d]/65 p-4 backdrop-blur-xl shadow-[0_24px_48px_-15px_rgba(0,0,0,0.6)] transition-all",
        tone,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[--cream]/40">
            Orden
          </p>
          <p className="font-mono text-2xl font-semibold text-[--gold-200]">
            #{order.order_number}
          </p>
          <p className="mt-0.5 text-sm text-[--cream]">{tableName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              isReady
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                : "border-[--gold-400]/30 bg-[--gold-400]/10 text-[--gold-100]",
            )}
          >
            {isReady ? "Lista" : "En preparación"}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[--cream]/55">
            <Clock className="size-3" />
            {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          </span>
        </div>
      </header>

      {order.notes ? (
        <Block label="Nota de la orden">{order.notes}</Block>
      ) : null}

      <ul className="my-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-[--cream]/40">Sin ítems</li>
        ) : (
          items.map((it) => (
            <li
              key={it.id}
              className="flex items-start gap-3 rounded-md border border-[--gold-400]/10 bg-[#0a0908]/30 px-3 py-2"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[--gold-400]/15 text-sm font-semibold text-[--gold-200]">
                {it.quantity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[--cream]">
                  {it.product_name_snapshot}
                </p>
                {it.notes ? (
                  <p className="mt-0.5 text-xs text-amber-200/90">
                    ⚠ {it.notes}
                  </p>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {!isReady ? (
        <Button
          type="button"
          className="w-full"
          size="lg"
          disabled={busy}
          onClick={onReady}
        >
          <Check className="size-5" />
          {busy ? "Marcando..." : "Marcar lista"}
        </Button>
      ) : (
        <p className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center text-xs text-emerald-200">
          Esperando que el mesero la lleve.
        </p>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 rounded-md border border-amber-400/30 bg-amber-500/8 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-amber-100">{children}</p>
    </div>
  );
}

function elapsedMinutes(iso: string): number {
  const opened = new Date(iso).getTime();
  if (Number.isNaN(opened)) return 0;
  return Math.max(0, Math.floor((Date.now() - opened) / 60_000));
}

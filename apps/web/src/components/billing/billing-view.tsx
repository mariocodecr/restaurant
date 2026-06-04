"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard, FileText, Receipt as ReceiptIcon } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PendingOrder {
  id: string;
  order_number: number;
  table_id: string | null;
  total: number;
  opened_at: string;
  delivered_at: string | null;
  paidSoFar: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: number;
  customer_name: string | null;
  total: number;
  currency: string;
  issued_at: string;
  order_id: string;
}

interface BillingViewProps {
  currency: string;
  pendingOrders: PendingOrder[];
  invoices: InvoiceRow[];
  tableLookup: Record<string, string>;
}

type Tab = "pending" | "invoices";

export function BillingView({
  currency,
  pendingOrders,
  invoices,
  tableLookup,
}: BillingViewProps) {
  const [tab, setTab] = useState<Tab>(pendingOrders.length > 0 ? "pending" : "invoices");

  const dailyTotal = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return invoices
      .filter((i) => new Date(i.issued_at) >= today)
      .reduce((sum, i) => sum + Number(i.total), 0);
  }, [invoices]);

  const monthlyTotal = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return invoices
      .filter((i) => new Date(i.issued_at) >= monthStart)
      .reduce((sum, i) => sum + Number(i.total), 0);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
          Operaciones
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          Facturación
        </h1>
        <p className="text-sm text-[--cream]/60">
          Cobrá órdenes entregadas y consultá las facturas emitidas.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Por cobrar"
          value={pendingOrders.length.toString()}
          hint={`${pendingOrders.length === 1 ? "orden" : "órdenes"} entregada${pendingOrders.length === 1 ? "" : "s"}`}
          tone="warn"
        />
        <Stat
          label="Hoy"
          value={formatMoney(dailyTotal, currency)}
          hint="facturado"
        />
        <Stat
          label="Mes"
          value={formatMoney(monthlyTotal, currency)}
          hint="facturado"
        />
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          <CreditCard className="size-4" />
          Por cobrar · {pendingOrders.length}
        </TabButton>
        <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>
          <FileText className="size-4" />
          Facturas · {invoices.length}
        </TabButton>
      </div>

      {tab === "pending" ? (
        <GlassCard className="p-2 sm:p-2">
          {pendingOrders.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Sin órdenes por cobrar"
              hint="Las órdenes entregadas aparecen acá hasta que se cobren."
            />
          ) : (
            <ul className="divide-y divide-[--gold-400]/10">
              {pendingOrders.map((o) => {
                const remaining = Math.max(0, Number(o.total) - o.paidSoFar);
                const partial = o.paidSoFar > 0 && remaining > 0;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/facturacion/cobrar/${o.id}`}
                      className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 px-3 py-3 transition-colors hover:bg-[--gold-400]/5"
                    >
                      <span className="text-sm font-mono font-medium text-[--gold-200]">
                        #{o.order_number}
                      </span>
                      <span className="text-sm text-[--cream]">
                        {o.table_id ? tableLookup[o.table_id] ?? "Mesa" : "Sin mesa"}
                      </span>
                      {partial ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
                          Pago parcial
                        </span>
                      ) : (
                        <span className="text-xs text-[--cream]/40">
                          {minutesAgo(o.delivered_at ?? o.opened_at)} min
                        </span>
                      )}
                      <span className="text-right">
                        <span className="block text-sm font-semibold text-[--gold-100]">
                          {formatMoney(remaining, currency)}
                        </span>
                        {partial ? (
                          <span className="block text-[10px] text-[--cream]/50">
                            de {formatMoney(Number(o.total), currency)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-2 sm:p-2">
          {invoices.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="Sin facturas emitidas"
              hint="Cuando cobres una orden completa se genera la factura automáticamente."
            />
          ) : (
            <ul className="divide-y divide-[--gold-400]/10">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/facturacion/${inv.id}`}
                    className="grid grid-cols-[110px_1fr_auto_120px] items-center gap-4 px-3 py-3 transition-colors hover:bg-[--gold-400]/5"
                  >
                    <span className="text-sm font-mono font-medium text-[--gold-200]">
                      F-{String(inv.invoice_number).padStart(6, "0")}
                    </span>
                    <span className="truncate text-sm text-[--cream]">
                      {inv.customer_name ?? (
                        <span className="text-[--cream]/40">Consumidor final</span>
                      )}
                    </span>
                    <span className="text-xs text-[--cream]/40">
                      {new Date(inv.issued_at).toLocaleString("es-CR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="text-right text-sm font-semibold text-[--gold-100]">
                      {formatMoney(Number(inv.total), inv.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[--gold-400]/15 bg-[#14110d]/55 p-4 backdrop-blur-xl",
        tone === "warn" && "border-amber-400/30",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-[--cream]/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "warn" ? "text-amber-100" : "text-[--gold-100]",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-[--cream]/50">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
        active
          ? "border-[--gold-400]/60 bg-[--gold-400]/10 text-[--cream]"
          : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30 hover:text-[--cream]",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof CreditCard;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Icon className="size-8 text-[--gold-400]/60" />
      <div>
        <p className="text-sm font-medium text-[--cream]">{title}</p>
        <p className="mt-1 text-xs text-[--cream]/55">{hint}</p>
      </div>
    </div>
  );
}

function minutesAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

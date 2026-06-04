"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Landmark,
  Plus,
  Receipt as ReceiptIcon,
  Trash2,
} from "lucide-react";
import {
  PAYMENT_METHOD,
  type PaymentMethod,
} from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
}

interface ItemRow {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number | null;
}

interface PaymentRow {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  created_at: string;
}

interface PaymentViewProps {
  order: OrderRow;
  items: ItemRow[];
  payments: PaymentRow[];
  currency: string;
  tableName: string | null;
}

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: typeof Banknote }
> = {
  [PAYMENT_METHOD.CASH]: { label: "Efectivo", icon: Banknote },
  [PAYMENT_METHOD.CARD]: { label: "Tarjeta", icon: CreditCard },
  [PAYMENT_METHOD.TRANSFER]: { label: "Transferencia", icon: Landmark },
  [PAYMENT_METHOD.OTHER]: { label: "Otro", icon: ReceiptIcon },
};

export function PaymentView({
  order,
  items,
  payments,
  currency,
  tableName,
}: PaymentViewProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidTotal = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [payments],
  );
  const remaining = Math.max(0, Number(order.total) - paidTotal);
  const fullyPaid = remaining === 0 && paidTotal >= Number(order.total);

  // When the trigger transitions the order to 'paid' (after our last
  // payment covers the total) we navigate to the freshly-created invoice.
  useEffect(() => {
    if (!fullyPaid) return;
    let cancelled = false;
    void (async () => {
      try {
        const invoice = await apiRequest<{ id: string }>(
          `/orders/${order.id}/invoice`,
        );
        if (!cancelled) router.replace(`/facturacion/${invoice.id}`);
      } catch {
        // The invoice trigger races with our request; refresh and try again
        // on the next render via router.refresh().
        if (!cancelled) router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullyPaid, order.id, router]);

  async function run<T>(fn: () => Promise<T>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/facturacion"
        className="inline-flex items-center gap-2 text-sm text-[--cream]/60 hover:text-[--cream]"
      >
        <ArrowLeft className="size-4" />
        Volver a facturación
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
            Cobrar orden #{order.order_number}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[--cream]">
            {tableName ?? "Sin mesa"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-[--cream]/40">
            Total
          </p>
          <p className="text-3xl font-semibold text-[--gold-200]">
            {currency} {formatMoney(Number(order.total))}
          </p>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ITEMS (read-only) */}
        <GlassCard>
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
            Detalle
          </h2>
          <ul className="divide-y divide-[--gold-400]/10">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-[--gold-400]/10 text-sm font-semibold text-[--gold-200]">
                  {it.quantity}×
                </span>
                <span className="flex-1 truncate text-sm text-[--cream]">
                  {it.product_name_snapshot}
                </span>
                <span className="text-sm text-[--cream]">
                  {formatMoney(Number(it.line_total ?? 0))}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-[--gold-400]/15 pt-3 text-sm">
            <Row label="Subtotal" value={Number(order.subtotal)} />
            <Row label="Descuento" value={-Number(order.discount_amount)} />
            <Row label="Impuestos" value={Number(order.tax_amount)} />
            <Row label="Total" value={Number(order.total)} bold />
          </dl>
        </GlassCard>

        {/* PAYMENTS PANEL */}
        <GlassCard>
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
            Pagos
          </h2>

          {payments.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {payments.map((p) => {
                const meta =
                  METHOD_META[p.method as PaymentMethod] ??
                  METHOD_META[PAYMENT_METHOD.OTHER]!;
                const Icon = meta.icon;
                return (
                  <li
                    key={p.id}
                    className="group flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 text-[--cream]/80">
                      <Icon className="size-4 text-[--gold-300]" />
                      <span>{meta.label}</span>
                      {p.reference ? (
                        <span className="text-xs text-[--cream]/40">
                          · {p.reference}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-[--cream]">
                        {formatMoney(Number(p.amount))}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          run(() =>
                            apiRequest(
                              `/orders/${order.id}/payments/${p.id}`,
                              { method: "DELETE" },
                            ),
                          )
                        }
                        disabled={busy || fullyPaid}
                        className="rounded p-1 text-[--cream]/40 opacity-0 hover:bg-rose-500/20 hover:text-rose-200 group-hover:opacity-100"
                        aria-label="Quitar pago"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-3 space-y-1.5 rounded-md border border-[--gold-400]/15 bg-[--gold-400]/[0.04] px-3 py-2 text-sm">
            <Row label="Pagado" value={paidTotal} />
            <Row label="Falta" value={remaining} bold />
          </div>

          {fullyPaid ? (
            <p className="mt-3 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center text-xs text-emerald-200">
              Total cubierto — generando factura…
            </p>
          ) : (
            <div className="mt-4">
              <AddPaymentForm
                remaining={remaining}
                disabled={busy}
                onSubmit={async (input) => {
                  await run(() =>
                    apiRequest(`/orders/${order.id}/payments`, {
                      method: "POST",
                      body: input,
                    }),
                  );
                }}
              />
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function AddPaymentForm({
  remaining,
  disabled,
  onSubmit,
}: {
  remaining: number;
  disabled: boolean;
  onSubmit: (input: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHOD.CASH);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync the amount field with the latest remaining when remaining shrinks
  // due to prior payments landing.
  useEffect(() => {
    setAmount(remaining.toFixed(2));
  }, [remaining]);

  async function handle(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      await onSubmit({
        method,
        amount: n,
        reference: reference.trim() || undefined,
      });
      setReference("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="space-y-3 rounded-lg border border-[--gold-400]/15 bg-[#0a0908]/40 p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(METHOD_META) as [PaymentMethod, (typeof METHOD_META)[PaymentMethod]][]).map(
          ([key, meta]) => {
            const Icon = meta.icon;
            const active = method === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors",
                  active
                    ? "border-[--gold-400]/60 bg-[--gold-400]/15 text-[--cream]"
                    : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
                )}
                disabled={disabled || busy}
              >
                <Icon className="size-4" />
                {meta.label}
              </button>
            );
          },
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[--cream]/70">Monto</Label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={disabled || busy}
        />
      </div>
      {method === PAYMENT_METHOD.CARD || method === PAYMENT_METHOD.TRANSFER ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Referencia <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={
              method === PAYMENT_METHOD.CARD
                ? "Últimos 4 / TXN ID"
                : "Nº de transferencia"
            }
            maxLength={120}
            disabled={disabled || busy}
          />
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={disabled || busy}>
        <Plus className="size-4" />
        {busy ? "Registrando..." : "Registrar pago"}
      </Button>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", bold && "text-base")}>
      <dt className="text-[--cream]/60">{label}</dt>
      <dd className={cn("font-medium text-[--cream]", bold && "text-[--gold-200] text-lg")}>
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

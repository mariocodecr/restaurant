"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Banknote,
  Check,
  ChefHat,
  CreditCard,
  FileText,
  HandPlatter,
  Landmark,
  Plus,
  Receipt as ReceiptIcon,
  Trash2,
  X,
} from "lucide-react";
import {
  canTransition,
  ORDER_STATUS,
  PAYMENT_METHOD,
  type OrderStatus,
  type PaymentMethod,
} from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

import { OrderStatusPill } from "./order-status-pill";

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  table_id: string | null;
  branch_id: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  opened_at: string;
  ready_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
}

interface OrderItemRow {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number | null;
  notes: string | null;
}

interface PaymentRow {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: number;
  issued_at: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  category_id: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface TableOption {
  id: string;
  name: string;
}

interface OrderDetailProps {
  order: OrderRow;
  items: OrderItemRow[];
  products: ProductOption[];
  categories: CategoryOption[];
  tables: TableOption[];
  payments: PaymentRow[];
  invoice: InvoiceRow | null;
}

interface TransitionAction {
  to: OrderStatus;
  label: string;
  icon: typeof ChefHat;
}

const NEXT_ACTION: Partial<Record<OrderStatus, TransitionAction[]>> = {
  [ORDER_STATUS.OPEN]: [
    { to: ORDER_STATUS.PREPARING, label: "Enviar a cocina", icon: ChefHat },
    { to: ORDER_STATUS.CANCELLED, label: "Cancelar", icon: X },
  ],
  [ORDER_STATUS.PREPARING]: [
    { to: ORDER_STATUS.READY, label: "Marcar lista", icon: Check },
    { to: ORDER_STATUS.CANCELLED, label: "Cancelar", icon: X },
  ],
  [ORDER_STATUS.READY]: [
    { to: ORDER_STATUS.DELIVERED, label: "Entregada", icon: HandPlatter },
  ],
  // delivered → paid is driven by the payments panel (auto-trigger when paid >= total)
};

const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: typeof Banknote }
> = {
  [PAYMENT_METHOD.CASH]: { label: "Efectivo", icon: Banknote },
  [PAYMENT_METHOD.CARD]: { label: "Tarjeta", icon: CreditCard },
  [PAYMENT_METHOD.TRANSFER]: { label: "Transferencia", icon: Landmark },
  [PAYMENT_METHOD.OTHER]: { label: "Otro", icon: ReceiptIcon },
};

export function OrderDetail({
  order,
  items,
  products,
  categories,
  tables,
  payments,
  invoice,
}: OrderDetailProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = order.status as OrderStatus;
  const tableName =
    order.table_id ? tables.find((t) => t.id === order.table_id)?.name ?? "Mesa" : "Sin mesa";
  const isClosed = status === ORDER_STATUS.PAID || status === ORDER_STATUS.CANCELLED;
  const canEditItems = !isClosed && status !== ORDER_STATUS.DELIVERED;

  const paidTotal = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [payments],
  );
  const remaining = Math.max(0, Number(order.total) - paidTotal);

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
        href="/ordenes"
        className="inline-flex items-center gap-2 text-sm text-[--cream]/60 hover:text-[--cream]"
      >
        <ArrowLeft className="size-4" />
        Volver a órdenes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
            Orden #{order.order_number}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[--cream]">
            {tableName}
          </h1>
          <OrderStatusPill status={status} />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-[--cream]/40">Total</p>
          <p className="text-3xl font-semibold text-[--gold-200]">
            {formatMoney(Number(order.total))}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ITEMS */}
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[--cream]/50">Ítems</h2>
            {canEditItems ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdd((v) => !v)}
                disabled={busy}
              >
                <Plus className="size-4" />
                {showAdd ? "Cancelar" : "Agregar ítem"}
              </Button>
            ) : null}
          </div>

          {showAdd ? (
            <div className="mb-4">
              <AddItemForm
                products={products}
                categories={categories}
                onCancel={() => setShowAdd(false)}
                onSubmit={async (input) => {
                  await run(() =>
                    apiRequest(`/orders/${order.id}/items`, {
                      method: "POST",
                      body: input,
                    }),
                  );
                  setShowAdd(false);
                }}
              />
            </div>
          ) : null}

          {items.length === 0 && !showAdd ? (
            <p className="px-3 py-8 text-center text-sm text-[--cream]/50">
              Sin ítems todavía. Agregá productos para esta orden.
            </p>
          ) : (
            <ul className="divide-y divide-[--gold-400]/10">
              {items.map((it) => (
                <li key={it.id} className="group flex items-center gap-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-[--gold-400]/10 text-sm font-semibold text-[--gold-200]">
                    {it.quantity}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[--cream]">
                      {it.product_name_snapshot}
                    </p>
                    {it.notes ? (
                      <p className="mt-0.5 truncate text-xs text-[--cream]/55">
                        {it.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[--cream]">
                      {formatMoney(Number(it.line_total ?? 0))}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[--cream]/40">
                      {formatMoney(Number(it.unit_price))} c/u
                    </p>
                  </div>
                  {canEditItems ? (
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          apiRequest(`/orders/${order.id}/items/${it.id}`, {
                            method: "DELETE",
                          }),
                        )
                      }
                      disabled={busy}
                      className="rounded p-1.5 text-[--cream]/60 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-200 group-hover:opacity-100"
                      aria-label="Quitar ítem"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <GlassCard>
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
              Totales
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={Number(order.subtotal)} />
              <Row label="Descuento" value={-Number(order.discount_amount)} />
              <Row label="Impuestos" value={Number(order.tax_amount)} />
              <div className="border-t border-[--gold-400]/15 pt-2">
                <Row label="Total" value={Number(order.total)} bold />
              </div>
            </dl>
          </GlassCard>

          {/* Transition actions (only when there are non-payment transitions) */}
          {NEXT_ACTION[status] && NEXT_ACTION[status]!.length > 0 ? (
            <GlassCard>
              <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
                Acciones
              </h2>
              <div className="space-y-2">
                {NEXT_ACTION[status]!.map((act) => {
                  const Icon = act.icon;
                  const allowed = canTransition(status, act.to);
                  const isCancel = act.to === ORDER_STATUS.CANCELLED;
                  return (
                    <Button
                      key={act.to}
                      type="button"
                      variant={isCancel ? "outline" : "default"}
                      className="w-full"
                      disabled={!allowed || busy}
                      onClick={() =>
                        run(() =>
                          apiRequest(`/orders/${order.id}/transitions`, {
                            method: "POST",
                            body: { to: act.to },
                          }),
                        )
                      }
                    >
                      <Icon className="size-4" />
                      {act.label}
                    </Button>
                  );
                })}
              </div>
            </GlassCard>
          ) : null}

          {/* Payments panel — visible from delivered */}
          {status === ORDER_STATUS.DELIVERED ? (
            <GlassCard>
              <PaymentsPanel
                orderId={order.id}
                total={Number(order.total)}
                paidTotal={paidTotal}
                remaining={remaining}
                payments={payments}
                busy={busy}
                onRun={run}
              />
            </GlassCard>
          ) : null}

          {/* Invoice card — visible when paid */}
          {status === ORDER_STATUS.PAID && invoice ? (
            <GlassCard>
              <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
                Factura
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="font-mono text-lg font-semibold text-[--gold-200]">
                    F-{String(invoice.invoice_number).padStart(6, "0")}
                  </p>
                  <p className="text-xs text-[--cream]/55">
                    Emitida {new Date(invoice.issued_at).toLocaleString("es-CR")}
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href={`/ordenes/${order.id}/factura`}>
                    <FileText className="size-4" />
                    Ver / imprimir factura
                  </Link>
                </Button>
              </div>
            </GlassCard>
          ) : null}

          {/* Read-only payments summary when paid */}
          {status === ORDER_STATUS.PAID && payments.length > 0 ? (
            <GlassCard>
              <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
                Pagos
              </h2>
              <ul className="space-y-2 text-sm">
                {payments.map((p) => {
                  const meta =
                    PAYMENT_METHOD_META[p.method as PaymentMethod] ??
                    PAYMENT_METHOD_META[PAYMENT_METHOD.OTHER]!;
                  const Icon = meta.icon;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[--cream]/80">
                        <Icon className="size-4 text-[--gold-300]" />
                        {meta.label}
                      </span>
                      <span className="font-medium text-[--cream]">
                        {formatMoney(Number(p.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>
          ) : null}

          {isClosed ? (
            <p className="rounded-md bg-[--gold-400]/5 px-3 py-2 text-center text-xs text-[--cream]/50">
              Esta orden está {status === ORDER_STATUS.PAID ? "pagada" : "cancelada"} —
              no admite más cambios.
            </p>
          ) : null}

          {order.notes ? (
            <GlassCard>
              <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
                Notas
              </h2>
              <p className="text-sm text-[--cream]/80">{order.notes}</p>
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaymentsPanel
// ---------------------------------------------------------------------------

function PaymentsPanel({
  orderId,
  total,
  paidTotal,
  remaining,
  payments,
  busy,
  onRun,
}: {
  orderId: string;
  total: number;
  paidTotal: number;
  remaining: number;
  payments: PaymentRow[];
  busy: boolean;
  onRun: <T>(fn: () => Promise<T>) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(payments.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[--cream]/50">
          Pagos
        </h2>
        {!showForm && remaining > 0 ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full p-1.5 text-[--gold-300] hover:bg-[--gold-400]/10"
            aria-label="Agregar pago"
            disabled={busy}
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </div>

      {payments.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {payments.map((p) => {
            const meta =
              PAYMENT_METHOD_META[p.method as PaymentMethod] ??
              PAYMENT_METHOD_META[PAYMENT_METHOD.OTHER]!;
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
                      onRun(() =>
                        apiRequest(`/orders/${orderId}/payments/${p.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                    disabled={busy}
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

      <div className="space-y-1.5 rounded-md border border-[--gold-400]/15 bg-[--gold-400]/[0.04] px-3 py-2 text-sm">
        <Row label="Pagado" value={paidTotal} />
        <Row label="Falta" value={remaining} bold />
      </div>

      {remaining > 0 && showForm ? (
        <AddPaymentForm
          remaining={remaining}
          onCancel={() => setShowForm(false)}
          onSubmit={async (input) => {
            await onRun(() =>
              apiRequest(`/orders/${orderId}/payments`, {
                method: "POST",
                body: input,
              }),
            );
            setShowForm(false);
          }}
        />
      ) : null}

      {remaining === 0 && paidTotal >= total ? (
        <p className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center text-xs text-emerald-200">
          Total cubierto. La orden se marcó como pagada automáticamente.
        </p>
      ) : null}
    </div>
  );
}

function AddPaymentForm({
  remaining,
  onCancel,
  onSubmit,
}: {
  remaining: number;
  onCancel: () => void;
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
        {(Object.entries(PAYMENT_METHOD_META) as [PaymentMethod, (typeof PAYMENT_METHOD_META)[PaymentMethod]][]).map(
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
          disabled={busy}
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
            disabled={busy}
          />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Registrando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function AddItemForm({
  products,
  categories,
  onCancel,
  onSubmit,
}: {
  products: ProductOption[];
  categories: CategoryOption[];
  onCancel: () => void;
  onSubmit: (input: {
    productId: string;
    quantity: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductOption[]>();
    for (const p of products) {
      const arr = map.get(p.category_id) ?? [];
      arr.push(p);
      map.set(p.category_id, arr);
    }
    return map;
  }, [products]);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setBusy(true);
    try {
      await onSubmit({
        productId,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[--gold-400]/20 px-4 py-6 text-center text-sm text-[--cream]/60">
        No hay productos activos. Agregá productos en el menú primero.
      </p>
    );
  }

  return (
    <form
      onSubmit={handle}
      className="space-y-3 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_80px]">
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Producto</Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            disabled={busy}
            className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
          >
            {categories.map((cat) => {
              const ps = productsByCategory.get(cat.id) ?? [];
              if (ps.length === 0) return null;
              return (
                <optgroup key={cat.id} label={cat.name}>
                  {ps.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#14110d]">
                      {p.name} — {p.price}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Cantidad</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={busy}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[--cream]/70">
          Notas <span className="text-[--cream]/40">(opcional)</span>
        </Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sin cebolla, término medio..."
          maxLength={500}
          disabled={busy}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || !productId}>
          {busy ? "Agregando..." : "Agregar"}
        </Button>
      </div>
    </form>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

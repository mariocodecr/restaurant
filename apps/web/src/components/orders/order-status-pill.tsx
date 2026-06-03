import { ORDER_STATUS, type OrderStatus } from "@restaurant/shared";

import { cn } from "@/lib/utils";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; pill: string }
> = {
  [ORDER_STATUS.OPEN]: {
    label: "Abierta",
    pill: "bg-sky-400/15 text-sky-200 border-sky-400/30",
  },
  [ORDER_STATUS.PREPARING]: {
    label: "En preparación",
    pill: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  },
  [ORDER_STATUS.READY]: {
    label: "Lista",
    pill: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  },
  [ORDER_STATUS.DELIVERED]: {
    label: "Entregada",
    pill: "bg-[--gold-400]/15 text-[--gold-100] border-[--gold-400]/30",
  },
  [ORDER_STATUS.PAID]: {
    label: "Pagada",
    pill: "bg-zinc-400/15 text-zinc-200 border-zinc-400/30",
  },
  [ORDER_STATUS.CANCELLED]: {
    label: "Cancelada",
    pill: "bg-rose-400/15 text-rose-200 border-rose-400/30",
  },
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META[ORDER_STATUS.OPEN]!;
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.pill,
      )}
    >
      {meta.label}
    </span>
  );
}

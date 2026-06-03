"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { TABLE_STATUS, type TableStatus } from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BranchRow {
  id: string;
  name: string;
  organization_id: string;
}

interface TableRow {
  id: string;
  organization_id: string;
  branch_id: string;
  name: string;
  capacity: number;
  status: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TablesViewProps {
  organizationId: string;
  initialBranches: BranchRow[];
  initialTables: TableRow[];
}

const STATUS_META: Record<
  TableStatus,
  { label: string; pill: string; ring: string }
> = {
  [TABLE_STATUS.AVAILABLE]: {
    label: "Disponible",
    pill: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
    ring: "ring-emerald-400/50",
  },
  [TABLE_STATUS.OCCUPIED]: {
    label: "Ocupada",
    pill: "bg-[--gold-400]/15 text-[--gold-100] border-[--gold-400]/30",
    ring: "ring-[--gold-400]/60",
  },
  [TABLE_STATUS.WAITING_FOOD]: {
    label: "Esperando comida",
    pill: "bg-sky-400/15 text-sky-200 border-sky-400/30",
    ring: "ring-sky-400/50",
  },
  [TABLE_STATUS.PENDING_PAYMENT]: {
    label: "Pendiente de pago",
    pill: "bg-rose-400/15 text-rose-200 border-rose-400/30",
    ring: "ring-rose-400/50",
  },
  [TABLE_STATUS.RESERVED]: {
    label: "Reservada",
    pill: "bg-violet-400/15 text-violet-200 border-violet-400/30",
    ring: "ring-violet-400/50",
  },
};

const NEW_TABLE = "__new__";

export function TablesView({
  organizationId,
  initialBranches,
  initialTables,
}: TablesViewProps) {
  const router = useRouter();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    initialBranches[0]?.id ?? null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleTables = useMemo(
    () =>
      activeBranchId
        ? initialTables.filter((t) => t.branch_id === activeBranchId)
        : [],
    [initialTables, activeBranchId],
  );
  const activeBranch =
    initialBranches.find((b) => b.id === activeBranchId) ?? null;

  async function withRefresh<T>(fn: () => Promise<T>): Promise<void> {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  if (initialBranches.length === 0) {
    return (
      <GlassCard>
        <div className="py-10 text-center">
          <h2 className="text-lg font-medium text-[--cream]">Sin sucursales</h2>
          <p className="mt-2 text-sm text-[--cream]/60">
            Primero creá una sucursal en la configuración para poder agregar mesas.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
          Operaciones
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          Mesas
        </h1>
        <p className="text-sm text-[--cream]/60">
          Mapa visual por sucursal. Tocá una mesa para cambiar su estado o editarla.
        </p>
      </header>

      {initialBranches.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-[--cream]/40">
            Sucursal
          </span>
          {initialBranches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBranchId(b.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                b.id === activeBranchId
                  ? "border-[--gold-400]/60 bg-[--gold-400]/10 text-[--cream]"
                  : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30 hover:text-[--cream]",
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

      <GlassCard>
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-lg font-medium text-[--cream]">
            {activeBranch?.name}{" "}
            <span className="text-sm font-normal text-[--cream]/50">
              · {visibleTables.length} mesa{visibleTables.length === 1 ? "" : "s"}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setEditingId(editingId === NEW_TABLE ? null : NEW_TABLE)
            }
          >
            <Plus className="size-4" />
            {editingId === NEW_TABLE ? "Cancelar" : "Nueva mesa"}
          </Button>
        </div>

        {editingId === NEW_TABLE && activeBranch ? (
          <div className="mb-4">
            <TableForm
              organizationId={organizationId}
              branchId={activeBranch.id}
              onCancel={() => setEditingId(null)}
              onSubmit={async (input) => {
                await withRefresh(() =>
                  apiRequest("/tables", { method: "POST", body: input }),
                );
                setEditingId(null);
              }}
            />
          </div>
        ) : null}

        {visibleTables.length === 0 && editingId !== NEW_TABLE ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleTables.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="col-span-full">
                  <TableForm
                    organizationId={organizationId}
                    branchId={t.branch_id}
                    initial={t}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (input) => {
                      const { organizationId: _o, branchId: _b, ...rest } = input;
                      await withRefresh(() =>
                        apiRequest(`/tables/${t.id}`, {
                          method: "PATCH",
                          body: rest,
                        }),
                      );
                      setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={t.id}>
                  <TableCard
                    table={t}
                    pending={pendingId === t.id}
                    onEdit={() => setEditingId(t.id)}
                    onDelete={() => {
                      if (
                        window.confirm(
                          `¿Borrar la mesa "${t.name}"? No se puede deshacer.`,
                        )
                      ) {
                        setPendingId(t.id);
                        void withRefresh(() =>
                          apiRequest(`/tables/${t.id}`, { method: "DELETE" }),
                        ).finally(() => setPendingId(null));
                      }
                    }}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </GlassCard>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-[--cream]/40">
          Leyenda
        </span>
        {(Object.entries(STATUS_META) as [TableStatus, (typeof STATUS_META)[TableStatus]][]).map(
          ([key, meta]) => (
            <span
              key={key}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                meta.pill,
              )}
            >
              {meta.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function TableCard({
  table,
  pending,
  onEdit,
  onDelete,
}: {
  table: TableRow;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta =
    STATUS_META[table.status as TableStatus] ?? STATUS_META[TABLE_STATUS.AVAILABLE]!;
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-[--gold-400]/15 bg-[#14110d]/60 p-4 backdrop-blur transition-all hover:bg-[#1a1611]/60 hover:shadow-[0_0_20px_rgba(212,163,92,0.15)]",
        pending && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[--cream]/40">
            Mesa
          </p>
          <p className="mt-0.5 truncate text-xl font-semibold text-[--cream]">
            {table.name}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1.5 text-[--cream]/60 hover:bg-[--gold-400]/15 hover:text-[--cream]"
            aria-label="Editar mesa"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1.5 text-[--cream]/60 hover:bg-rose-500/20 hover:text-rose-200"
            aria-label="Borrar mesa"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            meta.pill,
          )}
        >
          {meta.label}
        </span>
        <span className="flex items-center gap-1 text-xs text-[--cream]/55">
          <Users className="size-3.5" />
          {table.capacity}
        </span>
      </div>
    </div>
  );
}

interface TableFormProps {
  organizationId: string;
  branchId: string;
  initial?: TableRow;
  onCancel: () => void;
  onSubmit: (input: {
    organizationId: string;
    branchId: string;
    name: string;
    capacity?: number;
    status?: TableStatus;
  }) => Promise<void>;
}

function TableForm({
  organizationId,
  branchId,
  initial,
  onCancel,
  onSubmit,
}: TableFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 4));
  const [status, setStatus] = useState<TableStatus>(
    (initial?.status as TableStatus) ?? TABLE_STATUS.AVAILABLE,
  );
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        organizationId,
        branchId,
        name: name.trim(),
        capacity: capacity ? Number(capacity) : undefined,
        status,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="space-y-3 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_2fr]">
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Nombre</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Mesa 1, T-A1, Barra...'
            required
            maxLength={40}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Capacidad</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Estado</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TableStatus)}
            disabled={busy}
            className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
          >
            {(Object.entries(STATUS_META) as [TableStatus, (typeof STATUS_META)[TableStatus]][]).map(
              ([value, meta]) => (
                <option key={value} value={value} className="bg-[#14110d] text-[--cream]">
                  {meta.label}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando..." : initial ? "Guardar cambios" : "Crear mesa"}
        </Button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[--gold-400]/20 px-6 py-10 text-center">
      <Users className="size-8 text-[--gold-400]/60" />
      <div>
        <p className="text-sm font-medium text-[--cream]">Sin mesas todavía</p>
        <p className="mt-1 text-xs text-[--cream]/55">
          Agregá la primera con el botón &quot;Nueva mesa&quot;.
        </p>
      </div>
    </div>
  );
}

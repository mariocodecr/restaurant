"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Pencil,
  Plus,
  Settings2,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import {
  STOCK_MOVEMENT_KIND,
  type StockMovementKind,
} from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BranchOption {
  id: string;
  name: string;
}

interface IngredientRow {
  id: string;
  organization_id: string;
  name: string;
  unit: string;
  current_cost: number;
  min_stock_alert: number | null;
  is_active: boolean;
  sort_order: number;
}

interface StockLevel {
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  minStockAlert: number | null;
  quantity: number;
  updatedAt: string;
}

interface StockMovement {
  id: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  kind: string;
  quantityDelta: number;
  unitCost: number;
  notes: string | null;
  createdAt: string;
}

interface InventoryViewProps {
  organizationId: string;
  branches: BranchOption[];
  initialIngredients: IngredientRow[];
}

type Tab = "stock" | "movements" | "ingredients";

export function InventoryView({
  organizationId,
  branches,
  initialIngredients,
}: InventoryViewProps) {
  const [activeBranchId, setActiveBranchId] = useState<string>(
    branches[0]?.id ?? "",
  );
  const [tab, setTab] = useState<Tab>("stock");
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(initialIngredients);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const noBranches = branches.length === 0;

  // Re-fetch levels + movements whenever the active branch or refresh tick changes
  useEffect(() => {
    if (!activeBranchId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [lvls, mvts] = await Promise.all([
          apiRequest<StockLevel[]>("/stock-levels", {
            searchParams: { branchId: activeBranchId, organizationId },
          }),
          apiRequest<StockMovement[]>("/stock-movements", {
            searchParams: { branchId: activeBranchId, limit: "100" },
          }),
        ]);
        if (cancelled) return;
        setLevels(lvls);
        setMovements(mvts);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error cargando stock");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBranchId, organizationId, refreshTick]);

  function refresh() {
    setRefreshTick((t) => t + 1);
  }

  async function run<T>(id: string, fn: () => Promise<T>): Promise<void> {
    setBusy(id);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  if (noBranches) {
    return (
      <GlassCard>
        <div className="py-10 text-center space-y-2">
          <h2 className="text-lg font-medium text-[--cream]">Sin sucursales activas</h2>
          <p className="text-sm text-[--cream]/60">
            Creá una sucursal antes de manejar inventario.
          </p>
        </div>
      </GlassCard>
    );
  }

  const lowCount = levels.filter(
    (l) => l.minStockAlert !== null && l.quantity < l.minStockAlert,
  ).length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
          Operaciones
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          Inventario
        </h1>
        <p className="text-sm text-[--cream]/60">
          Cargá entradas, registrá salidas y mantené el catálogo de ingredientes.
        </p>
      </header>

      {branches.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-[--cream]/40">
            Sucursal
          </span>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Ingredientes"
          value={ingredients.filter((i) => i.is_active).length.toString()}
          hint="activos en catálogo"
        />
        <Stat
          label="Bajo mínimo"
          value={lowCount.toString()}
          hint={`en ${branches.find((b) => b.id === activeBranchId)?.name ?? ""}`}
          tone={lowCount > 0 ? "warn" : undefined}
        />
        <Stat
          label="Movimientos"
          value={movements.length.toString()}
          hint="últimos 100"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
          <Package className="size-4" />
          Stock actual
        </TabButton>
        <TabButton active={tab === "movements"} onClick={() => setTab("movements")}>
          <Sliders className="size-4" />
          Movimientos
        </TabButton>
        <TabButton active={tab === "ingredients"} onClick={() => setTab("ingredients")}>
          <Settings2 className="size-4" />
          Catálogo
        </TabButton>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {/* --------- STOCK TAB --------- */}
      {tab === "stock" ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setShowMovementForm((v) => !v)}
              disabled={ingredients.length === 0}
            >
              {showMovementForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showMovementForm ? "Cancelar" : "Registrar movimiento"}
            </Button>
          </div>

          {showMovementForm && activeBranchId ? (
            <GlassCard>
              <MovementForm
                organizationId={organizationId}
                branchId={activeBranchId}
                ingredients={ingredients.filter((i) => i.is_active)}
                onCancel={() => setShowMovementForm(false)}
                onSubmit={async (input) => {
                  await run("movement", () =>
                    apiRequest("/stock-movements", { method: "POST", body: input }),
                  );
                  setShowMovementForm(false);
                }}
              />
            </GlassCard>
          ) : null}

          <GlassCard className="p-2 sm:p-2">
            {levels.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin ingredientes en stock"
                hint="Agregá ingredientes al catálogo y registrá tu primera entrada."
              />
            ) : (
              <ul className="divide-y divide-[--gold-400]/10">
                {levels.map((l) => {
                  const low =
                    l.minStockAlert !== null && l.quantity < l.minStockAlert;
                  return (
                    <li
                      key={l.ingredientId}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[--cream]">
                          {l.ingredientName}
                        </p>
                        {l.minStockAlert !== null ? (
                          <p className="text-xs text-[--cream]/45">
                            mínimo {formatQty(l.minStockAlert)} {l.unit}
                          </p>
                        ) : null}
                      </div>
                      {low ? (
                        <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-200">
                          Bajo mínimo
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-right">
                        <span className="block text-lg font-semibold text-[--gold-100]">
                          {formatQty(l.quantity)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[--cream]/40">
                          {l.unit}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </>
      ) : null}

      {/* --------- MOVEMENTS TAB --------- */}
      {tab === "movements" ? (
        <GlassCard className="p-2 sm:p-2">
          {movements.length === 0 ? (
            <EmptyState
              icon={Sliders}
              title="Sin movimientos"
              hint="Cada entrada, salida o ajuste aparece acá con quién y cuándo."
            />
          ) : (
            <ul className="divide-y divide-[--gold-400]/10">
              {movements.map((m) => {
                const isInflow = m.quantityDelta > 0;
                const meta = MOVEMENT_META[m.kind as StockMovementKind] ?? MOVEMENT_META.entrada;
                const Icon = meta.icon;
                return (
                  <li
                    key={m.id}
                    className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-3 py-3"
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md",
                        isInflow
                          ? "bg-emerald-400/15 text-emerald-200"
                          : "bg-rose-400/15 text-rose-200",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[--cream]">
                        {m.ingredientName}
                      </p>
                      <p className="truncate text-xs text-[--cream]/50">
                        {meta.label}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-[--cream]/40">
                      {new Date(m.createdAt).toLocaleString("es-CR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-right font-mono text-sm font-semibold",
                          isInflow ? "text-emerald-200" : "text-rose-200",
                        )}
                      >
                        {isInflow ? "+" : ""}
                        {formatQty(m.quantityDelta)} {m.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Revertir este movimiento? El stock se ajustará automáticamente.`,
                            )
                          ) {
                            void run(m.id, () =>
                              apiRequest(`/stock-movements/${m.id}`, {
                                method: "DELETE",
                              }),
                            );
                          }
                        }}
                        disabled={busy === m.id}
                        className="rounded p-1 text-[--cream]/40 opacity-0 hover:bg-rose-500/20 hover:text-rose-200 group-hover:opacity-100"
                        aria-label="Revertir"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      ) : null}

      {/* --------- INGREDIENTS TAB (catalog) --------- */}
      {tab === "ingredients" ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setShowIngredientForm((v) => !v);
                setEditingIngredientId(null);
              }}
            >
              {showIngredientForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showIngredientForm ? "Cancelar" : "Nuevo ingrediente"}
            </Button>
          </div>

          {showIngredientForm ? (
            <GlassCard>
              <IngredientForm
                organizationId={organizationId}
                onCancel={() => setShowIngredientForm(false)}
                onSubmit={async (input) => {
                  await run("ingredient", async () => {
                    const created = await apiRequest<IngredientRow>("/ingredients", {
                      method: "POST",
                      body: input,
                    });
                    setIngredients((prev) =>
                      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
                    );
                  });
                  setShowIngredientForm(false);
                }}
              />
            </GlassCard>
          ) : null}

          <GlassCard className="p-2 sm:p-2">
            {ingredients.length === 0 ? (
              <EmptyState
                icon={Settings2}
                title="Sin ingredientes"
                hint="Agregá el primero (ej: Carne, Papas, Aceite) con el botón de arriba."
              />
            ) : (
              <ul className="divide-y divide-[--gold-400]/10">
                {ingredients.map((ing) => {
                  if (editingIngredientId === ing.id) {
                    return (
                      <li key={ing.id} className="px-3 py-3">
                        <IngredientForm
                          organizationId={organizationId}
                          initial={ing}
                          onCancel={() => setEditingIngredientId(null)}
                          onSubmit={async (input) => {
                            await run(`ing-${ing.id}`, async () => {
                              const updated = await apiRequest<IngredientRow>(
                                `/ingredients/${ing.id}`,
                                {
                                  method: "PATCH",
                                  body: {
                                    name: input.name,
                                    unit: input.unit,
                                    currentCost: input.currentCost,
                                    minStockAlert: input.minStockAlert ?? null,
                                  },
                                },
                              );
                              setIngredients((prev) =>
                                prev
                                  .map((i) => (i.id === ing.id ? updated : i))
                                  .sort((a, b) => a.name.localeCompare(b.name)),
                              );
                            });
                            setEditingIngredientId(null);
                          }}
                        />
                      </li>
                    );
                  }
                  return (
                    <li
                      key={ing.id}
                      className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[--cream]">
                          {ing.name}
                        </p>
                        <p className="text-xs text-[--cream]/50">
                          unidad: {ing.unit} · costo {formatMoneyShort(ing.current_cost)}
                          {ing.min_stock_alert !== null
                            ? ` · alerta < ${formatQty(Number(ing.min_stock_alert))} ${ing.unit}`
                            : ""}
                        </p>
                      </div>
                      {!ing.is_active ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-px text-[10px] uppercase tracking-wider text-rose-200">
                          Inactivo
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditingIngredientId(ing.id)}
                          disabled={busy === `ing-${ing.id}`}
                          className="rounded p-1.5 text-[--cream]/60 hover:bg-[--gold-400]/15 hover:text-[--cream]"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Borrar "${ing.name}"? Si tiene movimientos asociados se borran también.`,
                              )
                            ) {
                              void run(`ing-${ing.id}`, async () => {
                                await apiRequest(`/ingredients/${ing.id}`, {
                                  method: "DELETE",
                                });
                                setIngredients((prev) =>
                                  prev.filter((i) => i.id !== ing.id),
                                );
                              });
                            }
                          }}
                          disabled={busy === `ing-${ing.id}`}
                          className="rounded p-1.5 text-[--cream]/60 hover:bg-rose-500/20 hover:text-rose-200"
                          aria-label="Borrar"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

const MOVEMENT_META: Record<
  StockMovementKind,
  { label: string; icon: typeof ArrowDownToLine }
> = {
  [STOCK_MOVEMENT_KIND.ENTRADA]: { label: "Entrada", icon: ArrowDownToLine },
  [STOCK_MOVEMENT_KIND.SALIDA]: { label: "Salida", icon: ArrowUpFromLine },
  [STOCK_MOVEMENT_KIND.AJUSTE]: { label: "Ajuste", icon: Sliders },
};

function MovementForm({
  organizationId,
  branchId,
  ingredients,
  onCancel,
  onSubmit,
}: {
  organizationId: string;
  branchId: string;
  ingredients: IngredientRow[];
  onCancel: () => void;
  onSubmit: (input: {
    organizationId: string;
    branchId: string;
    ingredientId: string;
    kind: StockMovementKind;
    quantity: number;
    isPositive?: boolean;
    unitCost?: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const [kind, setKind] = useState<StockMovementKind>(STOCK_MOVEMENT_KIND.ENTRADA);
  const [quantity, setQuantity] = useState("");
  const [adjustSign, setAdjustSign] = useState<"+" | "-">("+");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0 || !ingredientId) return;
    setBusy(true);
    try {
      await onSubmit({
        organizationId,
        branchId,
        ingredientId,
        kind,
        quantity: q,
        isPositive: kind === STOCK_MOVEMENT_KIND.AJUSTE ? adjustSign === "+" : undefined,
        unitCost: unitCost ? Number(unitCost) : undefined,
        notes: notes.trim() || undefined,
      });
      setQuantity("");
      setNotes("");
    } finally {
      setBusy(false);
    }
  }

  if (ingredients.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[--gold-400]/20 px-4 py-6 text-center text-sm text-[--cream]/60">
        Necesitás al menos un ingrediente activo en el catálogo antes de registrar movimientos.
      </p>
    );
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Ingrediente</Label>
          <select
            value={ingredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            required
            disabled={busy}
            className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
          >
            {ingredients.map((i) => (
              <option key={i.id} value={i.id} className="bg-[#14110d]">
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Tipo</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.entries(MOVEMENT_META) as [StockMovementKind, (typeof MOVEMENT_META)[StockMovementKind]][]).map(
              ([key, meta]) => {
                const Icon = meta.icon;
                const active = kind === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setKind(key)}
                    disabled={busy}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
                      active
                        ? "border-[--gold-400]/60 bg-[--gold-400]/15 text-[--cream]"
                        : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {meta.label}
                  </button>
                );
              },
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Cantidad ({selectedIngredient?.unit ?? "—"})
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.000"
            required
            disabled={busy}
          />
        </div>
        {kind === STOCK_MOVEMENT_KIND.AJUSTE ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-[--cream]/70">Dirección</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setAdjustSign("+")}
                disabled={busy}
                className={cn(
                  "h-11 rounded-md border text-sm font-semibold transition-colors",
                  adjustSign === "+"
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
                    : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
                )}
              >
                + sumar
              </button>
              <button
                type="button"
                onClick={() => setAdjustSign("-")}
                disabled={busy}
                className={cn(
                  "h-11 rounded-md border text-sm font-semibold transition-colors",
                  adjustSign === "-"
                    ? "border-rose-400/60 bg-rose-400/15 text-rose-200"
                    : "border-[--gold-400]/15 text-[--cream]/60 hover:border-[--gold-400]/30",
                )}
              >
                − restar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs text-[--cream]/70">
              Costo unitario <span className="text-[--cream]/40">(opcional)</span>
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
              disabled={busy}
            />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-[--cream]/70">
            Notas <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Compra del lunes, ajuste por merma, etc."
            maxLength={500}
            disabled={busy}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || !quantity || !ingredientId}>
          {busy ? "Registrando..." : "Registrar movimiento"}
        </Button>
      </div>
    </form>
  );
}

function IngredientForm({
  organizationId,
  initial,
  onCancel,
  onSubmit,
}: {
  organizationId: string;
  initial?: IngredientRow;
  onCancel: () => void;
  onSubmit: (input: {
    organizationId: string;
    name: string;
    unit: string;
    currentCost?: number;
    minStockAlert?: number | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "kg");
  const [cost, setCost] = useState(initial ? String(initial.current_cost) : "");
  const [minAlert, setMinAlert] = useState(
    initial?.min_stock_alert !== null && initial?.min_stock_alert !== undefined
      ? String(initial.min_stock_alert)
      : "",
  );
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        organizationId,
        name: name.trim(),
        unit: unit.trim(),
        currentCost: cost ? Number(cost) : undefined,
        minStockAlert: minAlert ? Number(minAlert) : null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="space-y-4 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Nombre</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Carne molida"
            required
            maxLength={120}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Unidad</Label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="kg, g, l, unidad..."
            required
            maxLength={20}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Costo por unidad <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Alerta de stock mínimo <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={minAlert}
            onChange={(e) => setMinAlert(e.target.value)}
            placeholder="ej: 5 kg"
            disabled={busy}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || !name.trim() || !unit.trim()}>
          {busy ? "Guardando..." : initial ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
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
        tone === "warn" && "border-rose-400/30",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-[--cream]/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "warn" ? "text-rose-200" : "text-[--gold-100]",
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
  icon: typeof Package;
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

function formatQty(value: number): string {
  // Up to 3 decimals, trimmed.
  return new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatMoneyShort(value: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

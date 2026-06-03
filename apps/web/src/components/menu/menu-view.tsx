"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface CategoryRow {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductRow {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MenuViewProps {
  organizationId: string;
  initialCategories: CategoryRow[];
  initialProducts: ProductRow[];
}

// Sentinel used to indicate "show the new-product form" instead of editing one.
const NEW_PRODUCT = "__new__";

export function MenuView({
  organizationId,
  initialCategories,
  initialProducts,
}: MenuViewProps) {
  const router = useRouter();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleProducts = useMemo(
    () =>
      activeCategoryId
        ? initialProducts.filter((p) => p.category_id === activeCategoryId)
        : [],
    [initialProducts, activeCategoryId],
  );
  const activeCategory =
    initialCategories.find((c) => c.id === activeCategoryId) ?? null;

  async function withRefresh<T>(fn: () => Promise<T>): Promise<void> {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
          Carta
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          Tu menú
        </h1>
        <p className="text-sm text-[--cream]/60">
          Organizá categorías y productos. Cambios visibles al instante para
          todo el equipo.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* CATEGORIES PANEL */}
        <GlassCard className="p-4 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2 px-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[--cream]/50">
              Categorías
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowNewCategory((v) => !v);
                setEditingCategoryId(null);
              }}
              className="rounded-full p-1.5 text-[--gold-300] transition-colors hover:bg-[--gold-400]/10"
              aria-label="Nueva categoría"
            >
              {showNewCategory ? <X className="size-4" /> : <Plus className="size-4" />}
            </button>
          </div>

          {showNewCategory ? (
            <div className="mb-3">
              <CategoryForm
                organizationId={organizationId}
                onCancel={() => setShowNewCategory(false)}
                onSubmit={async (name) => {
                  await withRefresh(() =>
                    apiRequest("/categories", {
                      method: "POST",
                      body: { organizationId, name },
                    }),
                  );
                  setShowNewCategory(false);
                }}
              />
            </div>
          ) : null}

          {initialCategories.length === 0 && !showNewCategory ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Sin categorías"
              hint="Empezá creando una (Entradas, Bebidas, ...)"
            />
          ) : (
            <ul className="space-y-1">
              {initialCategories.map((cat) => {
                const isActive = cat.id === activeCategoryId;
                const isEditing = cat.id === editingCategoryId;
                if (isEditing) {
                  return (
                    <li key={cat.id}>
                      <CategoryForm
                        organizationId={organizationId}
                        initialName={cat.name}
                        onCancel={() => setEditingCategoryId(null)}
                        onSubmit={async (name) => {
                          await withRefresh(() =>
                            apiRequest(`/categories/${cat.id}`, {
                              method: "PATCH",
                              body: { name },
                            }),
                          );
                          setEditingCategoryId(null);
                        }}
                      />
                    </li>
                  );
                }
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={cn(
                        "group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        isActive
                          ? "bg-[--gold-400]/15 text-[--cream]"
                          : "text-[--cream]/70 hover:bg-[--gold-400]/8 hover:text-[--cream]",
                      )}
                    >
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span
                          role="button"
                          aria-label="Editar categoría"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryId(cat.id);
                          }}
                          className="rounded p-1 text-[--cream]/60 hover:bg-[--gold-400]/15 hover:text-[--cream]"
                        >
                          <Pencil className="size-3.5" />
                        </span>
                        <span
                          role="button"
                          aria-label="Borrar categoría"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `¿Borrar la categoría "${cat.name}"? No se puede deshacer.`,
                              )
                            ) {
                              setPendingId(cat.id);
                              void withRefresh(() =>
                                apiRequest(`/categories/${cat.id}`, {
                                  method: "DELETE",
                                }),
                              ).finally(() => setPendingId(null));
                            }
                          }}
                          className={cn(
                            "rounded p-1 text-[--cream]/60 hover:bg-rose-500/20 hover:text-rose-200",
                            pendingId === cat.id && "opacity-50",
                          )}
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        {/* PRODUCTS PANEL */}
        <GlassCard className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[--cream]/50">
                Productos
              </h2>
              <p className="mt-1 text-lg font-medium text-[--cream]">
                {activeCategory?.name ?? "Seleccioná una categoría"}
              </p>
            </div>
            {activeCategory ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingProductId(
                    editingProductId === NEW_PRODUCT ? null : NEW_PRODUCT,
                  );
                }}
              >
                <Plus className="size-4" />
                {editingProductId === NEW_PRODUCT ? "Cancelar" : "Nuevo producto"}
              </Button>
            ) : null}
          </div>

          {editingProductId === NEW_PRODUCT && activeCategory ? (
            <div className="mb-4">
              <ProductForm
                organizationId={organizationId}
                categoryId={activeCategory.id}
                onCancel={() => setEditingProductId(null)}
                onSubmit={async (input) => {
                  await withRefresh(() =>
                    apiRequest("/products", { method: "POST", body: input }),
                  );
                  setEditingProductId(null);
                }}
              />
            </div>
          ) : null}

          {!activeCategory ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No hay categoría activa"
              hint="Creá o seleccioná una categoría en el panel izquierdo."
            />
          ) : visibleProducts.length === 0 &&
            editingProductId !== NEW_PRODUCT ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={`Sin productos en "${activeCategory.name}"`}
              hint='Agregá el primero con el botón "Nuevo producto".'
            />
          ) : (
            <ul className="divide-y divide-[--gold-400]/10">
              {visibleProducts.map((p) =>
                editingProductId === p.id ? (
                  <li key={p.id} className="py-3">
                    <ProductForm
                      organizationId={organizationId}
                      categoryId={p.category_id}
                      initial={p}
                      onCancel={() => setEditingProductId(null)}
                      onSubmit={async (input) => {
                        // Strip categoryId/organizationId on update; PATCH only the diff.
                        const { categoryId: _c, organizationId: _o, ...rest } = input;
                        await withRefresh(() =>
                          apiRequest(`/products/${p.id}`, {
                            method: "PATCH",
                            body: rest,
                          }),
                        );
                        setEditingProductId(null);
                      }}
                    />
                  </li>
                ) : (
                  <li
                    key={p.id}
                    className="group flex items-center gap-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[--cream]">
                        {p.name}
                      </p>
                      {p.description ? (
                        <p className="mt-0.5 truncate text-xs text-[--cream]/55">
                          {p.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[--gold-200]">
                        {formatMoney(p.price)}
                      </p>
                      {p.cost > 0 ? (
                        <p className="text-[10px] uppercase tracking-wider text-[--cream]/40">
                          costo {formatMoney(p.cost)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingProductId(p.id)}
                        className="rounded p-1.5 text-[--cream]/60 hover:bg-[--gold-400]/15 hover:text-[--cream]"
                        aria-label="Editar producto"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Borrar "${p.name}"? No se puede deshacer.`,
                            )
                          ) {
                            setPendingId(p.id);
                            void withRefresh(() =>
                              apiRequest(`/products/${p.id}`, { method: "DELETE" }),
                            ).finally(() => setPendingId(null));
                          }
                        }}
                        className={cn(
                          "rounded p-1.5 text-[--cream]/60 hover:bg-rose-500/20 hover:text-rose-200",
                          pendingId === p.id && "opacity-50",
                        )}
                        aria-label="Borrar producto"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

function CategoryForm({
  organizationId: _orgId,
  initialName = "",
  onCancel,
  onSubmit,
}: {
  organizationId: string;
  initialName?: string;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la categoría"
        required
        maxLength={80}
        disabled={busy}
        className="h-9"
      />
      <Button type="submit" size="sm" disabled={busy || !name.trim()}>
        OK
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        <X className="size-4" />
      </Button>
    </form>
  );
}

interface ProductFormProps {
  organizationId: string;
  categoryId: string;
  initial?: ProductRow;
  onCancel: () => void;
  onSubmit: (input: {
    organizationId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
  }) => Promise<void>;
}

function ProductForm({
  organizationId,
  categoryId,
  initial,
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [cost, setCost] = useState(initial ? String(initial.cost) : "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        organizationId,
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        cost: cost ? Number(cost) : undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-3 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-[--cream]/70">Nombre</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bife de chorizo"
            required
            maxLength={120}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-[--cream]/70">
            Descripción <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="500g, term. medio, papas rústicas"
            maxLength={500}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Precio</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Costo <span className="text-[--cream]/40">(opcional)</span>
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-[--cream]/70">
            URL de imagen <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            disabled={busy}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando..." : initial ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof UtensilsCrossed;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[--gold-400]/20 px-6 py-10 text-center">
      <Icon className="size-8 text-[--gold-400]/60" />
      <div>
        <p className="text-sm font-medium text-[--cream]">{title}</p>
        <p className="mt-1 text-xs text-[--cream]/55">{hint}</p>
      </div>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

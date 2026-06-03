"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";

interface BranchOption {
  id: string;
  name: string;
}

interface TableOption {
  id: string;
  name: string;
  branch_id: string;
  status: string;
}

interface NewOrderFormProps {
  organizationId: string;
  branches: BranchOption[];
  tables: TableOption[];
}

export function NewOrderForm({
  organizationId,
  branches,
  tables,
}: NewOrderFormProps) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [tableId, setTableId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesForBranch = useMemo(
    () => tables.filter((t) => t.branch_id === branchId),
    [tables, branchId],
  );

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const order = await apiRequest<{ id: string }>("/orders", {
        method: "POST",
        body: {
          organizationId,
          branchId,
          tableId: tableId || null,
          notes: notes.trim() || undefined,
        },
      });
      router.push(`/ordenes/${order.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setBusy(false);
    }
  }

  if (branches.length === 0) {
    return (
      <GlassCard>
        <div className="py-10 text-center space-y-2">
          <h2 className="text-lg font-medium text-[--cream]">Sin sucursales activas</h2>
          <p className="text-sm text-[--cream]/60">
            Creá una sucursal antes de abrir órdenes.
          </p>
        </div>
      </GlassCard>
    );
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

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
          Nueva orden
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream]">
          Abrir orden
        </h1>
        <p className="text-sm text-[--cream]/60">
          Elegí sucursal y mesa. Después agregás los productos.
        </p>
      </header>

      <GlassCard>
        <form onSubmit={handle} className="space-y-5">
          {branches.length > 1 ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-[--cream]/70">Sucursal</Label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setTableId("");
                }}
                disabled={busy}
                className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#14110d]">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs text-[--cream]/70">
              Mesa <span className="text-[--cream]/40">(opcional)</span>
            </Label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              disabled={busy}
              className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
            >
              <option value="" className="bg-[#14110d]">
                Sin mesa
              </option>
              {tablesForBranch.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#14110d]">
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[--cream]/70">
              Notas <span className="text-[--cream]/40">(opcional)</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comensales VIP, sin gluten, etc."
              maxLength={1000}
              disabled={busy}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy || !branchId}>
            {busy ? "Abriendo..." : "Abrir orden"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ChefHat,
  Crown,
  Mail,
  Pencil,
  Shield,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ROLES, type Role } from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface MemberRow {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface TeamViewProps {
  organizationId: string;
  currentUserId: string;
  initialMembers: MemberRow[];
  branches: BranchOption[];
  loadError: string | null;
}

const ROLE_META: Record<
  Role,
  { label: string; icon: typeof UserIcon; pill: string }
> = {
  [ROLES.OWNER]: {
    label: "Dueño",
    icon: Crown,
    pill: "bg-[--gold-400]/15 text-[--gold-100] border-[--gold-400]/40",
  },
  [ROLES.ADMIN]: {
    label: "Administrador",
    icon: Shield,
    pill: "bg-sky-400/15 text-sky-200 border-sky-400/30",
  },
  [ROLES.WAITER]: {
    label: "Mesero",
    icon: UserIcon,
    pill: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  },
  [ROLES.KITCHEN]: {
    label: "Cocina",
    icon: ChefHat,
    pill: "bg-violet-400/15 text-violet-200 border-violet-400/30",
  },
};

export function TeamView({
  organizationId,
  currentUserId,
  initialMembers,
  branches,
  loadError,
}: TeamViewProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);

  const stats = useMemo(() => {
    const c = (role: Role) =>
      initialMembers.filter((m) => m.role === role && m.is_active).length;
    return {
      total: initialMembers.length,
      owners: c(ROLES.OWNER),
      admins: c(ROLES.ADMIN),
      waiters: c(ROLES.WAITER),
      kitchen: c(ROLES.KITCHEN),
    };
  }, [initialMembers]);

  async function run<T>(id: string, fn: () => Promise<T>): Promise<void> {
    setBusy(id);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  const currentUserRole =
    initialMembers.find((m) => m.user_id === currentUserId)?.role ?? null;
  const canManage =
    currentUserRole === ROLES.OWNER || currentUserRole === ROLES.ADMIN;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">
            Equipo
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
            Personas con acceso
          </h1>
          <p className="text-sm text-[--cream]/60">
            Invitá meseros, admins o cocina. Cada uno ve solo lo que su rol permite.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            onClick={() => {
              setShowAdd((v) => !v);
              setEditingId(null);
            }}
          >
            {showAdd ? <X className="size-4" /> : <UserPlus className="size-4" />}
            {showAdd ? "Cancelar" : "Agregar miembro"}
          </Button>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Dueños" value={stats.owners} />
        <Stat label="Admins" value={stats.admins} />
        <Stat
          label="Operación"
          value={stats.waiters + stats.kitchen}
          hint={`${stats.waiters} mesero${stats.waiters === 1 ? "" : "s"} · ${stats.kitchen} cocina`}
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

      {showAdd && canManage ? (
        <GlassCard>
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[--cream]/50">
            Agregar miembro
          </h2>
          <AddMemberForm
            branches={branches}
            onCancel={() => setShowAdd(false)}
            onSubmit={async (input) => {
              await run("add", () =>
                apiRequest("/memberships", {
                  method: "POST",
                  body: { ...input, organizationId },
                }),
              );
              setShowAdd(false);
            }}
          />
        </GlassCard>
      ) : null}

      <GlassCard className="p-2 sm:p-2">
        {initialMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <Users className="size-8 text-[--gold-400]/60" />
            <div>
              <p className="text-sm font-medium text-[--cream]">
                Sin miembros todavía
              </p>
              <p className="mt-1 text-xs text-[--cream]/55">
                Agregá personas a tu equipo con el botón de arriba.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[--gold-400]/10">
            {initialMembers.map((m) => {
              const meta =
                ROLE_META[m.role as Role] ?? ROLE_META[ROLES.WAITER]!;
              const Icon = meta.icon;
              const isSelf = m.user_id === currentUserId;
              const isEditing = m.membership_id === editingId;
              const branchName =
                m.branch_id
                  ? branches.find((b) => b.id === m.branch_id)?.name ?? "Sucursal"
                  : "Todas las sucursales";

              if (isEditing) {
                return (
                  <li key={m.membership_id} className="px-3 py-3">
                    <EditMemberForm
                      initialRole={m.role as Role}
                      initialBranchId={m.branch_id}
                      initialIsActive={m.is_active}
                      branches={branches}
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (patch) => {
                        await run(m.membership_id, () =>
                          apiRequest(`/memberships/${m.membership_id}`, {
                            method: "PATCH",
                            body: patch,
                          }),
                        );
                        setEditingId(null);
                      }}
                    />
                  </li>
                );
              }

              return (
                <li
                  key={m.membership_id}
                  className={cn(
                    "group flex items-center gap-4 px-3 py-3",
                    !m.is_active && "opacity-50",
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[--gold-300] to-[--gold-600] text-[11px] font-semibold text-[#1a1611]">
                    {initials(m.full_name, m.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[--cream]">
                        {m.full_name || m.email}
                      </p>
                      {isSelf ? (
                        <span className="rounded-full border border-[--gold-400]/20 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--cream]/55">
                          Vos
                        </span>
                      ) : null}
                      {!m.is_active ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-px text-[9px] uppercase tracking-wider text-rose-200">
                          Inactivo
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-[--cream]/50">
                      {m.email} · {branchName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      meta.pill,
                    )}
                  >
                    <Icon className="size-3" />
                    {meta.label}
                  </span>
                  {canManage && !isSelf ? (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingId(m.membership_id)}
                        disabled={busy === m.membership_id}
                        className="rounded p-1.5 text-[--cream]/60 hover:bg-[--gold-400]/15 hover:text-[--cream]"
                        aria-label="Editar miembro"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Quitar a ${m.full_name || m.email} del equipo?`,
                            )
                          ) {
                            void run(m.membership_id, () =>
                              apiRequest(`/memberships/${m.membership_id}`, {
                                method: "DELETE",
                              }),
                            );
                          }
                        }}
                        disabled={busy === m.membership_id}
                        className="rounded p-1.5 text-[--cream]/60 hover:bg-rose-500/20 hover:text-rose-200"
                        aria-label="Quitar miembro"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

// --------------------------------------------------------------------------
// Add member form
// --------------------------------------------------------------------------

function AddMemberForm({
  branches,
  onCancel,
  onSubmit,
}: {
  branches: BranchOption[];
  onCancel: () => void;
  onSubmit: (input: {
    email: string;
    role: Role;
    branchId: string | null;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(ROLES.WAITER);
  const [branchId, setBranchId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        email: email.trim(),
        role,
        branchId: branchId || null,
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-[--cream]/70">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[--cream]/45" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@ejemplo.com"
              required
              autoFocus
              disabled={busy}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-[--cream]/45">
            Tienen que haberse registrado en /signup primero. Si todavía no lo
            hicieron, vas a ver un error con instrucciones.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">Rol</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={busy}
            className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
          >
            {(Object.entries(ROLE_META) as [Role, (typeof ROLE_META)[Role]][]).map(
              ([key, meta]) => (
                <option key={key} value={key} className="bg-[#14110d]">
                  {meta.label}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[--cream]/70">
            Sucursal <span className="text-[--cream]/40">(opcional)</span>
          </Label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={busy || branches.length === 0}
            className="flex h-11 w-full rounded-lg border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-3 py-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
          >
            <option value="" className="bg-[#14110d]">
              Todas las sucursales
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#14110d]">
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || !email.trim()}>
          {busy ? "Agregando..." : "Agregar al equipo"}
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------
// Edit member form (inline row)
// --------------------------------------------------------------------------

function EditMemberForm({
  initialRole,
  initialBranchId,
  initialIsActive,
  branches,
  onCancel,
  onSubmit,
}: {
  initialRole: Role;
  initialBranchId: string | null;
  initialIsActive: boolean;
  branches: BranchOption[];
  onCancel: () => void;
  onSubmit: (patch: {
    role?: Role;
    branchId?: string | null;
    isActive?: boolean;
  }) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [branchId, setBranchId] = useState<string>(initialBranchId ?? "");
  const [isActive, setIsActive] = useState(initialIsActive);
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const patch: {
        role?: Role;
        branchId?: string | null;
        isActive?: boolean;
      } = {};
      if (role !== initialRole) patch.role = role;
      const newBranchId = branchId || null;
      if (newBranchId !== initialBranchId) patch.branchId = newBranchId;
      if (isActive !== initialIsActive) patch.isActive = isActive;
      if (Object.keys(patch).length === 0) {
        onCancel();
        return;
      }
      await onSubmit(patch);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="grid gap-3 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
    >
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-[--cream]/50">Rol</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={busy}
          className="flex h-9 w-full rounded-md border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
        >
          {(Object.entries(ROLE_META) as [Role, (typeof ROLE_META)[Role]][]).map(
            ([key, meta]) => (
              <option key={key} value={key} className="bg-[#14110d]">
                {meta.label}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-[--cream]/50">Sucursal</Label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={busy}
          className="flex h-9 w-full rounded-md border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] px-2 text-sm text-[--cream] focus-visible:border-[--gold-400]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/30"
        >
          <option value="" className="bg-[#14110d]">
            Todas
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id} className="bg-[#14110d]">
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-end gap-2 text-xs text-[--cream]/70">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={busy}
          className="size-4 accent-[--gold-400]"
        />
        Activo
      </label>
      <div className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          OK
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[--gold-400]/15 bg-[#14110d]/55 p-4 backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[--cream]/40">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[--gold-100]">{value}</p>
      {hint ? <p className="text-xs text-[--cream]/50">{hint}</p> : null}
    </div>
  );
}

function initials(fullName: string | null, email: string): string {
  const src = (fullName && fullName.trim()) || email;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}


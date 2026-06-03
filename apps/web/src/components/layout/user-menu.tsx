"use client";

import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { signOutAction } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  fullName: string | null;
  email: string;
}

function initials(name: string | null, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ fullName, email }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-full border border-[--gold-400]/15 bg-[--gold-400]/[0.04] py-1 pl-1 pr-3 text-sm text-[--cream] transition-colors hover:bg-[--gold-400]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/40"
        >
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[--gold-300] to-[--gold-600] text-[11px] font-semibold text-[#1a1611] shadow-[0_0_10px_rgba(212,163,92,0.35)]"
          >
            {initials(fullName, email)}
          </span>
          <span className="hidden text-sm font-medium sm:inline">
            {fullName ?? email}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Tu cuenta</DropdownMenuLabel>
        <div className="px-3 pb-2">
          <p className="truncate text-sm text-[--cream]">{fullName ?? "Sin nombre"}</p>
          <p className="truncate text-xs text-[--cream]/50">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon />
          <span className="flex-1">Mi perfil</span>
          <span className="rounded-full border border-[--gold-400]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--cream]/40">
            Pronto
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings />
          <span className="flex-1">Configuración</span>
          <span className="rounded-full border border-[--gold-400]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--cream]/40">
            Pronto
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="w-full text-left text-rose-200 focus:bg-rose-500/15 data-[highlighted]:bg-rose-500/15"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

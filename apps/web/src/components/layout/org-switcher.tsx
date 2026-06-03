"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OrgOption {
  id: string;
  name: string;
  role: string;
}

interface OrgSwitcherProps {
  orgs: OrgOption[];
  currentOrgId: string;
}

export function OrgSwitcher({ orgs, currentOrgId }: OrgSwitcherProps) {
  const current = orgs.find((o) => o.id === currentOrgId) ?? orgs[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2.5 rounded-lg border border-[--gold-400]/15 bg-[--gold-400]/[0.04] px-3 py-1.5 text-sm text-[--cream] transition-colors hover:bg-[--gold-400]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--gold-400]/40"
        >
          <Building2 className="size-4 text-[--gold-400]" />
          <span className="font-medium">{current.name}</span>
          <span className="rounded-full border border-[--gold-400]/20 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--gold-300]">
            {current.role}
          </span>
          <ChevronsUpDown className="size-3.5 text-[--cream]/40 transition-colors group-hover:text-[--cream]/60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Tus restaurantes</DropdownMenuLabel>
        {orgs.map((org) => {
          const isActive = org.id === current.id;
          return (
            <DropdownMenuItem key={org.id} disabled={isActive}>
              <Building2 className="text-[--gold-400]" />
              <div className="flex-1">
                <p className="text-sm">{org.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-[--cream]/40">
                  {org.role}
                </p>
              </div>
              {isActive ? <Check className="text-[--gold-300]" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Building2 />
          <span className="text-[--cream]/60">Crear otro restaurante</span>
          <span className="ml-auto rounded-full border border-[--gold-400]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--cream]/40">
            Pronto
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  FileText,
  Grid3X3,
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/menu", label: "Menú", icon: UtensilsCrossed, available: true },
  { href: "/mesas", label: "Mesas", icon: Grid3X3, available: true },
  { href: "/ordenes", label: "Órdenes", icon: Receipt, available: true },
  { href: "/cocina", label: "Cocina", icon: ChefHat, available: true },
  { href: "/facturacion", label: "Facturación", icon: FileText, available: true },
  { href: "/inventario", label: "Inventario", icon: Package, available: false },
  { href: "/proveedores", label: "Proveedores", icon: Truck, available: false },
  { href: "/reportes", label: "Reportes", icon: BarChart3, available: false },
  { href: "/equipo", label: "Equipo", icon: Users, available: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[--gold-400]/15 bg-[#0d0b08]/70 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[--gold-400]/15 px-6">
        <div
          aria-hidden
          className="size-8 rounded-md bg-gradient-to-br from-[--gold-300] to-[--gold-600] shadow-[0_0_12px_rgba(212,163,92,0.4)]"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-wide text-[--cream]">
            Restaurant
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[--gold-400]/80">
            ERP
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.available &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            if (!item.available) {
              return (
                <li key={item.href}>
                  <div
                    aria-disabled
                    className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[--cream]/35"
                    title="Próximamente"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-full border border-[--gold-400]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[--cream]/40">
                      Pronto
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[--gold-400]/15 text-[--cream] shadow-[inset_0_0_0_1px_rgba(212,163,92,0.25)]"
                      : "text-[--cream]/70 hover:bg-[--gold-400]/8 hover:text-[--cream]",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[--gold-300] shadow-[0_0_10px_rgba(212,163,92,0.6)]"
                    />
                  ) : null}
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[--gold-400]/15 px-6 py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[--cream]/40">
          v0.1 · alpha
        </p>
      </div>
    </aside>
  );
}

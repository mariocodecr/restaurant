import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Layout
        "flex h-11 w-full min-w-0 rounded-lg px-3 py-2 text-base md:text-sm",
        // Glass background + warm border + readable cream text on dark
        "border border-[--gold-400]/20 bg-[#d4a35c]/[0.05] text-[--cream] placeholder:text-[--cream]/40",
        "shadow-[inset_0_1px_0_rgba(255,220,160,0.04)] backdrop-blur",
        // Focus state — warm gold glow matching stardust palette
        "outline-none transition-[color,box-shadow,border-color]",
        "focus-visible:border-[--gold-400]/70 focus-visible:ring-2 focus-visible:ring-[--gold-400]/30",
        // Disabled + invalid
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-rose-400/60 aria-invalid:ring-2 aria-invalid:ring-rose-400/30",
        // File input bits
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[--cream]",
        // Selection
        "selection:bg-[--gold-400]/30 selection:text-[--cream]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

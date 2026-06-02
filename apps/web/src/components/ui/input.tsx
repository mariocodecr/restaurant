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
        // Glass background + soft border + readable text on dark
        "border border-white/10 bg-white/5 text-white placeholder:text-white/35",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur",
        // Focus state — icy blue glow consistent with stardust palette
        "outline-none transition-[color,box-shadow,border-color]",
        "focus-visible:border-sky-400/60 focus-visible:ring-2 focus-visible:ring-sky-400/30",
        // Disabled + invalid
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-rose-400/60 aria-invalid:ring-2 aria-invalid:ring-rose-400/30",
        // File input bits
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
        // Selection
        "selection:bg-sky-400/30 selection:text-white",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

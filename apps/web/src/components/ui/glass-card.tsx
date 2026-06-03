import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassCard({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-[--gold-400]/15 bg-[#14110d]/55 p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8",
          // Warm inner highlight at the top edge — adds the "polished gold rim" feel
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[--gold-300]/40 before:to-transparent",
          className,
        )}
        {...props}
      />
    );
  },
);

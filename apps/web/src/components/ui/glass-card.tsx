import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassCard({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-8",
          // Subtle inner highlight at the top edge — adds the "polished glass" feel
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          className,
        )}
        {...props}
      />
    );
  },
);

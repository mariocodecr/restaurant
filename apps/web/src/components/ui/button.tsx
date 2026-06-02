import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Stardust = luxury pearl/glow primary button (default).
// Glass = frosted-outline secondary.
// Ghost = minimal tertiary.
//
// The actual visual treatments live in globals.css under .stardust-btn /
// .glass-btn / .ghost-btn — variants here only control sizing, layout and
// composition. Keep the visual rules in one place (CSS) so multiple
// instances on a page don't ship duplicate inline <style> tags.
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "stardust-btn",
        outline: "glass-btn",
        ghost: "ghost-btn",
        // Kept for back-compat with magic-generated snippets that ask for
        // "secondary" — we route it to the glass treatment.
        secondary: "glass-btn",
        destructive:
          "stardust-btn [--stardust-bg:#3b0a0a] [&_*]:!text-rose-100",
        link: "text-sky-300 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isStardust = (variant ?? "default") === "default" || variant === "destructive";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {isStardust ? (
        <span className="stardust-wrap">
          <span aria-hidden className="stardust-spark-idle">✧</span>
          <span aria-hidden className="stardust-spark-hover">✦</span>
          {children}
        </span>
      ) : (
        <span className="inline-flex w-full items-center justify-center gap-2">
          {children}
        </span>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };

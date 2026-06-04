import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Stardust = luxury pearl/glow primary button (default).
// Glass = frosted-outline secondary.
// Ghost = minimal tertiary.
//
// Visual treatment lives in globals.css. The pseudo-elements (sheen +
// halo) are now on .stardust-btn itself, so children render directly
// (no inner wrapper). This keeps `asChild` clean — `<Button asChild>
// <Link>…</Link></Button>` becomes a single <Link class="stardust-btn">.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 leading-none",
  {
    variants: {
      variant: {
        default: "stardust-btn",
        outline: "glass-btn",
        ghost: "ghost-btn",
        secondary: "glass-btn",
        destructive:
          "stardust-btn [--stardust-bg-from:#3b0a0a] [--stardust-bg-via:#6b1818] [--stardust-bg-to:#a83838] [&_*]:!text-rose-100",
        link: "text-[--gold-300] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
        icon: "h-11 w-11 px-0",
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
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

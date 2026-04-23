import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] px-4 py-2 text-[var(--accent-foreground)] shadow-[var(--shadow-button)] hover:bg-[var(--accent-hover)]",
        secondary:
          "border border-[var(--border-subtle)] bg-white/[0.06] px-4 py-2 text-[var(--foreground)] hover:border-[var(--border)] hover:bg-white/[0.1]",
        outline:
          "border border-[var(--border)] bg-transparent px-4 py-2 text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-white/[0.045]",
        ghost: "px-3 py-2 text-[var(--foreground)] hover:bg-white/[0.055]",
        danger:
          "border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-2 text-rose-100 hover:bg-rose-500/20",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

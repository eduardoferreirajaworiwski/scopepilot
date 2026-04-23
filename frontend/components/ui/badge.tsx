import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
  {
    variants: {
      variant: {
        neutral: "border-white/10 bg-white/[0.05] text-[var(--muted-foreground)]",
        success: "border-emerald-500/30 bg-emerald-500/12 text-emerald-200",
        warning: "border-amber-500/30 bg-amber-500/12 text-amber-200",
        danger: "border-rose-500/30 bg-rose-500/12 text-rose-200",
        info: "border-sky-500/30 bg-sky-500/12 text-sky-200",
        accent: "border-teal-400/30 bg-teal-400/12 text-teal-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}


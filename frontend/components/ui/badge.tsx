import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border-subtle)] bg-white/[0.045] text-[var(--muted-foreground)]",
        success: "border-[var(--success-border)] bg-[var(--success-soft)] text-emerald-100",
        warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-amber-100",
        danger: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-rose-100",
        info: "border-[var(--info-border)] bg-[var(--info-soft)] text-sky-100",
        accent: "border-[var(--border-accent)] bg-[var(--accent-soft)] text-teal-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      <span className="status-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <span>{children}</span>
    </div>
  );
}

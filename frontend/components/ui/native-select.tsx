import * as React from "react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-[var(--border-subtle)] bg-white/[0.035] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-accent)] focus:bg-white/[0.055] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55 [&_option]:bg-[#0b1420] [&_option]:text-[var(--foreground)]",
          className,
        )}
        {...props}
      />
    );
  },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };

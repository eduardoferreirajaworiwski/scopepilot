import * as React from "react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-white/20 focus:bg-white/[0.05]",
          className,
        )}
        {...props}
      />
    );
  },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };

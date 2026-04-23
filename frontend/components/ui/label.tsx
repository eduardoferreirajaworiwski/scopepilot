import * as React from "react";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]", className)}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };

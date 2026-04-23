import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-3xl space-y-3">
        <p className="eyebrow">ScopePilot operator workflow</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em] text-[var(--foreground-strong)] md:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] md:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WorkflowStage = {
  label: string;
  href?: string;
  count: string;
  status: string;
  description: string;
};

export function WorkflowStageRail({
  title = "Workflow separation",
  description = "Each stage stays visible as its own control boundary. Approval does not imply execution, and evidence does not become a finding without provenance.",
  stages,
  className,
}: {
  title?: string;
  description?: string;
  stages: WorkflowStage[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <p className="eyebrow">
          {"Program -> target -> hypothesis -> approval -> execution -> evidence -> finding"}
        </p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {stages.map((stage, index) => {
            const body = (
              <div
                className={cn(
                  "group relative h-full rounded-[22px] border p-4 transition-colors",
                  stage.href
                    ? "border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:border-[var(--border-accent)] hover:bg-[var(--surface-hover)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-inset)]",
                )}
              >
                {index < stages.length - 1 ? (
                  <div className="pointer-events-none absolute top-7 -right-3 hidden h-px w-3 bg-[var(--border)] xl:block" />
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--subtle-foreground)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <StatusBadge status={stage.status} />
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white">{stage.count}</div>
                <div className="mt-2 text-sm font-semibold text-[var(--foreground-strong)]">{stage.label}</div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{stage.description}</p>
              </div>
            );

            return stage.href ? (
              <Link key={stage.label} href={stage.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={stage.label}>{body}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "1. Show explicit scope",
    body: "Open Programs to show one authorized surface, one denied target, and why scope is treated as a real security boundary.",
    href: "/programs",
    cta: "Open programs",
    status: "confirmed",
  },
  {
    title: "2. Show human review",
    body: "Open Approvals to make the distinction between AI hypothesis, human decision, pending review, and rejected work unmistakable.",
    href: "/approvals",
    cta: "Open approvals",
    status: "pending",
  },
  {
    title: "3. Show execution controls",
    body: "Open Executions to show request, queue, manual dispatch, running work, and evidence-backed completion as separate states.",
    href: "/executions",
    cta: "Open executions",
    status: "running",
  },
  {
    title: "4. Close with evidence and audit",
    body: "Open Findings and Audit to show that the product preserves provenance from execution to evidence to report-ready output.",
    href: "/findings",
    cta: "Open findings",
    status: "reported",
  },
];

export function DemoWalkthroughPanel({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <p className="eyebrow">Suggested Demo Flow</p>
        <CardTitle>75-second portfolio walkthrough</CardTitle>
        <CardDescription>
          Best shown with the seeded demo dataset: one completed finding, one running execution, one queued execution,
          one pending approval, and one rejected path.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-4">
        {steps.map((step) => (
          <div key={step.title} className="subpanel flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">{step.title}</div>
              <StatusBadge status={step.status} />
            </div>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">{step.body}</p>
            <Link href={step.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {step.cta}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

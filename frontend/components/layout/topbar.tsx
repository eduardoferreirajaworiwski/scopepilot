"use client";

import { usePathname } from "next/navigation";

import { StatusBadge } from "@/components/shared/status-badge";
import { useHealthQuery } from "@/lib/api/hooks";

const pageLabels: Record<string, string> = {
  "/": "Operational overview",
  "/programs": "Program inventory",
  "/hypotheses": "Hypothesis review",
  "/approvals": "Human approval workflow",
  "/findings": "Findings and reports",
  "/audit": "Audit reconstruction",
};

export function Topbar() {
  const pathname = usePathname();
  const healthQuery = useHealthQuery();

  const section =
    pathname.startsWith("/programs/")
      ? "Program detail"
      : pageLabels[pathname] ?? "Operator workspace";

  const healthy = healthQuery.data?.status === "ok";

  return (
    <header className="panel-strong sticky top-4 z-20 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">ScopePilot</p>
          <div className="mt-1 text-lg font-semibold text-white">{section}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            status={healthy ? "approved" : "pending"}
            label={healthy ? "API Connected" : healthQuery.isPending ? "Checking API" : "API Unreachable"}
          />
          <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Human-in-the-loop enforced
          </div>
        </div>
      </div>
    </header>
  );
}


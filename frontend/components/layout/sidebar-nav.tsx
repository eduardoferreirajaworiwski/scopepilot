"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  {
    href: "/",
    label: "Dashboard",
    description: "Global operating view",
    glyph: "01",
  },
  {
    href: "/programs",
    label: "Programs",
    description: "Scope and target inventory",
    glyph: "02",
  },
  {
    href: "/hypotheses",
    label: "Hypotheses Queue",
    description: "AI proposals waiting review",
    glyph: "03",
  },
  {
    href: "/approvals",
    label: "Approval Queue",
    description: "Human decision lane",
    glyph: "04",
  },
  {
    href: "/findings",
    label: "Findings / Reports",
    description: "Evidence and narrative outputs",
    glyph: "05",
  },
  {
    href: "/audit",
    label: "Audit Trail",
    description: "Durable decision log",
    glyph: "06",
  },
];

export function SidebarNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-3", mobile ? "overflow-x-auto pb-2" : "flex-col")}>
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex shrink-0 items-start gap-4 rounded-[24px] border px-4 py-4 transition-colors",
              active
                ? "border-white/15 bg-white/[0.07]"
                : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em]",
                active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-white/[0.06] text-white/80",
              )}
            >
              {item.glyph}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{item.label}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.description}</div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}


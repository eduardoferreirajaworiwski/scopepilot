import type { Metadata } from "next";

import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: "ScopePilot | Human-in-the-loop security operations",
  description:
    "Operator console for authorized bug bounty workflows with explicit scope controls, human approval gates, evidence provenance, and auditability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}

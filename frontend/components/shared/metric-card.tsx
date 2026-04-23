import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral",
}: {
  label: string;
  value: string;
  description: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "text-white",
    accent: "text-teal-100",
    success: "text-emerald-100",
    warning: "text-amber-100",
    danger: "text-rose-100",
    info: "text-sky-100",
  }[tone];

  return (
    <Card className="metric-surface">
      <CardHeader className="relative z-10 gap-4">
        <p className="eyebrow">{label}</p>
        <CardTitle className={cn("text-4xl leading-none tracking-[-0.045em] md:text-5xl", toneClass)}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      </CardContent>
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";
import { humanizeToken } from "@/lib/format";

const variants = {
  // Workflow states
  pending: "warning",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
  expired: "danger",
  blocked: "danger",
  draft: "neutral",
  executed: "info",
  queued: "neutral",
  running: "info",
  completed: "success",
  confirmed: "success",
  new: "neutral",
  reported: "info",
  closed: "neutral",

  // Generic tones and severity labels used by pages.
  neutral: "neutral",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  accent: "accent",
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
} as const;

export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof variants | string;
  label?: string;
}) {
  const variant = variants[status as keyof typeof variants] ?? "neutral";

  return <Badge variant={variant}>{label ?? humanizeToken(status)}</Badge>;
}

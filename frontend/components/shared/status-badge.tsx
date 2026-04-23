import { Badge } from "@/components/ui/badge";
import { humanizeToken } from "@/lib/format";

const variants = {
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


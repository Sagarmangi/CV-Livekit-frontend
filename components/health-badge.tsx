import { Badge } from "@/components/ui";
import type { HealthStatus } from "@/lib/health";

const LABELS: Record<HealthStatus, string> = {
  ok: "working",
  not_configured: "not configured",
  auth_error: "auth error",
  quota_error: "quota exceeded",
  network_error: "unreachable",
  error: "error",
};

const TONES: Record<HealthStatus, "green" | "neutral" | "red" | "amber"> = {
  ok: "green",
  not_configured: "neutral",
  auth_error: "red",
  quota_error: "amber",
  network_error: "amber",
  error: "red",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}

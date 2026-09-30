import Link from "next/link";

import { HealthBadge } from "@/components/health-badge";
import { checkAllIntegrations, isActiveError } from "@/lib/health";

/**
 * Shows at the top of every dashboard page, but only renders anything when an
 * integration that IS configured is actually broken (wrong key, quota,
 * unreachable). "Not configured yet" is expected during setup and deliberately
 * silent here -- see the /integrations page for the full picture including that.
 */
export async function IntegrationAlertBanner() {
  let checks: Awaited<ReturnType<typeof checkAllIntegrations>>;
  try {
    checks = await checkAllIntegrations();
  } catch {
    // The health check itself failing shouldn't take down every page in the
    // dashboard -- just skip the banner for this request.
    return null;
  }

  const broken = checks.filter((c) => isActiveError(c.status));
  if (broken.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-error-border bg-error-bg px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-error-text">
          {broken.length} integration{broken.length === 1 ? "" : "s"} configured but not working:
        </span>
        {broken.map((check) => (
          <span key={check.name} className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-error-text">{check.name}</span>
            <HealthBadge status={check.status} />
          </span>
        ))}
        <Link
          href="/integrations"
          className="ml-auto text-sm font-semibold text-error-text underline underline-offset-2 hover:no-underline"
        >
          View details
        </Link>
      </div>
    </div>
  );
}

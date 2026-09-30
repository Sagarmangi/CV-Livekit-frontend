import { Suspense } from "react";

import { CredentialsForm } from "@/app/(protected)/integrations/credentials-form";
import { HealthBadge } from "@/components/health-badge";
import { Bar, TableSkeleton } from "@/components/skeletons";
import {
  Card,
  Code,
  CollapsibleCard,
  PageBody,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { checkAllIntegrations, isActiveError } from "@/lib/health";
import {
  MANAGED_SECRETS,
  SECRET_GROUPS,
  secretStatuses,
  type SecretStatus,
} from "@/lib/secrets";

export default function IntegrationsPage() {
  // Masked previews only -- `secretStatuses` never returns a usable secret, so
  // nothing here can leak one into the client payload. Reads process.env, so
  // it's free and stays out of the streamed part below.
  const statuses: Record<string, SecretStatus> = Object.fromEntries(
    secretStatuses().map((status) => [status.name, status]),
  );

  return (
    <PageBody>
      <PageHeader
        title="Integrations"
        description="Live status for every external service the dashboard and worker depend on."
      />

      {/* The checks themselves are half a dozen live API calls -- 1.2s warm and
          2.6s cold when measured. Everything below them on this page (the
          credential forms) is what people actually come here to edit, so the
          status table streams in on its own rather than holding the forms
          hostage to Twilio's response time. */}
      <Suspense fallback={<HealthSkeleton />}>
        <HealthReport />
      </Suspense>

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Checks run fresh on every page load -- a passing check means the key was
        accepted at that moment, not that the service will stay reachable. Slack
        is configuration-only (a live test would post a real message to the
        channel every time this page loads).
      </p>

      <div className="border-t border-line pt-6">
        <h2 className="font-heading text-base font-semibold text-strong">
          Credentials
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
          Saving here overrides the matching variable in{" "}
          <Code>dashboard/.env.local</Code> and takes effect on the next request
          — the health checks above re-run against the new value straight away.
          The agent worker reads its own environment, so a new provider key
          reaches live calls when that service restarts. Every change needs your
          dashboard password.
        </p>
      </div>

      {SECRET_GROUPS.map((group) => {
        const fields = MANAGED_SECRETS.filter((secret) => secret.group === group);
        const configured = fields.filter(
          (field) => statuses[field.name]?.source !== "unset",
        ).length;
        return (
          <CollapsibleCard
            key={group}
            title={group}
            description={`${configured} of ${fields.length} set — ${fields
              .map((field) => field.label)
              .join(", ")}`}
          >
            <CredentialsForm group={group} fields={fields} statuses={statuses} />
          </CollapsibleCard>
        );
      })}

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Supabase&apos;s own <Code>SUPABASE_URL</Code>,{" "}
        <Code>SUPABASE_SERVICE_ROLE_KEY</Code> and <Code>SUPABASE_ANON_KEY</Code>{" "}
        aren&apos;t editable here on purpose: they&apos;re what it takes to read
        the table these overrides live in, so a wrong value would lock the
        dashboard out of its own database with no way back through the UI. Change
        those in <Code>dashboard/.env.local</Code> and restart.
      </p>
    </PageBody>
  );
}

/** The tallies and the status table -- everything that needs the live checks. */
async function HealthReport() {
  const checks = await checkAllIntegrations();

  const broken = checks.filter((c) => isActiveError(c.status)).length;
  const notConfigured = checks.filter((c) => c.status === "not_configured").length;
  const ok = checks.filter((c) => c.status === "ok").length;

  const tallies = [
    { count: ok, label: "working", tone: "text-success-text" },
    { count: broken, label: "broken", tone: "text-error-text" },
    { count: notConfigured, label: "not configured", tone: "text-muted" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {tallies.map((tally) => (
          <div
            key={tally.label}
            className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm"
          >
            <p className={`font-display text-2xl leading-none ${tally.tone}`}>
              {tally.count}
            </p>
            <p className="mono-kicker mt-2">{tally.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Integration</Th>
              <Th>Used for</Th>
              <Th>Status</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.name}>
                <Td className="font-medium text-strong">{check.name}</Td>
                <Td className="text-muted">{check.usedFor}</Td>
                <Td>
                  <HealthBadge status={check.status} />
                </Td>
                <Td className="max-w-md text-sm text-muted">{check.message}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

/** Same shape as HealthReport, so the forms below don't jump when it lands. */
function HealthSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm"
          >
            <Bar className="h-6 w-8" />
            <Bar className="mt-2.5 h-2.5 w-24" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={9} cols={4} />
    </>
  );
}

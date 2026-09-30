import { Suspense } from "react";

import { AgentsSidebar } from "@/app/(protected)/agents/agents-sidebar";
import {
  SectionSidebar,
  SectionSidebarBody,
  SectionSidebarHeader,
} from "@/components/section-sidebar";
import { ConfigNotice, ErrorNotice, PageBody, PageHeader } from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, type AgentListItem } from "@/lib/queries";

/**
 * Every /agents route shares this always-visible list rail -- picking a
 * different agent just swaps the pane to its right, like Vapi's assistants
 * view. It's the second of the two rails in this shell: the primary nav is in
 * the protected layout above, this one is contextual to /agents.
 *
 * The rail streams rather than being awaited here. A `loading.tsx` deliberately
 * does NOT wrap the layout of its own segment, so anything awaited directly in
 * this function blocks the whole section: opening /agents, and every click from
 * one agent to another, would wait on listAgents() before rendering a single
 * pixel. Behind a Suspense boundary the shell and the selected agent paint
 * immediately and the list fills in.
 */
export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!integrationStatus().supabase) {
    return (
      <PageBody>
        <PageHeader title="Agents" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </PageBody>
    );
  }

  return (
    // Plain flex row -- no 100vw breakout or transform tricks. The rail is
    // `sticky top-0 h-dvh` (see SectionSidebar) and the content column is just
    // the remaining space, so there is nothing to line up by hand.
    <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-start">
      <Suspense fallback={<AgentsRailSkeleton />}>
        <AgentsRail />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

async function AgentsRail() {
  let agents: AgentListItem[];
  try {
    agents = await listAgents();
  } catch (error) {
    // Kept inside the rail rather than replacing the page: the agent pane to
    // the right fetches its own data and is perfectly usable when only the
    // list query failed.
    return (
      <SectionSidebar>
        <SectionSidebarHeader title="Agents" />
        <SectionSidebarBody>
          <ErrorNotice>
            Couldn&apos;t load agents:{" "}
            {error instanceof Error ? error.message : "unknown error"}
            <br />
            Check that the migration in{" "}
            <code>supabase/migrations/0001_init_schema.sql</code> has been
            applied to this project.
          </ErrorNotice>
        </SectionSidebarBody>
      </SectionSidebar>
    );
  }

  return <AgentsSidebar agents={agents} />;
}

/** Same chrome and widths as the real rail, so nothing moves when it arrives. */
function AgentsRailSkeleton() {
  return (
    <SectionSidebar>
      <SectionSidebarHeader title="Agents" />
      <SectionSidebarBody>
        <div className="h-9 animate-pulse rounded-md bg-canvas-alt" />
        <div className="space-y-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5 px-3 py-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-canvas-alt" />
              <div className="ml-3.5 h-2.5 w-1/2 animate-pulse rounded bg-canvas-alt" />
            </div>
          ))}
        </div>
      </SectionSidebarBody>
    </SectionSidebar>
  );
}

import { ButtonLink, EmptyState, PageBody, PageHeader } from "@/components/ui";

/**
 * Landing pane when no agent is selected from the list rail. The rail (see
 * layout.tsx) is the actual agent list, and creating one is its own route
 * (/agents/new) -- opening the section shouldn't drop you into a half-filled
 * form you didn't ask for.
 */
export default function AgentsPage() {
  return (
    <PageBody>
      <PageHeader
        title="Agents"
        description="Each agent is one inbound persona: its prompt, its voice, the tools it can call, and the number that reaches it."
      />

      <EmptyState
        title="No agent selected"
        description="Pick one from the list on the left to edit it, or start a new one from scratch."
        action={
          <ButtonLink href="/agents/new" variant="primary">
            + New agent
          </ButtonLink>
        }
      />
    </PageBody>
  );
}

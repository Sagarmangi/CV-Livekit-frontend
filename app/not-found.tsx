import { ButtonLink, EmptyState, PageBody, PageHeader } from "@/components/ui";

/**
 * Renders outside the protected layout (it's the root boundary), so it brings
 * its own page padding rather than inheriting the dashboard shell's.
 */
export default function NotFound() {
  return (
    <PageBody>
      <PageHeader title="Not found" />
      <EmptyState
        title="That page doesn't exist"
        description="The agent, number or call you're looking for may have been deleted."
        action={
          <ButtonLink href="/agents" variant="primary">
            Back to agents
          </ButtonLink>
        }
      />
    </PageBody>
  );
}

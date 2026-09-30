import { CreateAgentForm } from "@/app/(protected)/agents/create-agent-form";
import { Card, PageBody, PageHeader } from "@/components/ui";

/**
 * The create form, on its own route rather than sitting under the /agents
 * landing pane -- opening the section shouldn't look like you're already
 * halfway through making something. Reached from "+ New" in the list rail.
 *
 * A static segment, so it takes precedence over [agentId] and no agent can be
 * shadowed by it.
 */
export default function NewAgentPage() {
  return (
    <PageBody>
      <PageHeader
        title="New agent"
        description="Starts as a draft — it won't answer calls until you set it active. You can leave the prompt for later."
      />

      <Card>
        <CreateAgentForm />
      </Card>
    </PageBody>
  );
}

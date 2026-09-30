import { notFound } from "next/navigation";

import {
  AgentToolsPanel,
  BuiltinTools,
  CoreConfigForm,
  DeleteAgentButton,
  KnowledgeBaseForm,
  VoiceConfigForm,
} from "@/app/(protected)/agents/[agentId]/sections";
import { AgentIdentityForm } from "@/app/(protected)/agents/[agentId]/identity-form";
import { AgentModelSummary } from "@/app/(protected)/agents/[agentId]/model-summary";
import { TestAgentPanelLoader } from "@/app/(protected)/agents/[agentId]/test-panel-loader";
import {
  Card,
  CollapsibleCard,
  Mono,
  PageBody,
  PageHeader,
  TextLink,
} from "@/components/ui";
import { StickyBand } from "@/components/sticky-band";
import { Tabs } from "@/components/tabs";
import { getAgent, listAgentTools, listAllTools } from "@/lib/queries";

export default async function AgentPage({
  params,
  searchParams,
}: PageProps<"/agents/[agentId]">) {
  const { agentId } = await params;
  const { tab } = await searchParams;

  // All three in one round trip's worth of wall-clock. Neither tool query
  // depends on the agent row, so awaiting `getAgent` first -- as this used to
  // -- just spent an extra ~400ms Supabase round trip before the other two
  // were even sent.
  const [agent, allTools, agentTools] = await Promise.all([
    getAgent(agentId),
    listAllTools(),
    listAgentTools(agentId),
  ]);
  if (!agent) notFound();

  const selectedToolIds = new Set(agentTools.map((t) => t.tool_id));

  const defaultTab = typeof tab === "string" ? tab : undefined;

  return (
    // pt-0 because the sticky header below owns the top spacing -- it has to
    // keep that padding when stuck to the top of the viewport, which the page
    // body's own padding can't do for it.
    <PageBody className="pt-0">
      {/* Bleeds out to the page gutters and re-pads, so scrolled content can't
          show through beside it once it's stuck. */}
      <StickyBand
        top="var(--content-top, 0px)"
        publishHeightAs="--agent-header-h"
        // Negative margins have to track PageBody's own gutters at every
        // breakpoint, or the band stops covering the full content width.
        className="z-10 -mx-4 bg-canvas px-4 pt-5 pb-4 sm:-mx-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:px-8 lg:pt-7 lg:pb-5"
      >
        <PageHeader
          title={agent.name}
          // The number this agent answers on is the one fact worth reading at a
          // glance next to its name, so it sits with the title rather than in a
          // separate strip further down the page.
          meta={
            <>
              <span className="flex items-center gap-2">
                <span className="mono-kicker">Number</span>
                {agent.twilio_number ? (
                  <Mono>{agent.twilio_number}</Mono>
                ) : (
                  <TextLink href="/numbers">assign one</TextLink>
                )}
              </span>
              <TextLink href={`/calls?agent=${agent.agent_id}`}>
                View calls
              </TextLink>
            </>
          }
          actions={
            <>
              <AgentIdentityForm agent={agent} />
              <TestAgentPanelLoader
                agentId={agent.agent_id}
                agentName={agent.name}
              />
            </>
          }
        />
      </StickyBand>

      <AgentModelSummary agent={agent} />

      <Tabs
        key={defaultTab ?? "default"}
        defaultTab={defaultTab}
        stickyTop="calc(var(--content-top, 0px) + var(--agent-header-h, 6rem))"
        tabs={[
          {
            key: "prompt",
            label: "Prompt & qualification",
            content: (
              <Card description="The prompt is the agent's whole personality and script. Qualification criteria are what it has to come away knowing.">
                <CoreConfigForm key={agent.agent_id} agent={agent} />
              </Card>
            ),
          },
          {
            key: "voice",
            label: "Voice & humanness",
            content: (
              <Card description="FSD Section 4 tuning: which voice, how it's pronounced, and how it paces a conversation.">
                <VoiceConfigForm agent={agent} />
              </Card>
            ),
          },
          {
            key: "knowledge",
            label: "Knowledge base",
            content: (
              <Card description="Entirely optional — an agent works fine with an empty knowledge base. Exposed to the model as a single on-demand lookup rather than always included, so it only costs tokens on the calls that actually need it.">
                <KnowledgeBaseForm agent={agent} />
              </Card>
            ),
          },
          {
            key: "tools",
            label: "Tools",
            content: (
              <>
                <Card description="Tools are a shared library across every agent -- pick which of them this one uses below. Create or edit a tool's own definition from the Tools page in the nav.">
                  <AgentToolsPanel
                    agentId={agent.agent_id}
                    allTools={allTools}
                    selectedToolIds={selectedToolIds}
                  />
                </Card>
                <CollapsibleCard
                  title="Built-in tools"
                  description="The one tool every agent always has automatically -- something has to be able to hang up regardless of what's attached above. Click to see what it does and what the model fills in when it calls it."
                >
                  <BuiltinTools />
                </CollapsibleCard>
              </>
            ),
          },
          {
            key: "danger",
            label: "Danger zone",
            content: (
              <Card
                title="Delete this agent"
                description="Its prompt and knowledge base go with it. Tools stay in the shared library, and call logs are kept."
              >
                <DeleteAgentButton
                  agentId={agent.agent_id}
                  agentName={agent.name}
                  hasNumber={agent.twilio_number !== null}
                />
              </Card>
            ),
          },
        ]}
      />
    </PageBody>
  );
}

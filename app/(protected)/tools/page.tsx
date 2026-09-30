import { ToolsLibraryPanel } from "@/app/(protected)/tools/tools-library-panel";
import { ConfigNotice, PageBody, PageHeader, Panel } from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAllTools } from "@/lib/queries";

export default async function ToolsPage() {
  if (!integrationStatus().supabase) {
    return (
      <PageBody>
        <PageHeader title="Tools" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </PageBody>
    );
  }

  const tools = await listAllTools();

  return (
    <PageBody>
      <PageHeader
        title="Tools"
        description="Shared across every agent. A tool is a dashboard entry plus, for function tools, an n8n workflow — no worker deploy either way. Pick which of these an agent uses from its own Tools tab."
      />
      <Panel>
        <ToolsLibraryPanel tools={tools} />
      </Panel>
    </PageBody>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui";

/**
 * Keeps `livekit-client` and `@livekit/components-react` out of the agent
 * page's bundle until someone actually asks to test an agent.
 *
 * Those two are the heaviest thing the dashboard ships, and test-panel.tsx
 * imports them at module scope -- so every visit to an agent's config page was
 * downloading and parsing a full WebRTC client for a panel that starts closed.
 * That delays hydration, and until the page is hydrated `<Link>` can't prefetch
 * anything, which makes the *next* click slow too.
 *
 * The split has to live in a Client Component: per Next's lazy-loading guide, a
 * Server Component dynamically importing a Client Component doesn't get code
 * splitting. So the server renders this, and this owns the boundary.
 */
const TestAgentPanel = dynamic(
  () => import("./test-panel").then((m) => m.TestAgentPanel),
  {
    // Matches the real button's size and variant so the header doesn't reflow
    // between the click and the chunk arriving.
    loading: () => (
      <Button type="button" variant="primary" disabled>
        Connecting…
      </Button>
    ),
    // Nothing to server-render: `armed` is false until a click, and the panel
    // itself portals into document.body on the client regardless.
    ssr: false,
  },
);

export function TestAgentPanelLoader({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="primary" onClick={() => setArmed(true)}>
        Test agent
      </Button>
    );
  }

  return (
    <TestAgentPanel agentId={agentId} agentName={agentName} autoStart />
  );
}

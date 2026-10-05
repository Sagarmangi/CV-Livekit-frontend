import type { Metadata } from "next";

import { VoiceWidget, WidgetUnavailable } from "@/app/widget/[key]/voice-widget";
import { integrationStatus } from "@/lib/env";
import { getAgentByWidgetKey } from "@/lib/queries";
import { resolveWidgetConfig, WIDGET_KEY_PATTERN, WIDGET_MAX_SECONDS } from "@/lib/widget-config";

export const metadata: Metadata = {
  title: "Voice assistant",
  // Loaded only inside iframes on customers' sites; there's nothing here for a
  // search engine to send anyone to.
  robots: { index: false, follow: false },
};

/**
 * The page public/widget.js frames. Outside the (protected) group and the
 * proxy's auth gate -- its visitors are the customer's, not ours.
 *
 * Reads the agent here, on the server, so the first paint already carries the
 * right colour and label instead of a default-coloured flash while a config
 * request completes. Only the display config crosses to the client: the key
 * is already in the URL, and everything else about the agent stays private.
 */
export default async function WidgetPage({ params }: PageProps<"/widget/[key]">) {
  const { key } = await params;
  if (!WIDGET_KEY_PATTERN.test(key) || !integrationStatus().supabase) {
    return <WidgetUnavailable />;
  }

  const agent = await getAgentByWidgetKey(key);
  if (!agent || !agent.widget_enabled || agent.status !== "active") {
    return <WidgetUnavailable />;
  }

  return (
    <VoiceWidget
      widgetKey={key}
      agentName={agent.name}
      config={resolveWidgetConfig(agent.widget_config, agent.name)}
      maxSeconds={agent.widget_max_seconds ?? WIDGET_MAX_SECONDS.fallback}
    />
  );
}

import type { NextRequest } from "next/server";

import { integrationStatus } from "@/lib/env";
import { getAgentByWidgetKey } from "@/lib/queries";
import { corsFor, json, preflight } from "@/lib/widget-api";
import { resolveWidgetConfig, WIDGET_KEY_PATTERN } from "@/lib/widget-config";

/**
 * What public/widget.js needs to draw the launcher before anyone clicks it:
 * the accent colour, the optional launcher label, and whether there is
 * anything to launch. Without this the launcher could only learn the colour
 * from the iframe, which doesn't exist until the first click -- so every
 * page view flashed the default blue first.
 *
 * Nothing private here (it's all visible in the widget itself), so it is
 * cacheable for a minute by the browser and any CDN in front. Called
 * cross-origin from the customer's page, which is why it carries the same
 * CORS rules as the other widget routes: a site not on the agent's allowlist
 * gets no answer and the loader falls back to its defaults.
 */
export async function GET(request: NextRequest) {
  if (!integrationStatus().supabase) return json(503, { error: "not_configured" });

  const key = request.nextUrl.searchParams.get("key");
  if (!key || !WIDGET_KEY_PATTERN.test(key)) return json(400, { error: "bad_request" });

  const agent = await getAgentByWidgetKey(key);
  if (!agent) return json(404, { error: "unknown_key" });

  const resolved = resolveWidgetConfig(agent.widget_config, agent.name);
  return json(
    200,
    {
      accent_color: resolved.accentColor,
      // Raw, not resolved: the in-panel button always says something, but
      // the launcher is a plain circle unless an admin chose a label.
      button_label: agent.widget_config.button_label?.trim() || null,
      enabled: agent.widget_enabled && agent.status === "active",
    },
    corsFor(agent, request.headers.get("origin")),
    { "Cache-Control": "public, max-age=60" },
  );
}

export async function OPTIONS(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const agent =
    key && WIDGET_KEY_PATTERN.test(key) && integrationStatus().supabase
      ? await getAgentByWidgetKey(key)
      : null;
  return preflight(agent, request.headers.get("origin"));
}

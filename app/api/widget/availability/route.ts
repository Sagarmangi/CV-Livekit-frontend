import type { NextRequest } from "next/server";

import { integrationStatus, widgetEnv } from "@/lib/env";
import { countActiveCallRoomsCached } from "@/lib/livekit";
import { getAgentByWidgetKey } from "@/lib/queries";
import { corsFor, json, preflight } from "@/lib/widget-api";
import { WIDGET_KEY_PATTERN, WIDGET_WAIT } from "@/lib/widget-config";

/**
 * "Is there a free agent right now?" -- what a visitor told "busy" polls
 * every few seconds while waiting for a slot (see the `waiting` phase in
 * app/widget/[key]/voice-widget.tsx).
 *
 * Read-only and cheap by design: the LiveKit room count is cached for two
 * seconds, so a page full of waiting visitors costs one list call per two
 * seconds, not one each. Deliberately *not* counted toward the per-IP
 * session limit -- that limit is for calls started, and polling isn't one.
 *
 * A "yes" here is a hint, not a reservation. The session route re-counts
 * fresh before dispatching, so two visitors who both see `available: true`
 * race for the slot and the loser is told busy again and goes back to waiting.
 */

const ROOM_COUNT_MAX_AGE_MS = 2_000;

export async function GET(request: NextRequest) {
  const status = integrationStatus();
  if (!status.supabase || !status.livekit) return json(503, { error: "not_configured" });

  const key = request.nextUrl.searchParams.get("key");
  if (!key || !WIDGET_KEY_PATTERN.test(key)) return json(400, { error: "bad_request" });

  const agent = await getAgentByWidgetKey(key);
  if (!agent) return json(404, { error: "unknown_key" });
  if (!agent.widget_enabled || agent.status !== "active") {
    return json(403, { error: "widget_disabled" });
  }
  const cors = corsFor(agent, request.headers.get("origin"));

  let active: number;
  try {
    active = await countActiveCallRoomsCached(ROOM_COUNT_MAX_AGE_MS);
  } catch (error) {
    console.error("[codeora-widget] could not list rooms", error);
    return json(502, { error: "livekit_unavailable" }, cors);
  }

  const available = active < widgetEnv().maxConcurrentCalls;
  return json(
    200,
    { available, retryAfterSeconds: available ? 0 : WIDGET_WAIT.retryAfterSeconds },
    cors,
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

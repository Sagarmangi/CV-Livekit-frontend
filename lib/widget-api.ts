import "server-only";

import type { Agent } from "@/lib/types";
import { normalizeOrigin } from "@/lib/widget-config";

/**
 * Response plumbing shared by the two public widget routes
 * (app/api/widget/session and app/api/widget/availability).
 */

export type Cors = { allowOrigin: string | null };

export const NO_CORS: Cors = { allowOrigin: null };

export function json(
  status: number,
  body: unknown,
  cors: Cors = NO_CORS,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...extraHeaders,
  });
  if (cors.allowOrigin) {
    headers.set("Access-Control-Allow-Origin", cors.allowOrigin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** Whether `origin` (an Origin header value) is on the agent's allowlist. */
export function originAllowed(agent: Agent, origin: string | null): boolean {
  const normalized = origin ? normalizeOrigin(origin) : null;
  return (
    normalized !== null &&
    agent.widget_allowed_origins.some((o) => o.toLowerCase() === normalized)
  );
}

/**
 * CORS for a request from a site using the API directly: echo its Origin
 * only if the agent allows that site. Our own widget page's requests are
 * same-origin and need none, so they get none.
 */
export function corsFor(agent: Agent, origin: string | null): Cors {
  return { allowOrigin: originAllowed(agent, origin) ? origin : null };
}

/**
 * Preflight. The browser sends no body, so the key has to be in the query
 * string for the origin to be checked. Anything not allowlisted gets a 204
 * with no CORS headers, which the browser treats as a refusal.
 */
export function preflight(agent: Agent | null, origin: string | null): Response {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  if (agent?.widget_enabled && origin && originAllowed(agent, origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(null, { status: 204, headers });
}

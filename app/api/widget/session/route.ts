import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { getSessionUser, isEmailAllowed } from "@/lib/auth";
import { integrationStatus, livekitEnv, widgetEnv } from "@/lib/env";
import {
  countActiveCallRooms,
  dispatchAgent,
  mintParticipantToken,
  shortId,
  WORKER_AGENT_NAME,
} from "@/lib/livekit";
import { countWidgetCallsToday, getAgentByWidgetKey } from "@/lib/queries";
import type { Agent } from "@/lib/types";
import { normalizeOrigin, WIDGET_KEY_PATTERN, WIDGET_MAX_SECONDS } from "@/lib/widget-config";

/**
 * The one unauthenticated endpoint in the app: hands a browser visitor a
 * LiveKit token for a room the worker has been dispatched into. Called by the
 * widget page (app/widget/[key]) from inside a customer's iframe.
 *
 * Everything here is a gate, in order of cost: the key and the agent's own
 * switches (one Supabase read), the embedding origin, the per-IP window (in
 * memory), the per-key daily cap (a count query), the live-call cap (a LiveKit
 * list), and only then the dispatch. A refused request never reaches LiveKit.
 *
 * Error bodies are `{ error: <slug> }` so the widget can pick a message; the
 * slugs are part of its contract -- see ERROR_MESSAGES in voice-widget.tsx.
 */

/** Sessions one IP may start inside the window. Generous for a person
 * retrying a dropped call, tight for a script. */
const IP_WINDOW_MS = 10 * 60_000;
const IP_LIMIT = 5;

/**
 * In-memory, per process. Fine for the single dashboard server this runs on;
 * a second instance would need this in Supabase or Redis instead. Timestamps
 * are pruned on read, and the whole map is swept when it grows past a size
 * no legitimate traffic reaches, so a scan of random addresses can't grow it
 * without bound.
 */
const sessionStartsByIp = new Map<string, number[]>();
const IP_MAP_SWEEP_AT = 5_000;

function ipRateLimited(ip: string): boolean {
  const now = Date.now();
  if (sessionStartsByIp.size > IP_MAP_SWEEP_AT) {
    for (const [key, starts] of sessionStartsByIp) {
      if (starts.every((at) => now - at > IP_WINDOW_MS)) sessionStartsByIp.delete(key);
    }
  }
  const recent = (sessionStartsByIp.get(ip) ?? []).filter((at) => now - at <= IP_WINDOW_MS);
  if (recent.length >= IP_LIMIT) {
    sessionStartsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  sessionStartsByIp.set(ip, recent);
  return false;
}

function clientIp(request: NextRequest): string {
  // Behind the reverse proxy the socket address is the proxy's; the first
  // entry of X-Forwarded-For is the client. Spoofable by a direct caller, but a
  // direct caller bypassing the proxy has bigger problems to be stopped by.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

type Cors = { allowOrigin: string | null };

function json(status: number, body: unknown, cors: Cors = { allowOrigin: null }): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (cors.allowOrigin) {
    headers.set("Access-Control-Allow-Origin", cors.allowOrigin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/* -------------------------------------------------------------------------- */
/* Which site is embedding this                                               */
/* -------------------------------------------------------------------------- */

type Embedder =
  | { allowed: true; origin: string; preview: boolean }
  | { allowed: false; origin: string | null };

/**
 * Works out whose page the visitor is on, and whether that page may use this
 * agent. Two shapes of request arrive here:
 *
 * 1. A site calling the API directly, cross-origin. The browser sets the
 *    Origin header to that site and scripts can't change it, so it is checked
 *    against the allowlist as-is.
 *
 * 2. Our own widget page, loaded in an iframe on the customer's site. That is
 *    a same-origin request, so the Origin header names *us* -- useless for
 *    the allowlist. The page forwards what the browser told it about its
 *    parent (document.referrer / ancestorOrigins) in the body instead. Not a
 *    weaker check than (1): a forged body and a forged Origin header take the
 *    same curl command, and neither gets a browser past the allowlist.
 *
 * Same-origin with the dashboard itself as parent is the editor's live
 * preview. That is honoured only for a signed-in, allowlisted admin --
 * otherwise anyone could open /widget/<key> in a tab and skip the list.
 */
async function resolveEmbedder(
  request: NextRequest,
  claimedOrigin: unknown,
  agent: Agent,
): Promise<Embedder> {
  const requestOrigin = normalizeOrigin(request.headers.get("origin") ?? "");
  if (!requestOrigin) return { allowed: false, origin: null };

  const allowed = new Set(agent.widget_allowed_origins.map((o) => o.toLowerCase()));

  const ownHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const sameOrigin = ownHost !== null && new URL(requestOrigin).host === ownHost.toLowerCase();

  if (!sameOrigin) {
    return allowed.has(requestOrigin)
      ? { allowed: true, origin: requestOrigin, preview: false }
      : { allowed: false, origin: requestOrigin };
  }

  const parent = typeof claimedOrigin === "string" ? normalizeOrigin(claimedOrigin) : null;
  if (parent && allowed.has(parent)) return { allowed: true, origin: parent, preview: false };

  if ((parent === null || parent === requestOrigin) && (await isAdminRequest())) {
    return { allowed: true, origin: requestOrigin, preview: true };
  }

  return { allowed: false, origin: parent };
}

async function isAdminRequest(): Promise<boolean> {
  try {
    const user = await getSessionUser();
    return user !== null && (await isEmailAllowed(user.email));
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

type SessionBody = { key?: unknown; origin?: unknown; visitor_id?: unknown };

const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;

export async function POST(request: NextRequest) {
  const status = integrationStatus();
  if (!status.supabase || !status.livekit) return json(503, { error: "not_configured" });

  let body: SessionBody = {};
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    // An empty or malformed body falls through to the key check below.
  }

  const key = typeof body.key === "string" ? body.key : request.nextUrl.searchParams.get("key");
  if (!key || !WIDGET_KEY_PATTERN.test(key)) return json(400, { error: "bad_request" });

  const agent = await getAgentByWidgetKey(key);
  if (!agent) return json(404, { error: "unknown_key" });
  if (!agent.widget_enabled || agent.status !== "active") {
    return json(403, { error: "widget_disabled" });
  }

  const embedder = await resolveEmbedder(request, body.origin, agent);
  if (!embedder.allowed) {
    console.info(
      `[codeora-widget] refused key=${key} origin=${embedder.origin ?? "none"}: not in the allowlist`,
    );
    return json(403, { error: "origin_not_allowed" });
  }
  // From here on the browser's own Origin is echoed back: it is either the
  // allowlisted site itself or our own widget page acting for one.
  const cors: Cors = { allowOrigin: request.headers.get("origin") };

  const ip = clientIp(request);
  if (ipRateLimited(ip)) {
    console.info(`[codeora-widget] refused key=${key} ip=${ip}: per-IP limit`);
    return json(429, { error: "rate_limited" }, cors);
  }

  const { dailyCap, maxConcurrentCalls } = widgetEnv();
  const today = await countWidgetCallsToday(agent.agent_id);
  if (today >= dailyCap) {
    console.info(`[codeora-widget] refused key=${key}: daily cap ${today}/${dailyCap}`);
    return json(429, { error: "daily_cap" }, cors);
  }

  let active: number;
  try {
    active = await countActiveCallRooms();
  } catch (error) {
    console.error("[codeora-widget] could not list rooms", error);
    return json(502, { error: "livekit_unavailable" }, cors);
  }
  if (active >= maxConcurrentCalls) {
    console.info(`[codeora-widget] busy key=${key}: ${active} live rooms, cap ${maxConcurrentCalls}`);
    return json(503, { error: "busy" }, cors);
  }

  const visitorId =
    typeof body.visitor_id === "string" && VISITOR_ID.test(body.visitor_id)
      ? body.visitor_id
      : randomUUID();
  const roomName = `widget-${key}-${shortId()}`;
  const identity = `visitor-${shortId()}`;
  const maxSeconds = agent.widget_max_seconds ?? WIDGET_MAX_SECONDS.fallback;

  try {
    const { dispatchId } = await dispatchAgent(roomName, {
      widget_key: key,
      origin: embedder.origin,
      visitor_id: visitorId,
    });
    const { url } = livekitEnv();
    console.info(
      `[codeora-widget] dispatch created room=${roomName} agent=${WORKER_AGENT_NAME} ` +
        `origin=${embedder.origin}${embedder.preview ? " (dashboard preview)" : ""} ` +
        `dispatch=${dispatchId ?? "?"}`,
    );

    const token = await mintParticipantToken({
      roomName,
      identity,
      // The worker ends the call at widget_max_seconds; the extra minute lets
      // the closing line finish and the client disconnect cleanly rather than
      // being cut off by token expiry mid-goodbye.
      ttlSeconds: maxSeconds + 60,
    });

    return json(200, { token, url, maxSeconds }, cors);
  } catch (error) {
    console.error("[codeora-widget] dispatch failed", error);
    return json(502, { error: "dispatch_failed" }, cors);
  }
}

/**
 * Preflight for a site calling the API directly. The browser sends no body
 * with a preflight, so the key has to come in the query string
 * (`POST /api/widget/session?key=wk_…`) for the origin to be checked here.
 * Anything not allowlisted gets a 204 with no CORS headers, which the browser
 * treats as a refusal.
 */
export async function OPTIONS(request: NextRequest) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });

  const origin = request.headers.get("origin");
  const key = request.nextUrl.searchParams.get("key");
  if (origin && key && WIDGET_KEY_PATTERN.test(key) && integrationStatus().supabase) {
    const agent = await getAgentByWidgetKey(key);
    const normalized = normalizeOrigin(origin);
    if (
      agent?.widget_enabled &&
      normalized &&
      agent.widget_allowed_origins.some((o) => o.toLowerCase() === normalized)
    ) {
      headers.set("Access-Control-Allow-Origin", origin);
    }
  }

  return new Response(null, { status: 204, headers });
}

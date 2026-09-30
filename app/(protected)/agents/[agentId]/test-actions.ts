"use server";

import { randomUUID } from "node:crypto";

import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";

import { livekitEnv } from "@/lib/env";

/**
 * `agentName` and `dispatchId` are returned purely so the browser console can
 * show them. A dispatch that no worker claims looks identical to a worker that
 * crashed, and the most common cause of the former is this name not matching the
 * worker's LIVEKIT_AGENT_NAME -- which is invisible unless both sides are
 * printed somewhere a person can read them.
 */
export type TestSession = {
  token: string;
  url: string;
  roomName: string;
  agentName: string;
  dispatchId: string | null;
};
export type TestSessionResult = TestSession | { error: string };

/** Must match the worker's LIVEKIT_AGENT_NAME (see agent-worker/settings.py --
 * it defaults to this same string). A mismatch means dispatches are created
 * successfully and then silently never claimed. */
const WORKER_AGENT_NAME = "kodexo-inbound-agent";

/**
 * Starts a browser-testable session with this agent, entirely local to
 * whatever LiveKit server is configured (no Twilio/SIP involved). An explicit
 * agent dispatch tells the worker to join this specific room; job metadata
 * carries which agent to load, since there's no SIP-dialed number to resolve
 * it from -- see agent-worker/src/worker/entrypoint.py's test-mode branch.
 */
export async function createTestSession(agentId: string): Promise<TestSessionResult> {
  try {
    const { url, apiKey, apiSecret } = livekitEnv();
    const httpUrl = url.replace(/^ws/, "http");
    const roomName = `test-${agentId}-${randomUUID().slice(0, 8)}`;

    const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    const created = await dispatch.createDispatch(roomName, WORKER_AGENT_NAME, {
      metadata: JSON.stringify({ test_agent_id: agentId }),
    });

    // Server-side log as well as the browser one: on a deployed box this lands
    // in the dashboard's journal, which is the only place to see that the
    // dashboard and the worker disagree about which LiveKit they're using.
    console.info(
      `[kodexo-test] dispatch created room=${roomName} agent=${WORKER_AGENT_NAME} ` +
        `livekit=${url} dispatch=${created.id ?? "?"}`,
    );

    const token = new AccessToken(apiKey, apiSecret, {
      identity: `tester-${randomUUID().slice(0, 8)}`,
      ttl: "15m",
    });
    token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });

    return {
      token: await token.toJwt(),
      url,
      roomName,
      agentName: WORKER_AGENT_NAME,
      dispatchId: created.id ?? null,
    };
  } catch (error) {
    console.error("[kodexo-test] dispatch failed", error);
    return { error: `Could not start a test session: ${describeFailure(error)}` };
  }
}

/**
 * Turns a connection failure into something you can act on.
 *
 * `fetch` in Node reports every transport-level problem as the bare string
 * "fetch failed" and puts the real reason in `cause`. When several addresses
 * were tried, `cause.message` is itself empty and the useful part is in
 * `cause.errors`, one entry per address -- so the naive `error.message` a
 * server action normally returns is the one string in the chain carrying no
 * information at all.
 *
 * Reporting the addresses actually dialled, rather than guessing at a cause,
 * is the point: it distinguishes wrong host, wrong port, refused, and DNS
 * failure without anyone having to reason about which is likelier.
 */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error.";

  const parts: string[] = [];
  let cause: unknown = error.cause;
  for (let depth = 0; cause instanceof Error && depth < 3; depth++) {
    // `address`/`port` are on Node's socket errors but absent from the
    // ErrnoException type, so they're narrowed here rather than asserted away.
    type DialError = Error & { code?: string; address?: string; port?: number };
    const sub = (cause as { errors?: DialError[] }).errors;
    if (Array.isArray(sub) && sub.length) {
      for (const one of sub) {
        const where = one.address ? ` ${one.address}:${one.port}` : "";
        parts.push(`${one.code ?? one.message}${where}`);
      }
    } else {
      const code = (cause as NodeJS.ErrnoException).code;
      const text = [code, cause.message].filter(Boolean).join(": ");
      if (text) parts.push(text);
    }
    cause = cause.cause;
  }

  const { url } = livekitEnv();
  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  return `${error.message}${detail}. The dashboard is configured to reach LiveKit at ${url}.`;
}

import "server-only";

import { randomUUID } from "node:crypto";

import { ListUpdate } from "@livekit/protocol";
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
  SipClient,
} from "livekit-server-sdk";

import { livekitEnv } from "@/lib/env";

/**
 * Must match the worker's LIVEKIT_AGENT_NAME (see agent-worker/settings.py --
 * it defaults to this same string). A mismatch means dispatches are created
 * successfully and then silently never claimed. One constant for every path
 * that dispatches -- the dashboard test panel and the public web widget -- so
 * they can't drift apart.
 */
export const WORKER_AGENT_NAME = "codeora-inbound-agent";

/**
 * Room-name prefixes of the three ways a call can start: SIP inbound (the
 * dispatch rule's prefix), the dashboard's test panel, and the web widget.
 * Anything else in the room list is not a call and doesn't count toward
 * MAX_CONCURRENT_CALLS.
 */
export const CALL_ROOM_PREFIXES = ["call-", "test-", "widget-"] as const;

// The SDK wants an http(s) host, but the rest of the stack is configured
// with the ws(s) URL, so accept either and normalize here.
function httpHost(): string {
  return livekitEnv().url.replace(/^ws/, "http");
}

let cached: SipClient | null = null;

function sip() {
  if (!cached) {
    const { apiKey, apiSecret } = livekitEnv();
    cached = new SipClient(httpHost(), apiKey, apiSecret);
  }
  return cached;
}

let cachedRooms: RoomServiceClient | null = null;

function rooms() {
  if (!cachedRooms) {
    const { apiKey, apiSecret } = livekitEnv();
    cachedRooms = new RoomServiceClient(httpHost(), apiKey, apiSecret);
  }
  return cachedRooms;
}

/** Eight hex characters -- enough to keep room and participant names unique
 * without making them unreadable in logs. */
export function shortId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Tells the worker to join `roomName` and load whatever `metadata` describes
 * (a test_agent_id, or a widget_key). Explicit dispatch, as opposed to the
 * SIP dispatch rule, because there's no dialed number for the worker to
 * resolve an agent from -- see entrypoint.py's non-SIP branch.
 */
export async function dispatchAgent(
  roomName: string,
  metadata: Record<string, unknown>,
): Promise<{ dispatchId: string | null }> {
  const { apiKey, apiSecret } = livekitEnv();
  const client = new AgentDispatchClient(httpHost(), apiKey, apiSecret);
  const created = await client.createDispatch(roomName, WORKER_AGENT_NAME, {
    metadata: JSON.stringify(metadata),
  });
  return { dispatchId: created.id ?? null };
}

/** A join token for one browser participant in one room. */
export async function mintParticipantToken({
  roomName,
  identity,
  ttlSeconds,
}: {
  roomName: string;
  identity: string;
  ttlSeconds: number;
}): Promise<string> {
  const { apiKey, apiSecret } = livekitEnv();
  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: ttlSeconds });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
  return token.toJwt();
}

/**
 * How many calls are live right now, across every channel. LiveKit only lists
 * a room while it exists -- rooms close themselves once empty -- so the list
 * is the live set, no participant counting needed. A room that was just
 * created for a dispatch nobody has joined yet is still a call in progress
 * and counts, which is the point: two widget visitors clicking at once must
 * not both get past the cap.
 */
export async function countActiveCallRooms(): Promise<number> {
  const all = await rooms().listRooms();
  return all.filter((room) =>
    CALL_ROOM_PREFIXES.some((prefix) => room.name.startsWith(prefix)),
  ).length;
}

export type SipInboundTrunkSummary = {
  sipTrunkId: string;
  name: string;
  /** Empty means the trunk accepts calls to any dialed number (catch-all). */
  numbers: string[];
  allowedAddresses: string[];
};

export type SipDispatchRuleSummary = {
  sipDispatchRuleId: string;
  name: string;
  /** Which agent worker names LiveKit dispatches into the room. */
  agentNames: string[];
  trunkIds: string[];
  roomPrefix: string | null;
};

/**
 * Read-only view of the LiveKit SIP configuration, for the status panel on the
 * numbers page.
 *
 * The trunk and dispatch rule are static one-time setup (see `infra/README.md`)
 * — the dashboard shows them so an admin can confirm inbound calls will land
 * somewhere, without having to shell into the VPS and run `lk sip list`.
 */
export async function describeSipConfig(): Promise<{
  trunks: SipInboundTrunkSummary[];
  dispatchRules: SipDispatchRuleSummary[];
}> {
  const [trunks, rules] = await Promise.all([
    sip().listSipInboundTrunk(),
    sip().listSipDispatchRule(),
  ]);

  return {
    trunks: trunks.map((t) => ({
      sipTrunkId: t.sipTrunkId,
      name: t.name,
      numbers: t.numbers,
      allowedAddresses: t.allowedAddresses,
    })),
    dispatchRules: rules.map((r) => ({
      sipDispatchRuleId: r.sipDispatchRuleId,
      name: r.name,
      agentNames: r.roomConfig?.agents?.map((a) => a.agentName) ?? [],
      trunkIds: r.trunkIds,
      roomPrefix:
        r.rule?.rule.case === "dispatchRuleIndividual"
          ? r.rule.rule.value.roomPrefix
          : null,
    })),
  };
}

/**
 * Adds a number to any inbound trunk that keeps an explicit number allowlist.
 *
 * The recommended setup is a single catch-all trunk (empty `numbers`), where
 * buying a Twilio number needs no LiveKit change at all — which agent owns the
 * call is a Supabase lookup on the dialed number, per Project Plan v2. But a
 * trunk *can* be locked to specific DIDs, and in that case a newly purchased
 * number would silently get rejected at the SIP layer. This keeps those trunks
 * in sync so both configurations behave the same from the dashboard's side.
 *
 * Returns the trunk IDs that were updated (empty for a catch-all setup).
 */
export async function syncNumberOntoTrunks(
  phoneNumber: string,
): Promise<string[]> {
  const trunks = await sip().listSipInboundTrunk();
  const restricted = trunks.filter(
    (t) => t.numbers.length > 0 && !t.numbers.includes(phoneNumber),
  );

  await Promise.all(
    restricted.map((t) =>
      sip().updateSipInboundTrunkFields(t.sipTrunkId, {
        numbers: new ListUpdate({ add: [phoneNumber] }),
      }),
    ),
  );

  return restricted.map((t) => t.sipTrunkId);
}

/** Mirror of {@link syncNumberOntoTrunks} for a number being taken out of service. */
export async function removeNumberFromTrunks(
  phoneNumber: string,
): Promise<string[]> {
  const trunks = await sip().listSipInboundTrunk();
  const affected = trunks.filter((t) => t.numbers.includes(phoneNumber));

  await Promise.all(
    affected.map((t) =>
      sip().updateSipInboundTrunkFields(t.sipTrunkId, {
        numbers: new ListUpdate({ remove: [phoneNumber] }),
      }),
    ),
  );

  return affected.map((t) => t.sipTrunkId);
}

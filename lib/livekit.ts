import "server-only";

import { ListUpdate } from "@livekit/protocol";
import { SipClient } from "livekit-server-sdk";

import { livekitEnv } from "@/lib/env";

let cached: SipClient | null = null;

function sip() {
  if (!cached) {
    const { url, apiKey, apiSecret } = livekitEnv();
    // The SDK wants an http(s) host, but the rest of the stack is configured
    // with the ws(s) URL, so accept either and normalize here.
    const host = url.replace(/^ws/, "http");
    cached = new SipClient(host, apiKey, apiSecret);
  }
  return cached;
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

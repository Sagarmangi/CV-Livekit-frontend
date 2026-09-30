import "server-only";

import TwilioSdk from "twilio";

import { twilioEnv } from "@/lib/env";

let cached: ReturnType<typeof TwilioSdk> | null = null;

function client() {
  if (!cached) {
    const { accountSid, authToken } = twilioEnv();
    cached = TwilioSdk(accountSid, authToken);
  }
  return cached;
}

/** A number this Twilio account already owns. */
export type OwnedNumber = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  /** Non-empty when the number is routed out through a SIP trunk. */
  trunkSid: string | null;
  /** True when it's attached to *our* shared trunk specifically. */
  onSharedTrunk: boolean;
  /**
   * The number's own Voice URL webhook, if any -- e.g. a number still pointed
   * at another provider (Vapi, Bland, a bare Twilio Function) instead of a
   * trunk. Twilio ignores this once the number is on a trunk, so attaching
   * silently cuts over whatever currently answers calls to it.
   */
  voiceUrl: string | null;
};

export async function listOwnedNumbers(): Promise<OwnedNumber[]> {
  const { trunkSid } = twilioEnv();
  const numbers = await client().incomingPhoneNumbers.list({ limit: 200 });

  return numbers.map((n) => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    trunkSid: n.trunkSid || null,
    onSharedTrunk: n.trunkSid === trunkSid,
    voiceUrl: n.voiceUrl || null,
  }));
}

/** Routes an already-owned number out through the shared SIP trunk. */
export async function attachToSharedTrunk(numberSid: string): Promise<void> {
  const { trunkSid } = twilioEnv();
  await client()
    .trunking.v1.trunks(trunkSid)
    .phoneNumbers.create({ phoneNumberSid: numberSid });
}

/**
 * Takes a number off the shared trunk. The account keeps owning (and paying
 * for) it — this only stops routing calls to LiveKit.
 */
export async function detachFromSharedTrunk(numberSid: string): Promise<void> {
  const { trunkSid } = twilioEnv();
  await client().trunking.v1.trunks(trunkSid).phoneNumbers(numberSid).remove();
}

/**
 * Permanently releases a number back to Twilio. Irreversible — the number
 * cannot be reclaimed, and anyone who calls it later reaches a stranger.
 */
export async function releaseNumber(numberSid: string): Promise<void> {
  await client().incomingPhoneNumbers(numberSid).remove();
}

/**
 * Connects a number from a customer's own Twilio account (their Account SID +
 * Auth Token), as opposed to buying one on the platform's own account.
 *
 * Twilio requires a trunk and the number it carries to live in the same
 * account, so an outside number can never be attached to *our* shared trunk.
 * Instead this creates a brand-new trunk inside their account, points its
 * origination URI at the same LiveKit SIP endpoint the shared trunk uses, and
 * moves their number onto it -- functionally equivalent, just one trunk per
 * external number instead of many numbers sharing one.
 */
export async function connectExternalNumber({
  accountSid,
  authToken,
  phoneNumber,
  friendlyName,
}: {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  friendlyName: string;
}): Promise<{
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  trunkSid: string;
}> {
  const external = TwilioSdk(accountSid, authToken);

  let found;
  try {
    found = await external.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  } catch (error) {
    throw new Error(
      `Couldn't authenticate with that Account SID/Auth Token: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
  const number = found[0];
  if (!number) {
    throw new Error(
      `${phoneNumber} isn't on that Twilio account. Check it's entered exactly ` +
        `as Twilio shows it (E.164, e.g. +15105550100).`,
    );
  }

  const { originationUris } = await describeSharedTrunk();
  const originationUri = originationUris[0];
  if (!originationUri) {
    throw new Error(
      "The platform's shared trunk has no origination URI set yet -- that has " +
        "to point at LiveKit before any number, ours or a customer's, can ring in.",
    );
  }

  const trunk = await external.trunking.v1.trunks.create({
    friendlyName: `Kodexo Voice Agent -- ${phoneNumber}`,
  });
  await external.trunking.v1
    .trunks(trunk.sid)
    .originationUrls.create({
      friendlyName: "LiveKit",
      sipUrl: originationUri,
      weight: 1,
      priority: 1,
      enabled: true,
    });
  await external.trunking.v1
    .trunks(trunk.sid)
    .phoneNumbers.create({ phoneNumberSid: number.sid });

  return {
    sid: number.sid,
    phoneNumber: number.phoneNumber,
    friendlyName: friendlyName || number.friendlyName,
    trunkSid: trunk.sid,
  };
}

/**
 * Undoes {@link connectExternalNumber}: detaches the number from the
 * dedicated trunk it was given and removes that trunk. The customer keeps the
 * number itself -- this only stops routing it to LiveKit.
 */
export async function disconnectExternalNumber({
  accountSid,
  authToken,
  numberSid,
  trunkSid,
}: {
  accountSid: string;
  authToken: string;
  numberSid: string;
  trunkSid: string;
}): Promise<void> {
  const external = TwilioSdk(accountSid, authToken);
  await external.trunking.v1.trunks(trunkSid).phoneNumbers(numberSid).remove();
  // Best-effort: the connection is already severed above, which is what
  // matters. A trunk left behind is harmless clutter, not a stuck number.
  await external.trunking.v1.trunks(trunkSid).remove().catch(() => {});
}

/** Sanity-checks that the configured shared trunk exists and where it points. */
export async function describeSharedTrunk(): Promise<{
  sid: string;
  friendlyName: string;
  /** Null for a freshly created trunk until Twilio assigns one. */
  domainName: string | null;
  originationUris: string[];
}> {
  const { trunkSid } = twilioEnv();
  const trunk = await client().trunking.v1.trunks(trunkSid).fetch();
  const uris = await client()
    .trunking.v1.trunks(trunkSid)
    .originationUrls.list({ limit: 20 });

  return {
    sid: trunk.sid,
    friendlyName: trunk.friendlyName,
    domainName: trunk.domainName,
    originationUris: uris.map((u) => u.sipUrl),
  };
}

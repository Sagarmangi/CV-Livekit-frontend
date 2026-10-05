"use client";

import { useEffect, useState } from "react";
import {
  useLocalParticipant,
  useRoomContext,
  useTrackVolume,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track, type LocalAudioTrack } from "livekit-client";

/**
 * The room-side half of talking to an agent from a browser, shared by the
 * dashboard's test panel and the public web widget. Both connect a
 * `LiveKitRoom` to a room the worker was dispatched into and then need the
 * same answers: is the agent here yet, what state is it in, did it report a
 * failure, is the microphone actually carrying sound.
 */

/** Text-stream topic the worker reports failures on -- must match
 * DIAGNOSTIC_TOPIC in agent-worker/src/worker/entrypoint.py. */
export const DIAGNOSTIC_TOPIC = "codeora.diagnostic";

/**
 * How long to wait for the worker to join before saying so. A dispatch that no
 * worker picks up produces no event at all -- nothing errors, nothing arrives,
 * and the UI would otherwise read "Connecting" indefinitely. Generous enough
 * to cover a cold worker loading its VAD model on first job.
 */
export const AGENT_JOIN_TIMEOUT_MS = 12_000;

export const AGENT_STATE_LABEL: Record<string, string> = {
  connecting: "Connecting",
  initializing: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  disconnected: "Waiting for the agent",
};

export type AgentRoomLogger = (event: string, detail?: unknown) => void;

/**
 * Timeline logger for the browser console, tagged so it's greppable among
 * livekit-client's own output.
 *
 * This exists because a deployed failure gives you almost nothing to go on: the
 * client connects, publishes, and then simply waits. The interesting question is
 * always *which* step stopped -- did the dispatch get created, did any
 * participant arrive, did the agent arrive and leave, did it publish audio -- and
 * none of that is visible without printing it. The elapsed offset matters as much
 * as the events: a worker joining at 8s and never joining look the same in a
 * screenshot of a spinner.
 */
export function createTaggedLogger(tag: string): AgentRoomLogger {
  const startedAt = Date.now();
  return (event, detail) => {
    const at = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (detail === undefined) console.info(`[${tag} +${at}s] ${event}`);
    else console.info(`[${tag} +${at}s] ${event}`, detail);
  };
}

/**
 * Must be rendered inside a `LiveKitRoom`. `log` has to be referentially
 * stable (a module-level logger, not an inline function) -- the effects here
 * subscribe to room events and re-subscribe whenever it changes.
 */
export function useAgentRoom(log: AgentRoomLogger) {
  const room = useRoomContext();
  const { state, agent } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [joinTimedOut, setJoinTimedOut] = useState(false);

  // The worker reports why a call failed on its own topic (a missing provider
  // key, a paused agent, a deleted agent). Without this the failure only ever
  // reached the worker's stdout -- on another machine, in production.
  useEffect(() => {
    const handler = async (reader: { readAll: () => Promise<string> }) => {
      const text = await reader.readAll();
      log("WORKER REPORTED A FAILURE", text);
      setDiagnostic(text);
    };
    room.registerTextStreamHandler(DIAGNOSTIC_TOPIC, handler);
    return () => room.unregisterTextStreamHandler(DIAGNOSTIC_TOPIC);
  }, [room, log]);

  // Participant/track events, logged rather than only rendered: an agent that
  // joins and immediately leaves is a crashed job, an agent that joins without
  // publishing audio is a session that never started, and a room that stays
  // empty is a dispatch nobody claimed. All three look like a spinner on screen.
  useEffect(() => {
    const onJoin = (p: { identity: string; kind: unknown }) =>
      log("participant joined", { identity: p.identity, kind: p.kind });
    const onLeave = (p: { identity: string }) =>
      log("participant LEFT (a crashed job looks like this)", p.identity);
    const onTrack = (_t: unknown, _pub: unknown, p: { identity: string }) =>
      log("subscribed to audio from", p.identity);

    room.on("participantConnected", onJoin);
    room.on("participantDisconnected", onLeave);
    room.on("trackSubscribed", onTrack);
    return () => {
      room.off("participantConnected", onJoin);
      room.off("participantDisconnected", onLeave);
      room.off("trackSubscribed", onTrack);
    };
  }, [room, log]);

  useEffect(() => {
    log(`agent state: ${state}`);
  }, [state, log]);

  // Deliberately a plain timer rather than state derived from `agent`: an
  // unclaimed dispatch fires no event to react to. Depends on `agent` so the
  // timer is torn down the moment one arrives -- otherwise it still fired 12s
  // in and logged "NO AGENT" about an agent that had been talking for seven
  // seconds, and a late-joining worker clears the warning by itself.
  useEffect(() => {
    if (agent) return;
    const id = setTimeout(() => {
      log(
        `NO AGENT after ${AGENT_JOIN_TIMEOUT_MS / 1000}s — the dispatch was created but ` +
          `nothing claimed it. Check the worker is running and that its ` +
          `LIVEKIT_AGENT_NAME and LIVEKIT_URL match the values logged above.`,
      );
      setJoinTimedOut(true);
    }, AGENT_JOIN_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [agent, log]);

  // "The agent can't hear me" is otherwise pure guesswork: the track publishes
  // successfully whether or not the microphone is actually capturing anything, so
  // a muted input, a dead default device, or permission granted to the wrong one
  // all look identical to a working mic. This reads the level off the published
  // track, which is the same audio the agent receives -- if this doesn't move
  // while you speak, nothing downstream was ever going to hear you.
  const micTrack = localParticipant
    .getTrackPublication(Track.Source.Microphone)
    ?.audioTrack as LocalAudioTrack | undefined;
  const micLevel = useTrackVolume(micTrack);
  const micLive = isMicrophoneEnabled && micLevel > 0.01;

  // Anything sent to the agent before its session is up is dropped on the
  // floor with no error anywhere. On a loaded machine the agent can take ~17s
  // to reach `listening`, so callers gate input on this rather than on `agent`.
  const agentReady =
    agent !== undefined && (state === "listening" || state === "thinking" || state === "speaking");

  return {
    room,
    /** The voice assistant's state: connecting/initializing/listening/thinking/speaking/disconnected. */
    state,
    agent,
    agentReady,
    /** The join timeout passed and still nobody is here. Clears itself if a worker arrives late. */
    agentMissing: joinTimedOut && !agent,
    /** The worker's own account of a failure, or null. */
    diagnostic,
    localParticipant,
    isMicrophoneEnabled,
    /** 0..1 RMS of the published mic track. */
    micLevel,
    /** Whether that level is actually above the noise floor. */
    micLive,
    toggleMicrophone: () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
    hangUp: () => room.disconnect(),
  };
}

export function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

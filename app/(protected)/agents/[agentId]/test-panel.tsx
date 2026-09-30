"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTrackVolume,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track, type LocalAudioTrack } from "livekit-client";

import { createTestSession } from "@/app/(protected)/agents/[agentId]/test-actions";
import { Button } from "@/components/ui";

type Session = {
  token: string;
  url: string;
  roomName: string;
  agentName: string;
  dispatchId: string | null;
};

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
const startedAt = Date.now();
function testLog(event: string, detail?: unknown): void {
  const at = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (detail === undefined) console.info(`[kodexo-test +${at}s] ${event}`);
  else console.info(`[kodexo-test +${at}s] ${event}`, detail);
}

/** Text-stream topic the worker reports failures on -- must match
 * DIAGNOSTIC_TOPIC in agent-worker/src/worker/entrypoint.py. */
const DIAGNOSTIC_TOPIC = "kodexo.diagnostic";

// LiveKit's built-in chat topic. AgentSession already treats anything arriving
// here as a user turn, so typing reaches the model by exactly the same path
// speech would after transcription -- no worker-side handler needed. Must stay
// equal to `TOPIC_CHAT` in livekit.agents.types.
const CHAT_TOPIC = "lk.chat";

/**
 * How long to wait for the worker to join before saying so. A dispatch that no
 * worker picks up produces no event at all -- nothing errors, nothing arrives,
 * and the panel would otherwise read "Connecting" indefinitely. Generous enough
 * to cover a cold worker loading its VAD model on first job.
 */
const AGENT_JOIN_TIMEOUT_MS = 12_000;

/**
 * Talk to this agent directly through the browser, entirely local to whatever
 * LiveKit server is configured -- no Twilio/SIP involved. Explicitly
 * dispatches the worker into a fresh room (see test-actions.ts) the same way
 * a real call would, just without a phone number in the middle. Works for
 * draft/paused agents too, since that's the point of testing before going live.
 *
 * Vapi-style: a full-height panel docked to the right edge, not inline page
 * content -- so the rest of the agent's config (Voice, Tools, etc.) stays
 * visible and usable to the left of it instead of the "Test agent" button
 * swapping out the whole tab area.
 */
export function TestAgentPanel({
  agentId,
  agentName,
  autoStart = false,
}: {
  agentId: string;
  agentName: string;
  /**
   * Start a session as soon as this mounts. Set by test-panel-loader.tsx,
   * which only mounts this module once the button has been clicked -- so the
   * click that pulled in the LiveKit chunk is also the click that connects,
   * rather than asking for a second one.
   */
  autoStart?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    setWidgetOpen(true);
    setMinimized(false);
    testLog("requesting a test session", { agentId });
    const result = await createTestSession(agentId);
    setStarting(false);
    if ("error" in result) {
      testLog("SESSION REQUEST FAILED", result.error);
      setError(result.error);
      return;
    }
    testLog("dispatch created — now waiting for the worker to claim it", {
      room: result.roomName,
      livekit: result.url,
      // If no agent ever joins, this is the first thing to check: it must equal
      // the worker's LIVEKIT_AGENT_NAME on whichever machine is running it.
      agentName: result.agentName,
      dispatchId: result.dispatchId,
    });
    setSession(result);
  }, [agentId]);

  // Guarded by a ref rather than the effect's deps: `start` is recreated
  // whenever agentId changes, and a second run would open a second session.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void start();
  }, [autoStart, start]);

  const closeWidget = useCallback(() => {
    setSession(null);
    setError(null);
    setWidgetOpen(false);
  }, []);

  const toggleMinimize = useCallback(() => setMinimized((m) => !m), []);

  return (
    <>
      <Button type="button" variant="primary" onClick={start} disabled={starting}>
        {starting ? "Connecting…" : "Test agent"}
      </Button>

      {/*
        Rendered into <body> rather than in place. This button lives in the
        agent page's sticky header, which is a `position: sticky` element with a
        z-index -- that makes it a stacking context, so a `fixed` panel nested
        inside it is trapped in that context no matter how high its own z-index
        goes. The symptom was the tab bar (an ordinary z-10 sibling of the
        header, later in the DOM) painting straight over the panel. A portal
        moves the panel out to the top level where `z-40` means what it says.
      */}
      {widgetOpen && createPortal(
        <PanelShell minimized={minimized}>
          {session ? (
            <LiveKitRoom
              // `LiveKitRoom` wraps children in its own div (`.lk-room-container`,
              // styled by `@livekit/components-styles` with its own dark
              // background). `display: contents` here removes that box from
              // the layout entirely, so its children become direct flex items
              // of PanelShell's flex-col -- without it, our header/body/footer
              // just stack at natural height inside a plain block box instead
              // of flex-1/shrink-0 actually filling and pinning correctly, and
              // that div's own background painted over the gap as a dark bar.
              className="contents"
              serverUrl={session.url}
              token={session.token}
              audio
              connect
              onConnected={() => testLog("browser joined the room")}
              onDisconnected={(reason) => {
                testLog("browser left the room", { reason });
                closeWidget();
              }}
              onError={(err) => {
                testLog("ROOM ERROR", err);
                setError(`Couldn't connect: ${err.message}`);
                setSession(null);
              }}
            >
              <ConnectedPanelBody
                agentName={agentName}
                minimized={minimized}
                onToggleMinimize={toggleMinimize}
                onClose={closeWidget}
              />
              <RoomAudioRenderer />
            </LiveKitRoom>
          ) : (
            <PendingPanelBody
              agentName={agentName}
              error={error}
              minimized={minimized}
              onToggleMinimize={toggleMinimize}
              onClose={closeWidget}
            />
          )}
        </PanelShell>,
        document.body,
      )}
    </>
  );
}

/** Full-height panel docked to the right edge when expanded; shrinks to just
 * the status bar (see StatusBar) floating bottom-right when minimized. Pure
 * flexbox column -- header/body/footer are ordinary flex children, not
 * absolutely positioned against guessed offsets. */
function PanelShell({
  minimized,
  children,
}: {
  minimized: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        minimized
          ? "fixed right-4 bottom-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col"
          : "fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line bg-surface shadow-lg"
      }
    >
      {children}
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-divider px-4">
      <span className="flex items-center gap-2 font-heading text-sm font-semibold text-strong">
        <ChatIcon /> Transcript
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1 text-faint transition-colors hover:bg-canvas-alt hover:text-strong"
      >
        <XIcon />
      </button>
    </header>
  );
}

/** Before a room connection exists -- no mic/hang-up yet, nothing to show but
 * a placeholder and (if it failed) the error. */
function PendingPanelBody({
  agentName,
  error,
  minimized,
  onToggleMinimize,
  onClose,
}: {
  agentName: string;
  error: string | null;
  minimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {!minimized && (
        <>
          <PanelHeader onClose={onClose} />
          <div className="flex-1 overflow-y-auto p-4">
            {error ? (
              <p className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
                {error}
              </p>
            ) : (
              <p className="mt-16 text-center text-sm text-faint">
                Waiting for conversation…
              </p>
            )}
          </div>
        </>
      )}
      <StatusBar
        statusLabel={error ? "Error" : "Connecting"}
        agentName={agentName}
        elapsedLabel="00:00"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
      />
    </>
  );
}

const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting",
  initializing: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  disconnected: "Waiting for the agent",
};

function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Why the microphone isn't capturing, in the caller's terms -- or null when
 * there's nothing wrong with it.
 *
 * This exists because a mic that never opens at all was completely invisible
 * here. The "sending silence" warning further down only fires when the track
 * IS enabled and flat, so permission-denied, no-device and non-secure-origin --
 * every case where capture never starts -- rendered a panel that looked
 * perfectly healthy while the agent could not hear a thing. Chat kept working
 * throughout (it's a data channel, no capture involved), which made it read as
 * "the agent ignores speech" rather than "this browser never gave us a mic".
 *
 * The secure-context branch is the one worth knowing about: browsers only
 * expose getUserMedia on HTTPS or localhost, so the dashboard served over plain
 * HTTP at an IP address has no microphone API at all -- `navigator.mediaDevices`
 * is undefined, nothing throws, and no permission prompt ever appears.
 */
async function describeMicrophoneProblem(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (!window.isSecureContext) {
    return (
      `This page is served over plain HTTP (${window.location.origin}), and browsers ` +
      `only allow microphone access on HTTPS or localhost. That's why no permission ` +
      `prompt appeared. Put the dashboard behind HTTPS, or open it at http://localhost ` +
      `to test with audio. Typing below works either way.`
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser doesn't expose a microphone API. Try current Chrome, Edge or Firefox.";
  }

  try {
    // Opened and immediately released -- this is a probe for the reason, not a
    // capture. Leaving the device held would keep LiveKit from acquiring it.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return (
        "This site is blocked from using the microphone. Click the padlock (or camera) " +
        "icon in the address bar, set Microphone to Allow, and start the test again."
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "No microphone was found. Plug one in, or pick a different input device in the OS sound settings.";
    }
    if (name === "NotReadableError") {
      return (
        "The microphone is held by another application (Zoom, Teams, Meet, OBS). " +
        "Close whatever is using it and start the test again."
      );
    }
    return `The microphone couldn't be opened: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

/** Rendered inside the LiveKitRoom -- header, live transcript, and the
 * mic/hang-up-equipped status bar, all as plain flex children of PanelShell. */
function ConnectedPanelBody({
  agentName,
  minimized,
  onToggleMinimize,
  onClose,
}: {
  agentName: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}) {
  const room = useRoomContext();
  const { state, agent } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const elapsed = useElapsedSeconds();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [joinTimedOut, setJoinTimedOut] = useState(false);

  // The worker reports why a call failed on its own topic (a missing provider
  // key, a paused agent, a deleted agent). Without this the failure only ever
  // reached the worker's stdout -- on another machine, in production.
  useEffect(() => {
    const handler = async (reader: { readAll: () => Promise<string> }) => {
      const text = await reader.readAll();
      testLog("WORKER REPORTED A FAILURE", text);
      setDiagnostic(text);
    };
    room.registerTextStreamHandler(DIAGNOSTIC_TOPIC, handler);
    return () => room.unregisterTextStreamHandler(DIAGNOSTIC_TOPIC);
  }, [room]);

  // Participant/track events, logged rather than only rendered: an agent that
  // joins and immediately leaves is a crashed job, an agent that joins without
  // publishing audio is a session that never started, and a room that stays
  // empty is a dispatch nobody claimed. All three look like a spinner on screen.
  useEffect(() => {
    const onJoin = (p: { identity: string; kind: unknown }) =>
      testLog("participant joined", { identity: p.identity, kind: p.kind });
    const onLeave = (p: { identity: string }) =>
      testLog("participant LEFT (a crashed job looks like this)", p.identity);
    const onTrack = (_t: unknown, _pub: unknown, p: { identity: string }) =>
      testLog("subscribed to audio from", p.identity);

    room.on("participantConnected", onJoin);
    room.on("participantDisconnected", onLeave);
    room.on("trackSubscribed", onTrack);
    return () => {
      room.off("participantConnected", onJoin);
      room.off("participantDisconnected", onLeave);
      room.off("trackSubscribed", onTrack);
    };
  }, [room]);

  useEffect(() => {
    testLog(`agent state: ${state}`);
  }, [state]);

  // Deliberately a plain timer rather than state derived from `agent`: an
  // unclaimed dispatch fires no event to react to. Kept separate from the
  // `!agent` check below so a late-joining worker clears the warning by itself.
  useEffect(() => {
    // Depends on `agent` so the timer is torn down the moment one arrives.
    // Without that, the timeout still fired 12s in and logged "NO AGENT" about
    // an agent that had been talking for seven seconds -- the banner was
    // correctly hidden by the `!agent` check below, but the console said the
    // opposite, which is worse than saying nothing.
    if (agent) return;
    const id = setTimeout(() => {
      testLog(
        `NO AGENT after ${AGENT_JOIN_TIMEOUT_MS / 1000}s — the dispatch was created but ` +
          `nothing claimed it. Check the worker is running and that its ` +
          `LIVEKIT_AGENT_NAME and LIVEKIT_URL match the values logged above.`,
      );
      setJoinTimedOut(true);
    }, AGENT_JOIN_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [agent]);

  const agentMissing = joinTimedOut && !agent;
  const problem = diagnostic !== null || agentMissing;

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

  // The meter alone is too quiet a signal -- it sits in the status bar and is
  // easy to never look at, which is exactly how a silent microphone reads as
  // "the agent is broken". Once the mic has been flat for a stretch while the
  // agent is up and waiting, say so outright.
  // Gated on a boolean rather than the raw level: `micLevel` changes on every
  // audio frame, so depending on it directly would clear and restart the timer
  // continuously and it would never fire.
  // Runs once per connected session, regardless of whether the mic looks fine --
  // the answer is needed the moment `isMicrophoneEnabled` turns out false, and
  // asking only then would race LiveKit's own acquisition attempt.
  const [micProblem, setMicProblem] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void describeMicrophoneProblem().then((problem) => {
      if (cancelled) return;
      if (problem) testLog("MICROPHONE UNAVAILABLE", problem);
      setMicProblem(problem);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const micQuiet = isMicrophoneEnabled && micLevel <= 0.01;
  // One timer for both directions: latch on after a sustained quiet spell, drop
  // immediately once audio returns. Deferring the clear through the same timer
  // keeps the state change out of the effect body itself.
  const [micSilent, setMicSilent] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMicSilent(micQuiet), micQuiet ? 6000 : 0);
    return () => clearTimeout(id);
  }, [micQuiet]);

  // Typed messages are kept locally because nothing echoes them back: the
  // session takes them straight into the chat context, so only the agent's
  // side of a typed exchange ever arrives as a transcription.
  const [typed, setTyped] = useState<{ id: string; text: string; at: number }[]>([]);
  const [draft, setDraft] = useState("");
  const [sendFailed, setSendFailed] = useState<string | null>(null);

  // Anything sent before the agent's session is up is dropped on the floor --
  // the text stream is delivered to a room where nothing is listening for it
  // yet, and there is no error anywhere. On a loaded machine the agent can take
  // ~17s to reach `listening`, so this is a wide window to type into and get
  // silence back. Blocking the input is what makes that impossible rather than
  // merely unlikely.
  const agentReady =
    agent !== undefined && (state === "listening" || state === "thinking" || state === "speaking");

  const micDead = agentReady && micSilent;

  const sendTyped = useCallback(async () => {
    const text = draft.trim();
    if (!text || !agentReady) return;
    setDraft("");
    setSendFailed(null);
    setTyped((prev) => [...prev, { id: `typed-${prev.length}-${Date.now()}`, text, at: Date.now() }]);
    try {
      await localParticipant.sendText(text, { topic: CHAT_TOPIC });
      testLog("typed message sent", { text });
    } catch (err) {
      testLog("TYPED MESSAGE FAILED", err);
      setSendFailed(err instanceof Error ? err.message : String(err));
    }
  }, [draft, localParticipant, agentReady]);

  const messages = useMemo(() => {
    const spoken = transcriptions.map((t) => ({
      id: t.streamInfo.id,
      text: t.text,
      at: t.streamInfo.timestamp,
      fromAgent: agent !== undefined && t.participantInfo.identity === agent.identity,
    }));
    const written = typed.map((t) => ({ id: t.id, text: t.text, at: t.at, fromAgent: false }));
    return [...spoken, ...written].sort((a, b) => a.at - b.at);
  }, [transcriptions, agent, typed]);

  // Scrolls to the newest message as they arrive -- transcriptions stream in
  // piece by piece (a message's text keeps growing, not just new messages
  // appearing), so this runs on every render rather than just message count.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  return (
    <>
      {!minimized && (
        <>
          <PanelHeader onClose={onClose} />
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {problem && (
              <div className="space-y-1.5 rounded-md border border-error-border bg-error-bg px-3 py-2.5">
                <p className="font-heading text-sm font-semibold text-error-text">
                  {!diagnostic
                    ? "No agent joined"
                    : agent
                      ? "The agent hit a problem mid-call"
                      : "The agent couldn't start"}
                </p>
                <p className="text-[0.8125rem] leading-relaxed text-error-text">
                  {diagnostic ??
                    `Nothing picked up this call within ${
                      AGENT_JOIN_TIMEOUT_MS / 1000
                    }s. Either the worker isn't running (or is registered under a different agent name), or it's still starting up on a loaded machine — this clears itself if it arrives late.`}
                </p>
                <p className="pt-0.5 font-mono text-[0.6875rem] break-all text-faint">
                  room {room.name}
                </p>
              </div>
            )}
            {/* The mic never opened. Distinct from the silence warning below,
                which assumes a working capture that happens to be quiet -- this
                one means no audio path exists at all, and it's the case that
                previously showed nothing whatsoever. */}
            {micProblem && (
              <div className="space-y-1.5 rounded-md border border-error-border bg-error-bg px-3 py-2.5">
                <p className="font-heading text-sm font-semibold text-error-text">
                  The agent can&apos;t hear you — no microphone
                </p>
                <p className="text-[0.8125rem] leading-relaxed text-error-text">
                  {micProblem}
                </p>
              </div>
            )}
            {micDead && !micProblem && (
              <div className="space-y-1.5 rounded-md border border-warning-border bg-warning-bg px-3 py-2.5">
                <p className="font-heading text-sm font-semibold text-warning-text">
                  Your microphone is sending silence
                </p>
                <p className="text-[0.8125rem] leading-relaxed text-warning-text">
                  The agent is connected and waiting, but no sound is reaching it, so it has
                  nothing to reply to. Check that the mic isn&apos;t muted below, that Windows is
                  using the input you&apos;re speaking into, and that this site has permission for
                  that device. You can still type below in the meantime.
                </p>
              </div>
            )}
            {messages.length === 0 ? (
              !problem && (
                <p className="mt-16 text-center text-sm text-faint">
                  Waiting for conversation…
                </p>
              )
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.fromAgent ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={
                      message.fromAgent
                        ? "max-w-[85%] rounded-lg rounded-bl-sm border border-line bg-canvas-alt px-3 py-2 text-sm leading-relaxed text-body"
                        : "max-w-[85%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm leading-relaxed text-on-brand"
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Typing is the microphone-free path to the agent: if a typed
              message gets a spoken reply, the model, prompt and audio output
              are all fine and any remaining fault is in the audio input. */}
          <div className="shrink-0 border-t border-line px-3 py-2.5">
            {sendFailed && (
              <p className="pb-1.5 text-[0.75rem] text-error-text">
                Couldn&apos;t send: {sendFailed}
              </p>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendTyped();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!agentReady}
                placeholder={
                  agentReady ? "Type a message to the agent…" : "Waiting for the agent to join…"
                }
                aria-label="Type a message to the agent"
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas-alt px-2.5 py-1.5 text-sm text-body placeholder:text-faint focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !agentReady}
                className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-on-brand transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </>
      )}
      <StatusBar
        statusLabel={problem ? "Problem" : (STATE_LABEL[state] ?? state)}
        stalled={problem}
        micLevel={isMicrophoneEnabled ? micLevel : 0}
        micLive={micLive}
        agentName={agentName}
        elapsedLabel={formatElapsed(elapsed)}
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        onMute={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        muted={!isMicrophoneEnabled}
        onHangUp={() => room.disconnect()}
      />
    </>
  );
}

/** The status/control bar -- a fixed-height flex child pinned near the
 * bottom of the expanded panel, or the entire visible widget when minimized. */
function StatusBar({
  statusLabel,
  agentName,
  elapsedLabel,
  minimized,
  onToggleMinimize,
  onMute,
  muted,
  onHangUp,
  stalled = false,
  micLevel = 0,
  micLive = false,
}: {
  statusLabel: string;
  agentName: string;
  elapsedLabel: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  onMute?: () => void;
  muted?: boolean;
  onHangUp?: () => void;
  /** Stops the dot pulsing. Minimized, this bar is the only thing on screen, so
   * a pulse next to "Problem" would still read as "working on it". */
  stalled?: boolean;
  /** 0..1 level of the published mic track. */
  micLevel?: number;
  /** Whether that level is actually above the noise floor. */
  micLive?: boolean;
}) {
  return (
    <div
      className={
        minimized
          ? "shrink-0 rounded-lg border border-line bg-surface p-3 shadow-lg"
          : "mx-3 mb-3 shrink-0 rounded-lg border border-line bg-canvas-alt p-3"
      }
    >
      <div className="flex items-center justify-between">
        <span className="mono-kicker flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-pill bg-brand ${stalled ? "" : "brand-pulse"}`}
          />
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label={minimized ? "Expand" : "Minimize"}
          className="rounded-md p-1 text-faint transition-colors hover:bg-surface hover:text-strong"
        >
          <MinusIcon />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold text-strong">
            {agentName}
          </p>
          <p className="font-mono text-xs text-faint tabular-nums">{elapsedLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton active={minimized} onClick={onToggleMinimize} label="Toggle transcript">
            <ChatIcon />
          </IconButton>
          {onMute && (
            <span className="flex items-center gap-1.5">
              <IconButton active={muted} onClick={onMute} label={muted ? "Unmute" : "Mute"}>
                {muted ? <MicOffIcon /> : <MicIcon />}
              </IconButton>
              {/* Scaled x4 because normal speech sits low on a 0..1 RMS scale --
                  unscaled, a perfectly good microphone barely nudges the bar and
                  reads as broken. */}
              <span
                aria-hidden
                title={micLive ? "Your microphone is being heard" : "No input detected"}
                className="flex h-6 w-1.5 items-end overflow-hidden rounded-pill bg-line"
              >
                <span
                  className={`w-full rounded-pill transition-[height] duration-75 ${
                    micLive ? "bg-success-text" : "bg-transparent"
                  }`}
                  style={{ height: `${Math.min(100, micLevel * 400)}%` }}
                />
              </span>
            </span>
          )}
          {onHangUp && (
            <button
              type="button"
              onClick={onHangUp}
              aria-label="End test call"
              className="flex h-8 w-8 items-center justify-center rounded-pill bg-brand text-on-brand transition-colors hover:bg-brand-deep"
            >
              <HangUpIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        active
          ? "flex h-8 w-8 items-center justify-center rounded-pill bg-strong text-canvas transition-colors"
          : "flex h-8 w-8 items-center justify-center rounded-pill border border-line bg-surface text-muted transition-colors hover:text-strong"
      }
    >
      {children}
    </button>
  );
}

const ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-4 w-4",
  "aria-hidden": true,
};

function ChatIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 12h14" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2 2l20 20" />
      <path d="M9 5a3 3 0 0 1 6 0v6c0 .43-.08.84-.23 1.22M15 15a3 3 0 0 1-5.9-.68" />
      <path d="M19 10v1a7 7 0 0 1-1.32 4.09M5 10v1a7 7 0 0 0 10.24 6.2M12 18v4M8 22h8" />
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={0} fill="currentColor" className="h-4 w-4 rotate-[135deg]">
      <path d="M3.62 6.5c1.4-1.9 3.5-3.4 6.4-4.1a1 1 0 0 1 1.1.5l1.6 3a1 1 0 0 1-.3 1.3l-2 1.4c-.3.2-.4.6-.2.9 1 1.7 2.4 3.1 4.1 4.1.3.2.7.1.9-.2l1.4-2a1 1 0 0 1 1.3-.3l3 1.6a1 1 0 0 1 .5 1.1c-.7 2.9-2.2 5-4.1 6.4a1 1 0 0 1-1.2 0C11.4 17.6 5.9 12.1 3.4 7.7a1 1 0 0 1 .2-1.2Z" />
    </svg>
  );
}

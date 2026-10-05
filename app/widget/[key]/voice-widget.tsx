"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { MediaDeviceFailure, Room, RoomEvent } from "livekit-client";

import {
  AGENT_STATE_LABEL,
  createTaggedLogger,
  formatElapsed,
  useAgentRoom,
  useElapsedSeconds,
} from "@/components/agent-room";
import type { ResolvedWidgetConfig } from "@/lib/widget-config";

const log = createTaggedLogger("codeora-widget");

/**
 * What the visitor sees, from "nothing has happened" to "the call ended".
 * `requesting` is the session API round trip, `connecting` the LiveKit join
 * and the wait for the worker -- split because the failure modes differ.
 */
type Phase = "idle" | "requesting" | "connecting" | "live" | "ended" | "error";

/** Reported to the host page so its launcher can show "In call". Coarser than
 * Phase on purpose: the launcher has room for one word. */
type ReportedState = "idle" | "connecting" | "in_call" | "ended" | "error";

type Session = { token: string; url: string; maxSeconds: number };

/**
 * Slugs from app/api/widget/session/route.ts, in the visitor's terms. Written
 * for someone on a customer's website who has never heard of this platform --
 * no "dispatch", no "agent name", nothing to check in a console.
 */
const ERROR_MESSAGES: Record<string, string> = {
  busy: "All agents are busy, please try again shortly.",
  rate_limited: "Too many calls from your connection. Please try again in a few minutes.",
  daily_cap: "This assistant has reached its call limit for today. Please try again tomorrow.",
  origin_not_allowed: "This voice assistant isn't enabled for this website.",
  widget_disabled: "This voice assistant isn't available right now.",
  unknown_key: "This voice assistant isn't available right now.",
  not_configured: "This voice assistant isn't available right now.",
  livekit_unavailable: "The call service isn't reachable right now. Please try again shortly.",
  dispatch_failed: "We couldn't start the call. Please try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

const MIC_MESSAGES: Record<MediaDeviceFailure, string> = {
  [MediaDeviceFailure.PermissionDenied]:
    "Microphone access was blocked. Allow the microphone for this site in your browser, then try again.",
  [MediaDeviceFailure.NotFound]: "No microphone was found on this device.",
  [MediaDeviceFailure.DeviceInUse]:
    "Your microphone is being used by another app. Close it and try again.",
  [MediaDeviceFailure.Other]: "The microphone couldn't be opened. Please try again.",
};

/** localStorage key for the visitor id sent in the dispatch metadata, so the
 * worker can tell a returning visitor from a new one. Namespaced to the
 * widget: this page's origin is the dashboard's, and the dashboard has its
 * own keys in the same store. */
const VISITOR_STORAGE_KEY = "codeora-widget-visitor";

/**
 * Tells the host page's launcher (public/widget.js) what's going on. Target
 * origin is `*` because the host is whichever customer site embedded us and
 * nothing here is secret; the launcher checks *our* origin on its side.
 */
function postToHost(message: Record<string, unknown>): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ source: "codeora-widget", ...message }, "*");
}

/**
 * The site this iframe is on, as the browser reports it. `ancestorOrigins` is
 * the direct answer where it exists (Chromium, WebKit); Firefox only offers
 * the referrer, which the loader pins to `strict-origin-when-cross-origin` so
 * it carries the origin and nothing more. Null when this page is open on its
 * own in a tab -- the session API treats that as the dashboard's own preview.
 */
function embeddingOrigin(): string | null {
  const ancestors = window.location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) return ancestors[0];
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** Whether a host page is framing us -- i.e. whether there is anything to
 * "close". False on the server, settled on the client without an effect. */
const noSubscribe = () => () => {};
function useFramed(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => window.parent !== window,
    () => false,
  );
}

function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Third-party storage is partitioned or blocked in some browsers; a
    // per-load id is fine, the worker just can't recognise a return visit.
    return crypto.randomUUID();
  }
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately not themed through the dashboard's tokens: this renders on
 * other people's sites, where "follow the visitor's OS dark mode" would mean a
 * black panel on a white page half the time. Fixed light surface, one accent
 * colour from the agent's config, system font so it matches the host page.
 */
function Shell({
  accentColor,
  onClose,
  children,
}: {
  accentColor: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-dvh flex-col bg-white text-n-900"
      style={{ "--accent": accentColor, colorScheme: "light", fontFamily: "system-ui, sans-serif" } as React.CSSProperties}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-full p-1.5 text-n-500 transition-colors hover:bg-n-100 hover:text-n-900"
        >
          <XIcon />
        </button>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        {children}
      </div>
      <p className="pb-3 text-center text-[0.6875rem] text-n-400">Powered by Codeora Vision</p>
    </div>
  );
}

/** For a key that isn't one, or an agent that's off -- the page still has to
 * render something inside the customer's iframe. */
export function WidgetUnavailable() {
  return (
    <Shell accentColor="#71717A">
      <p className="text-sm text-n-600">This voice assistant isn&apos;t available right now.</p>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Widget                                                                     */
/* -------------------------------------------------------------------------- */

export function VoiceWidget({
  widgetKey,
  agentName,
  config,
  maxSeconds,
}: {
  widgetKey: string;
  agentName: string;
  config: ResolvedWidgetConfig;
  maxSeconds: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  // Nothing to close when opened directly rather than from a host page.
  const framed = useFramed();
  // One Room for the widget's lifetime, created inside the click handler on
  // the first call -- it has to exist before the first `await` there so
  // `startAudio()` runs from the user gesture (see `start`). Reused for every
  // call after that; a Room reconnects fine after a disconnect.
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    // The dashboard's pre-paint theme script may have picked dark from the
    // visitor's OS; the shell is explicitly light, so native controls should be too.
    document.documentElement.dataset.theme = "light";
    postToHost({ event: "ready" });
    postToHost({ event: "theme", accent: config.accentColor });
  }, [config.accentColor]);

  const report = useCallback((state: ReportedState) => {
    postToHost({ event: "state", state });
  }, []);

  const fail = useCallback(
    (message: string) => {
      log("FAILED", message);
      setError(message);
      setSession(null);
      setPhase("error");
      report("error");
    },
    [report],
  );

  const start = useCallback(async () => {
    setError(null);
    setEndedReason(null);
    setPhase("requesting");
    report("connecting");

    // Safari (and iOS in particular) only lets a page play sound in response
    // to a tap. Everything that follows is asynchronous -- the session API,
    // the join, the agent's first words arriving on a track -- so by the time
    // there is audio to play, the gesture is long gone. `startAudio()` here,
    // synchronously inside the click, is what unlocks playback for the room:
    // it resumes the audio context and plays a silent element while the
    // gesture is still live, and later tracks inherit that permission.
    const activeRoom = room ?? new Room();
    if (!room) setRoom(activeRoom);
    void activeRoom.startAudio().catch(() => {
      // Nothing to do yet -- `AudioBlocked` below offers a tap if it mattered.
    });

    // Ask for the microphone before dispatching a worker: a denied prompt is
    // the most common way a first call fails, and it should cost a dispatch
    // nobody can talk to. The probe stream is released straight away; LiveKit
    // acquires its own once connected, with permission already granted.
    if (!navigator.mediaDevices?.getUserMedia) {
      fail("This browser doesn't support voice calls. Try current Chrome, Safari, Edge or Firefox.");
      return;
    }
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((track) => track.stop());
    } catch (err) {
      const failure = MediaDeviceFailure.getFailure(err) ?? MediaDeviceFailure.Other;
      fail(MIC_MESSAGES[failure]);
      return;
    }

    const origin = embeddingOrigin();
    log("requesting a session", { widgetKey, origin });
    let response: Response;
    try {
      response = await fetch(`/api/widget/session?key=${encodeURIComponent(widgetKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: widgetKey, origin, visitor_id: visitorId() }),
      });
    } catch {
      fail(ERROR_MESSAGES.network);
      return;
    }

    if (!response.ok) {
      let slug = "dispatch_failed";
      try {
        slug = ((await response.json()) as { error?: string }).error ?? slug;
      } catch {
        // No body -- the generic message is right.
      }
      log(`session refused: ${response.status} ${slug}`);
      fail(ERROR_MESSAGES[slug] ?? ERROR_MESSAGES.dispatch_failed);
      return;
    }

    const next = (await response.json()) as Session;
    log("session granted — connecting", { livekit: next.url, maxSeconds: next.maxSeconds });
    setSession(next);
    setPhase("connecting");
  }, [widgetKey, room, report, fail]);

  const endCall = useCallback(
    (reason: string | null) => {
      setSession(null);
      setEndedReason(reason);
      setPhase("ended");
      report("ended");
    },
    [report],
  );

  const close = useCallback(() => postToHost({ event: "close" }), []);

  if (session && room) {
    return (
      <Shell accentColor={config.accentColor} onClose={framed ? close : undefined}>
        <LiveKitRoom
          room={room}
          serverUrl={session.url}
          token={session.token}
          connect
          audio
          className="contents"
          onConnected={() => log("joined the room")}
          onDisconnected={(reason) => {
            log("left the room", { reason });
            endCall(null);
          }}
          onError={(err) => {
            log("ROOM ERROR", err);
            fail("The connection dropped. Please try again.");
          }}
          onMediaDeviceFailure={(failure) => {
            if (!failure) return;
            log("MICROPHONE UNAVAILABLE", failure);
            fail(MIC_MESSAGES[failure]);
          }}
        >
          <LiveCall
            agentName={agentName}
            accentColor={config.accentColor}
            maxSeconds={session.maxSeconds || maxSeconds}
            onLive={() => {
              setPhase("live");
              report("in_call");
            }}
            onTimeLimit={() => endCall("The call reached its time limit.")}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </Shell>
    );
  }

  return (
    <Shell accentColor={config.accentColor} onClose={framed ? close : undefined}>
      <Ring accentColor={config.accentColor} mode={phase === "requesting" ? "connecting" : "idle"}>
        <MicIcon className="h-8 w-8" />
      </Ring>

      <div className="space-y-1.5">
        <p className="font-semibold text-n-900">{agentName}</p>
        {phase === "error" ? (
          <p role="alert" className="mx-auto max-w-xs text-sm leading-relaxed text-n-600">
            {error}
          </p>
        ) : phase === "ended" ? (
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-n-600">
            {endedReason ?? "Call ended. Thanks for talking with us."}
          </p>
        ) : phase === "requesting" ? (
          <p className="text-sm text-n-600">Connecting…</p>
        ) : (
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-n-600">{config.greeting}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void start()}
        disabled={phase === "requesting"}
        className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-md transition-opacity disabled:opacity-60"
        style={{ backgroundColor: config.accentColor }}
      >
        <PhoneIcon />
        {phase === "ended" || phase === "error" ? "Call again" : config.buttonLabel}
      </button>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* In the call                                                                */
/* -------------------------------------------------------------------------- */

const RING_MODE: Record<string, "idle" | "connecting" | "listening" | "thinking" | "speaking"> = {
  connecting: "connecting",
  initializing: "connecting",
  disconnected: "connecting",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

function LiveCall({
  agentName,
  accentColor,
  maxSeconds,
  onLive,
  onTimeLimit,
}: {
  agentName: string;
  accentColor: string;
  maxSeconds: number;
  onLive: () => void;
  onTimeLimit: () => void;
}) {
  const {
    room,
    state,
    agentReady,
    agentMissing,
    diagnostic,
    isMicrophoneEnabled,
    micLive,
    toggleMicrophone,
    hangUp,
  } = useAgentRoom(log);
  const elapsed = useElapsedSeconds();

  useEffect(() => {
    if (agentReady) onLive();
  }, [agentReady, onLive]);

  // The worker enforces the same limit; this is the client's copy so the call
  // ends cleanly at the limit rather than when the token expires.
  useEffect(() => {
    if (elapsed < maxSeconds) return;
    log("time limit reached — hanging up");
    void room.disconnect().then(onTimeLimit);
  }, [elapsed, maxSeconds, room, onTimeLimit]);

  const problem = diagnostic !== null || agentMissing;
  const statusLabel = problem
    ? "Something went wrong"
    : agentReady
      ? (AGENT_STATE_LABEL[state] ?? state)
      : "Connecting to the agent…";

  return (
    <>
      <Ring accentColor={accentColor} mode={problem ? "idle" : (RING_MODE[state] ?? "connecting")}>
        <MicIcon className="h-8 w-8" />
      </Ring>

      <div className="space-y-1.5">
        <p className="font-semibold text-n-900">{agentName}</p>
        <p className="text-sm text-n-600" aria-live="polite">
          {statusLabel}
        </p>
        <p className="font-mono text-xs text-n-400 tabular-nums">{formatElapsed(elapsed)}</p>
        {problem && (
          <p role="alert" className="mx-auto max-w-xs pt-1 text-sm leading-relaxed text-n-600">
            {diagnostic
              ? "The assistant hit a problem and had to stop. Please try again."
              : "The assistant didn't answer. Please hang up and try again."}
          </p>
        )}
        {!problem && agentReady && isMicrophoneEnabled && !micLive && elapsed > 8 && (
          <p className="mx-auto max-w-xs pt-1 text-xs leading-relaxed text-n-500">
            We can&apos;t hear anything yet — check your microphone isn&apos;t muted.
          </p>
        )}
      </div>

      <AudioBlocked room={room} accentColor={accentColor} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleMicrophone()}
          aria-pressed={!isMicrophoneEnabled}
          aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
          className={
            isMicrophoneEnabled
              ? "flex h-12 w-12 items-center justify-center rounded-full border border-n-200 bg-white text-n-700 transition-colors hover:bg-n-100"
              : "flex h-12 w-12 items-center justify-center rounded-full bg-n-900 text-white transition-colors"
          }
        >
          {isMicrophoneEnabled ? <MicIcon className="h-5 w-5" /> : <MicOffIcon />}
        </button>
        <button
          type="button"
          onClick={() => void hangUp()}
          aria-label="End call"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626] text-white shadow-md transition-opacity hover:opacity-90"
        >
          <PhoneIcon className="h-5 w-5 rotate-[135deg]" />
        </button>
      </div>
    </>
  );
}

/**
 * The fallback for a browser that refused playback despite `startAudio()` in
 * the click (an iframe that lost its activation, a strict autoplay setting):
 * `canPlaybackAudio` goes false and the agent is talking to no one. A tap
 * here is a fresh gesture, which is all the browser wants.
 */
function AudioBlocked({ room, accentColor }: { room: Room; accentColor: string }) {
  const [blocked, setBlocked] = useState(() => !room.canPlaybackAudio);
  useEffect(() => {
    const update = () => setBlocked(!room.canPlaybackAudio);
    room.on(RoomEvent.AudioPlaybackStatusChanged, update);
    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, update);
    };
  }, [room]);

  if (!blocked) return null;
  return (
    <button
      type="button"
      onClick={() => void room.startAudio()}
      className="rounded-full border px-4 py-2 text-sm font-medium"
      style={{ borderColor: accentColor, color: accentColor }}
    >
      Tap to hear the assistant
    </button>
  );
}

/**
 * The one visual that carries state: a disc in the accent colour whose halo
 * pulses while the agent speaks, breathes while it listens and holds still
 * while it thinks. Keyframes live in globals.css (`.widget-ring-*`).
 */
function Ring({
  accentColor,
  mode,
  children,
}: {
  accentColor: string;
  mode: "idle" | "connecting" | "listening" | "thinking" | "speaking";
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <span
        aria-hidden
        className={`widget-ring-halo widget-ring-${mode} absolute inset-0 rounded-full`}
        style={{ backgroundColor: accentColor }}
      />
      <span
        className="relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: accentColor }}
      >
        {children}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

const ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function MicIcon({ className }: { className: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="M2 2l20 20" />
      <path d="M9 5a3 3 0 0 1 6 0v6c0 .43-.08.84-.23 1.22M15 15a3 3 0 0 1-5.9-.68" />
      <path d="M19 10v1a7 7 0 0 1-1.32 4.09M5 10v1a7 7 0 0 0 10.24 6.2M12 18v4M8 22h8" />
    </svg>
  );
}

function PhoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} strokeWidth={0} fill="currentColor" className={className}>
      <path d="M3.62 6.5c1.4-1.9 3.5-3.4 6.4-4.1a1 1 0 0 1 1.1.5l1.6 3a1 1 0 0 1-.3 1.3l-2 1.4c-.3.2-.4.6-.2.9 1 1.7 2.4 3.1 4.1 4.1.3.2.7.1.9-.2l1.4-2a1 1 0 0 1 1.3-.3l3 1.6a1 1 0 0 1 .5 1.1c-.7 2.9-2.2 5-4.1 6.4a1 1 0 0 1-1.2 0C11.4 17.6 5.9 12.1 3.4 7.7a1 1 0 0 1 .2-1.2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Shared between the dashboard's widget editor, the session API and the
 * public widget page -- no server-only imports here, since the widget page is
 * a client component and needs the same defaults the editor shows.
 */

import type { WidgetConfig } from "@/lib/types";

/** `wk_` plus exactly 24 base64url characters (18 random bytes) -- the same
 * check constraint the `agents.widget_key` column enforces. */
export const WIDGET_KEY_PATTERN = /^wk_[A-Za-z0-9_-]{24}$/;

export const WIDGET_MAX_SECONDS = {
  min: 30,
  max: 3600,
  /** Used when the column is somehow null -- the migration's own default. */
  fallback: 300,
} as const;

export const WIDGET_LIMITS = {
  buttonLabel: 40,
  introText: 300,
  greeting: 300,
} as const;

/** How the widget waits for a free slot when every worker is busy: poll the
 * availability endpoint this often (plus up to ±1s jitter so a page full of
 * waiting visitors doesn't poll in lockstep), and stop after this long. */
export const WIDGET_WAIT = {
  pollMs: 4_000,
  jitterMs: 1_000,
  giveUpMs: 3 * 60_000,
  /** What the busy responses advertise in Retry-After / retryAfterSeconds. */
  retryAfterSeconds: 5,
} as const;

/** The dashboard's brand blue -- what a widget looks like before anyone
 * picks a colour, so a brand-new one isn't grey. */
export const WIDGET_DEFAULT_ACCENT = "#043FFF";

export const WIDGET_DEFAULT_BUTTON_LABEL = "Start call";

/** What the widget page needs. The spoken greeting isn't here: the worker
 * reads that from the agent row itself when the call starts. */
export type ResolvedWidgetConfig = {
  accentColor: string;
  buttonLabel: string;
  introText: string;
};

export function resolveWidgetConfig(
  config: WidgetConfig | null | undefined,
  agentName: string,
): ResolvedWidgetConfig {
  return {
    accentColor: isHexColor(config?.accent_color) ? config.accent_color : WIDGET_DEFAULT_ACCENT,
    buttonLabel: config?.button_label?.trim() || WIDGET_DEFAULT_BUTTON_LABEL,
    introText: config?.intro_text?.trim() || defaultIntroText(agentName),
  };
}

export function defaultIntroText(agentName: string): string {
  return `Hi! Tap the button to talk to ${agentName}.`;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Turns whatever an admin typed into the exact origin a browser will send --
 * `example.com`, `https://example.com/pricing` and `HTTPS://Example.com` all
 * become `https://example.com`. Null for anything that isn't an http(s) URL,
 * so a typo can't be saved as an entry that will never match.
 *
 * Exact-origin matching is deliberate: a `www.` host and its bare domain are
 * different origins to the browser, so they're different entries here too.
 */
export function normalizeOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

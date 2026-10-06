import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { cloudinaryEnv } from "@/lib/env";

/**
 * Call recordings live in Cloudinary as *authenticated* assets (see
 * agent-worker/src/worker/recording.py): the worker uploads with
 * resource_type "video", type "authenticated", public_id <folder>/<room>,
 * format ogg, and stores `secure_url`. An authenticated asset answers an
 * unsigned URL with 401, so the stored URL on its own never plays -- it has
 * to be re-issued with a signature, which needs the API secret and so can
 * only happen here on the server.
 */

export type RecordingLink = {
  /** What to put in the player and the download link. */
  url: string;
  /** False when the Cloudinary keys aren't set and this is the stored URL
   * unchanged -- which will 401 for an authenticated asset. */
  signed: boolean;
};

/**
 * The parts of a Cloudinary delivery URL needed to sign a fresh one:
 *   https://res.cloudinary.com/<cloud>/<resource_type>/<type>/[s--sig--/][v<version>/]<public_id>.<format>
 * `public_id` keeps its folder; any existing signature and the version
 * prefix are not part of it.
 */
export function parseRecordingUrl(stored: string): {
  publicId: string;
  format: string | null;
  version: number | null;
} | null {
  let url: URL;
  try {
    url = new URL(stored);
  } catch {
    return null;
  }
  if (!/(^|\.)cloudinary\.com$/.test(url.hostname)) return null;

  // /<cloud>/<resource_type>/<type>/...rest
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 4) return null;
  let rest = segments.slice(3);

  if (/^s--[A-Za-z0-9_-]+--$/.test(rest[0] ?? "")) rest = rest.slice(1);
  let version: number | null = null;
  if (/^v\d+$/.test(rest[0] ?? "")) {
    version = Number(rest[0].slice(1));
    rest = rest.slice(1);
  }
  if (rest.length === 0) return null;

  const joined = rest.map(decodeURIComponent).join("/");
  const dot = joined.lastIndexOf(".");
  const lastSlash = joined.lastIndexOf("/");
  // Only a dot in the final segment is an extension; folders may contain dots.
  if (dot > lastSlash) {
    return { publicId: joined.slice(0, dot), format: joined.slice(dot + 1), version };
  }
  return { publicId: joined, format: null, version };
}

let configured = false;

/**
 * A URL that will actually play. Signs when the keys are present and the
 * stored URL is a Cloudinary one; otherwise hands back the stored URL and
 * says so, so the page can explain why playback fails rather than showing a
 * player that silently errors.
 */
export function recordingLink(stored: string): RecordingLink {
  const env = cloudinaryEnv();
  const parsed = parseRecordingUrl(stored);
  if (!env || !parsed) return { url: stored, signed: false };

  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudName,
      api_key: env.apiKey,
      api_secret: env.apiSecret,
      secure: true,
      // Without this the SDK appends an `_a=` analytics token to every URL.
      urlAnalytics: false,
    });
    configured = true;
  }

  const url = cloudinary.url(parsed.publicId, {
    resource_type: "video",
    type: "authenticated",
    sign_url: true,
    secure: true,
    ...(parsed.format ? { format: parsed.format } : {}),
    ...(parsed.version ? { version: parsed.version } : {}),
  });
  return { url, signed: true };
}

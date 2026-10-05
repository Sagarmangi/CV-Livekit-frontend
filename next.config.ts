import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The widget page exists to be framed by other people's sites, so it
        // alone opts out of the same-origin framing default. Scoped to this
        // path: nothing else in the dashboard may be embedded. Enforcement of
        // *which* sites is done per agent by the session API's origin
        // allowlist -- a CSP can't know the key, and an un-allowlisted embed
        // just gets a widget that refuses to start a call.
        source: "/widget/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        // public/ files are served with max-age=0 by default. The loader is
        // referenced from customers' pages, so an hour of caching keeps every
        // page view on their site from round-tripping here, while still
        // picking up a new version the same day it ships.
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
  experimental: {
    /**
     * How long the client router may reuse a segment it already has before
     * going back to the server for it.
     *
     * `dynamic` defaults to 0, meaning every page here is refetched on every
     * single visit -- and every page here is dynamic, because they all read
     * cookies and query Supabase. With Supabase roughly 400ms away per round
     * trip, that made bouncing between two sections cost a fresh render each
     * way even when nothing had changed.
     *
     * 30s is safe for this app specifically: every mutation goes through a
     * server action that calls `revalidatePath` (see the actions.ts files),
     * which drops the client cache for that path, so an edit is never hidden
     * behind this window. It only ever serves up-to-30s-old data for a screen
     * someone else changed in the meantime -- and a reload always refetches.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    /**
     * These pull in large dependency trees (the Twilio REST client, the
     * LiveKit server SDK and protocol package) that only ever run on the
     * server. Bundling them per-route is a large part of the cold compile on
     * /numbers and the agent pages; `optimizePackageImports` keeps them out of
     * that work and requires them at runtime instead.
     */
    optimizePackageImports: ["@livekit/components-react"],
  },
  serverExternalPackages: ["twilio", "livekit-server-sdk", "@livekit/protocol"],
};

export default nextConfig;

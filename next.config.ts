import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

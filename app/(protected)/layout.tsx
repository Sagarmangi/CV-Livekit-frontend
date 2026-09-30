import { Suspense } from "react";
import { cookies } from "next/headers";

import { requireAllowedUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { IntegrationAlertBanner } from "@/components/integration-alert-banner";
import { NAV_COLLAPSED_COOKIE } from "@/lib/nav-preference";

/**
 * Every real dashboard route lives under this route group. This is where the
 * actual "is this person allowed in" check happens -- see requireAllowedUser
 * for why that's here and not in proxy.ts.
 *
 * The shell is a two-rail layout: the primary nav down the left edge, then a
 * content column. Sections that need to pick something from a list before
 * showing anything -- /agents -- add their own second rail inside that column
 * (see agents/layout.tsx and components/section-sidebar.tsx).
 *
 * Scrolling stays on the window rather than an inner container, so both rails
 * can be `sticky top-0 h-dvh` and stay exactly viewport-height without anyone
 * hardcoding a header offset.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([
    requireAllowedUser(),
    cookies(),
  ]);

  // Read here rather than in the rail itself so the very first paint is already
  // the right width -- the rail is a client component, but this is not state it
  // can know before hydration.
  const navCollapsed = cookieStore.get(NAV_COLLAPSED_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-dvh">
      <AppSidebar userEmail={user.email} defaultCollapsed={navCollapsed} />
      {/* `pt-14` clears the phone-only fixed top bar the rail renders below
          `sm`; from `sm` up the rail is an in-flow column and there's nothing
          overlapping to clear. */}
      <div className="flex min-w-0 flex-1 flex-col pt-14 sm:pt-0">
        {/* Streamed, never awaited. The banner live-pings Twilio, LiveKit,
            Deepgram, Groq, DeepSeek and Gemini -- measured at 1.2s warm and
            2.6s cold, which is otherwise 1.2s+ added to the first paint of
            every page in the dashboard. It renders nothing at all in the
            common case (no broken integration), so there is no fallback and
            nothing shifts when it resolves. */}
        <Suspense fallback={null}>
          <IntegrationAlertBanner />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

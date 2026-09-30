import type { ReactNode } from "react";

/**
 * The second rail: a contextual list column that sits between the primary nav
 * (components/app-sidebar.tsx) and the page content -- pick an agent here and
 * its config loads to the right without losing your place in the list.
 *
 * Purely presentational so it can be shared by a server-rendered route sidebar
 * and a client component that owns search state.
 *
 * Full-height and sticky from `lg` up; below that it stacks above the content
 * as a short scrollable strip, since two side-by-side rails don't fit a phone.
 */
export function SectionSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-canvas lg:sticky lg:top-[var(--content-top,0px)] lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r">
      {children}
    </aside>
  );
}

/** Fixed-height top block of a section sidebar: what the list is, how many, and
 * the one action that adds to it. Matches the primary rail's own header height
 * so the two line up across the divider. */
export function SectionSidebarHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-divider px-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-strong">
        {title}
        {count !== undefined && (
          <span className="rounded-pill bg-canvas-alt px-1.5 py-0.5 font-mono text-[0.6875rem] text-faint tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

/** Scrollable list region below the header. */
export function SectionSidebarBody({ children }: { children: ReactNode }) {
  return (
    // Capped short on a phone -- this rail stacks above the content there, so a
    // tall list would push the thing you actually opened off the screen.
    <div className="max-h-56 min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:max-h-72 lg:max-h-none">
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandMark, BrandWordmark } from "@/components/brand-mark";
import { ProfileMenu } from "@/components/profile-menu";
import { NAV_COLLAPSED_COOKIE } from "@/lib/nav-preference";

/**
 * The dashboard's primary navigation: a rail down the left edge, grouped by
 * what you're doing rather than one flat list -- building an agent, watching
 * what it did, wiring up the services behind it.
 *
 * Collapses to an icon rail and back. The choice is stored in a cookie rather
 * than localStorage so the server renders the correct width on the first pass:
 * localStorage can only be read after hydration, which means one frame at the
 * wrong width on every single navigation.
 *
 * Sticky at full viewport height rather than `fixed`, so the content column
 * needs no matching margin and nothing has to know how wide this is.
 */

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { heading: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    heading: "Build",
    items: [
      { href: "/agents", label: "Agents", icon: <AgentIcon /> },
      { href: "/tools", label: "Tools", icon: <ToolIcon /> },
      { href: "/numbers", label: "Phone numbers", icon: <PhoneIcon /> },
    ],
  },
  {
    heading: "Observe",
    items: [{ href: "/calls", label: "Call logs", icon: <LogsIcon /> }],
  },
  {
    heading: "Platform",
    items: [
      { href: "/integrations", label: "Integrations", icon: <PlugIcon /> },
    ],
  },
];

const MOTION = "transition-all duration-200 ease-out";

/** Widths of the rail in its three states, kept together so the drawer and the
 * desktop rail can't drift apart. */
const RAIL_WIDTH = {
  drawer: "max-sm:w-64",
  collapsed: "sm:w-16",
  expanded: "sm:w-16 lg:w-60",
};

/**
 * Collapsing animates rather than snaps: the rail's width, and every label's
 * width/opacity, run on the same 200ms curve.
 *
 * Labels stay mounted and collapse to `max-w-0` instead of unmounting --
 * `hidden` can't be transitioned, so removing them is what makes a collapse
 * look like a glitch. Clipping happens on each label (`overflow-hidden`), never
 * on the rail itself, since the rail has to let the account menu overflow it.
 *
 * Below `lg` the rail is always icons: two full-width rails don't fit a phone,
 * and there's no toggle offered at that size, so those labels are plainly
 * hidden with no animation to worry about.
 */
function labelClass(collapsed: boolean, forceShow: boolean) {
  // The mobile drawer is 16rem wide, so labels always show there. `forceShow` is
  // only ever true below `sm` -- the drawer can't be opened at any larger size --
  // which is why this can drop the `max-lg:hidden` guard outright.
  if (forceShow) {
    return `${MOTION} ml-2.5 max-w-40 overflow-hidden whitespace-nowrap opacity-100`;
  }
  return [
    MOTION,
    "overflow-hidden whitespace-nowrap max-lg:hidden",
    collapsed ? "max-w-0 opacity-0" : "ml-2.5 max-w-40 opacity-100",
  ].join(" ");
}

export function AppSidebar({
  userEmail,
  defaultCollapsed,
}: {
  userEmail: string;
  defaultCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Below `sm` the rail slides in over the content instead of holding a column
  // of its own -- 4rem of permanent chrome is a fifth of a phone's width.
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // One year, path=/ so it applies to every route. Written from here rather
    // than through a server action: nothing on the server needs to react to it
    // beyond reading it on the next render.
    document.cookie = `${NAV_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <>
      {/* Phone-only top bar: the way into the drawer, and the only nav chrome
          that stays on screen at that size. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas-alt px-4 sm:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-strong"
        >
          <MenuIcon />
        </button>
        <Link href="/agents" className="flex items-center">
          <BrandWordmark height={30} />
        </Link>
      </header>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm sm:hidden"
        />
      )}

      <aside
        className={[
          MOTION,
          "z-50 flex flex-col border-r border-line bg-canvas-alt",
          // Off-canvas drawer below `sm`, in-flow sticky column above it.
          "max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:shadow-lg",
          RAIL_WIDTH.drawer,
          drawerOpen ? "max-sm:translate-x-0" : "max-sm:-translate-x-full",
          "sm:sticky sm:top-0 sm:h-dvh sm:shrink-0 sm:translate-x-0",
          collapsed ? RAIL_WIDTH.collapsed : RAIL_WIDTH.expanded,
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-divider px-3">
          <Link
            href="/agents"
            title="Kodexo Labs — voice agent platform"
            onClick={() => setDrawerOpen(false)}
            className="flex min-w-0 flex-1 items-center"
          >
            {/* Swapped rather than animated like the nav labels below: the
                wordmark is ~3:1, so it can't shrink into a 4rem rail legibly --
                the square mark is what that width is sized for.

                Three states, not two, because "expanded" isn't one width:
                RAIL_WIDTH.expanded is `sm:w-16 lg:w-60`, so between those
                breakpoints the rail is 4rem wide with `collapsed` still false.
                The breakpoint half has to be CSS, since state can't see it. */}
            {drawerOpen ? (
              // The phone drawer is 16rem, so the wordmark fits there.
              <BrandWordmark height={40} />
            ) : collapsed ? (
              <BrandMark size={32} />
            ) : (
              <>
                <span className="lg:hidden">
                  <BrandMark size={32} />
                </span>
                <span className="hidden lg:block">
                  <BrandWordmark height={40} />
                </span>
              </>
            )}
          </Link>
        </div>

        {/* Sits on the rail's own border, half in and half out. Keeps one fixed,
            always-visible affordance in both states -- putting it inside the
            header would either fight the logo for 4rem of width when collapsed,
            or have to disappear exactly when it's needed most. Only offered from
            `lg` up, where an expanded rail fits at all. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="absolute top-20 -right-3 z-40 hidden h-6 w-6 items-center justify-center rounded-pill border border-line bg-surface text-faint shadow-sm transition-colors hover:text-brand lg:flex"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-4 lg:px-3">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <p
                className={[
                  MOTION,
                  "mono-kicker overflow-hidden px-2",
                  drawerOpen ? "mb-1.5 h-4 opacity-100" : "max-lg:hidden",
                  !drawerOpen && (collapsed ? "mb-0 h-0 opacity-0" : "mb-1.5 h-4 opacity-100"),
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  // Detail pages live under /agents/<id>, /calls/<id> and so on,
                  // so the parent stays highlighted by prefix.
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={item.label}
                        onClick={() => setDrawerOpen(false)}
                        className={[
                          MOTION,
                          "flex items-center rounded-md py-2 text-sm",
                          drawerOpen
                            ? "px-2.5"
                            : collapsed
                              ? "justify-center px-0 max-lg:justify-center"
                              : "px-2.5 max-lg:justify-center",
                          active
                            ? "bg-brand-tint font-semibold text-brand-deep dark:text-brand"
                            : "font-medium text-muted hover:bg-surface hover:text-strong",
                        ].join(" ")}
                      >
                        {item.icon}
                        <span className={labelClass(collapsed, drawerOpen)}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-divider p-2">
          <ProfileMenu userEmail={userEmail} collapsed={collapsed && !drawerOpen} />
        </div>
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons -- 16px line icons, sized and stroked to match each other            */
/* -------------------------------------------------------------------------- */

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-4 w-4 shrink-0",
  "aria-hidden": true,
};

function AgentIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 14h.01M15 14h.01M2 13v3M22 13v3" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a4 4 0 0 0 5 5L21 21l-4-4-6.3-6.3a4 4 0 0 1-5-5L3 3l4 4Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4.5 3h3l2 5-2.5 1.5a12 12 0 0 0 7.5 7.5L16 14.5l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 2.5 5.2 2 2 0 0 1 4.5 3Z" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 12h3l2-5 3 10 2.5-6 2 4h4.5" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5 shrink-0">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {collapsed ? <path d="m13 10 3 2-3 2" /> : <path d="m16 10-3 2 3 2" />}
    </svg>
  );
}

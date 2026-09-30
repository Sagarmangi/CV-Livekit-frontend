"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { signOut } from "@/components/nav-actions";
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  type ThemeChoice,
} from "@/lib/theme";

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System", icon: <MonitorIcon /> },
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

/**
 * The account menu at the foot of the primary rail: who's signed in,
 * appearance, and sign out.
 *
 * Theme lives here rather than as a standalone nav button because it's a
 * per-person preference stored in that person's browser, not app state -- it
 * belongs with the other things about them.
 *
 * Opens upward (`bottom-full`) since it's pinned to the bottom of the viewport
 * -- downward would put every item below the fold.
 */
export function ProfileMenu({
  userEmail,
  collapsed,
}: {
  userEmail: string;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Starts at the server-safe default and is refreshed from localStorage when
  // the menu opens. Reading storage during render instead would mean the server
  // and the browser disagree about which option is checked -- and since the menu
  // is closed at hydration, nobody can see a stale value anyway. The theme
  // itself is already correct by this point: the script in the root layout
  // applied it before first paint.
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const containerRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback(() => {
    setChoice(readStoredTheme());
    setOpen(true);
  }, []);

  // "System" has to keep tracking the OS after the page has loaded -- someone
  // flipping their machine to dark at sunset shouldn't have to reload.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Click-outside and Escape, only while the menu is actually open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickTheme(next: ThemeChoice) {
    setChoice(next);
    storeTheme(next);
    applyTheme(next);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        title={userEmail}
        className={
          collapsed
            ? "flex w-full items-center justify-center rounded-md p-1.5 transition-colors hover:bg-surface"
            : "flex w-full items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-surface"
        }
      >
        <Avatar email={userEmail} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-sm text-muted">
              {userEmail}
            </span>
            <ChevronIcon open={open} />
          </>
        )}
      </button>

      {open && (
        // Anchored to the trigger's left edge and clamped to the viewport, so a
        // long address can't push it off either side -- including when the rail
        // is collapsed to 4rem.
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-divider px-4 py-3">
            <Avatar email={userEmail} />
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-strong">
                {userEmail.split("@")[0]}
              </p>
              <p className="truncate text-xs text-faint">{userEmail}</p>
            </div>
          </div>

          <fieldset className="border-b border-divider px-4 py-3">
            <legend className="mono-kicker mb-2">Appearance</legend>
            <div className="flex gap-1 rounded-md bg-canvas-alt p-1">
              {THEME_OPTIONS.map((option) => {
                const active = option.value === choice;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => pickTheme(option.value)}
                    className={
                      active
                        ? "flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-brand px-2 py-1.5 text-xs font-semibold text-on-brand shadow-sm"
                        : "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-strong"
                    }
                  >
                    {option.icon}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-muted transition-colors hover:bg-canvas-alt hover:text-brand"
            >
              <SignOutIcon />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Brand-red initial disc -- the one place the mark's colour shows in the rail
 * besides the wordmark, so the two read as a pair. */
function Avatar({ email }: { email: string }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-brand text-xs font-bold text-on-brand uppercase"
    >
      {email.slice(0, 1)}
    </span>
  );
}

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-3.5 w-3.5 shrink-0",
  "aria-hidden": true,
};

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg {...ICON_PROPS} className="h-4 w-4 shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      {...ICON_PROPS}
      className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

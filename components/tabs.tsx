"use client";

import { useState, type ReactNode } from "react";

export type TabDef = {
  key: string;
  label: string;
  content: ReactNode;
};

/**
 * Tab panels stay mounted (just visually hidden via `hidden`) rather than
 * unmounting on switch -- so typing into one section's form, then checking
 * another tab, doesn't lose anything that hasn't been saved yet.
 */
export function Tabs({
  tabs,
  defaultTab,
  stickyTop,
}: {
  tabs: TabDef[];
  /** Which tab starts selected. Falls back to the first tab if it doesn't match any key. */
  defaultTab?: string;
  /** Raw CSS `top` value/expression to stick the tab bar under something above it (e.g. a page header stacked via StickyBand). Omit for normal (non-sticky) flow. */
  stickyTop?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((tab) => tab.key === defaultTab) ? defaultTab : tabs[0]?.key,
  );

  return (
    <div>
      <div
        role="tablist"
        className="no-scrollbar z-10 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line bg-canvas"
        style={stickyTop ? { position: "sticky", top: stickyTop } : undefined}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={
                selected
                  ? "-mb-px shrink-0 border-b-2 border-brand py-3 text-sm font-semibold text-strong"
                  : "-mb-px shrink-0 border-b-2 border-transparent py-3 text-sm font-medium text-muted transition-colors hover:border-line hover:text-strong"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        {tabs.map((tab) => (
          <div key={tab.key} hidden={tab.key !== active} className="space-y-6">
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

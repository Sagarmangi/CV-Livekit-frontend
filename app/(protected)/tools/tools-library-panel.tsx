"use client";

import { useState } from "react";

import { toggleTool } from "@/app/(protected)/tools/actions";
import { ToolForm } from "@/app/(protected)/tools/tool-form";
import { ActionButton } from "@/components/form";
import { Button, ToolTypeGlyph } from "@/components/ui";
import { toolTypeMeta } from "@/lib/tool-display";
import type { Tool } from "@/lib/types";

/** Vapi/Retell-style tools screen: every tool in the shared library in a list
 * rail on the left, the selected one's full settings to the right. Agents pick
 * which of these they use from their own Tools tab -- this page only manages
 * the definitions themselves.
 *
 * Styled to match the route-level rails (components/section-sidebar.tsx) so the
 * app reads as one layout, but it isn't one: which tool is selected is local
 * state, not a URL, so this stays a client component inside the page. */
export function ToolsLibraryPanel({ tools }: { tools: Tool[] }) {
  const [selectedId, setSelectedId] = useState<string>(tools[0]?.tool_id ?? "new");
  const selectedTool = tools.find((t) => t.tool_id === selectedId);

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="w-full shrink-0 space-y-3 border-b border-line p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => setSelectedId("new")}
        >
          + Create tool
        </Button>

        <div className="space-y-1">
          {tools.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-faint">
              No tools yet.
            </p>
          )}
          {tools.map((tool) => {
            const active = tool.tool_id === selectedId;
            const { icon, tone, badge } = toolTypeMeta(tool);
            return (
              // The row is a div, not a button: the toggle is interactive and
              // nesting a button inside a button is invalid markup that browsers
              // resolve however they like.
              <div
                key={tool.tool_id}
                className={
                  active
                    ? "flex items-center gap-1 rounded-md border border-brand/40 bg-brand-tint pr-1.5"
                    : "flex items-center gap-1 rounded-md border border-transparent pr-1.5 transition-colors hover:bg-canvas-alt"
                }
              >
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelectedId(tool.tool_id)}
                  // Dimmed as a whole when off, so "this tool isn't running"
                  // reads at a glance from the list rather than only from the
                  // button's label -- a tool switched off unnoticed for a week
                  // is the failure mode worth designing against.
                  className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left ${
                    tool.is_enabled ? "" : "opacity-45"
                  }`}
                >
                  <ToolTypeGlyph icon={icon} tone={tone} />
                  <span className="min-w-0">
                    <span
                      className={
                        active
                          ? "block truncate font-mono text-sm font-semibold text-brand-deep dark:text-brand"
                          : "block truncate font-mono text-sm font-medium text-body"
                      }
                    >
                      {tool.name}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {tool.is_enabled ? badge : `off · ${badge}`}
                    </span>
                  </span>
                </button>

                <ActionButton
                  action={toggleTool}
                  label={tool.is_enabled ? "On" : "Off"}
                  pendingLabel="…"
                  size="sm"
                  variant={tool.is_enabled ? "secondary" : "ghost"}
                  confirm={
                    tool.is_enabled
                      ? `Switch "${tool.name}" off? It stops working for every agent that has it selected, until you switch it back on.`
                      : undefined
                  }
                  // The desired state, not a flip -- see toggleTool.
                  hidden={{
                    tool_id: tool.tool_id,
                    is_enabled: tool.is_enabled ? "false" : "true",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <ToolForm key={selectedId} tool={selectedTool} />
      </div>
    </div>
  );
}

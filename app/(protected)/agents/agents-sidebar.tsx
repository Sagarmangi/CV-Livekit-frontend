"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  SectionSidebar,
  SectionSidebarBody,
  SectionSidebarHeader,
} from "@/components/section-sidebar";
import { AgentStatusDot, ButtonLink, Input } from "@/components/ui";
import type { AgentListItem } from "@/lib/queries";

/**
 * Always-visible agent picker, like Vapi's assistants list -- pick one here,
 * its config loads on the right without losing your place in the list.
 */
export function AgentsSidebar({ agents }: { agents: AgentListItem[] }) {
  const pathname = usePathname();
  const currentAgentId = pathname.match(/^\/agents\/([^/]+)/)?.[1];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(term));
  }, [agents, search]);

  return (
    <SectionSidebar>
      <SectionSidebarHeader
        title="Agents"
        count={agents.length}
        action={
          <ButtonLink href="/agents/new" variant="primary" size="sm">
            + New
          </ButtonLink>
        }
      />
      <SectionSidebarBody>
        <Input
          type="search"
          placeholder="Search agents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search agents"
        />

        <nav className="space-y-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-faint">
              No agents match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            filtered.map((agent) => {
              const active = agent.agent_id === currentAgentId;
              return (
                <Link
                  key={agent.agent_id}
                  href={`/agents/${agent.agent_id}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "block rounded-md border border-brand/40 bg-brand-tint px-3 py-2"
                      : "block rounded-md border border-transparent px-3 py-2 transition-colors hover:bg-surface"
                  }
                >
                  <div className="flex items-center gap-2">
                    <AgentStatusDot status={agent.status} />
                    <span
                      className={
                        active
                          ? "truncate text-sm font-semibold text-brand-deep dark:text-brand"
                          : "truncate text-sm font-medium text-body"
                      }
                    >
                      {agent.name}
                    </span>
                  </div>
                  {/* Derived from llm_provider, NOT from the agent's own
                      stt_provider/tts_provider columns. Those are leftovers the
                      worker never reads -- rows created before the move to
                      Deepgram still say "cartesia", so printing them here
                      reported a vendor that isn't in the call path. */}
                  <div className="mt-0.5 truncate pl-3.5 font-mono text-[0.6875rem] text-faint">
                    {agent.llm_provider === "gemini_live"
                      ? "gemini live · built-in voice"
                      : `${agent.llm_provider} · deepgram`}
                    {/* `gemini` and `gemini_live` read almost identically at
                        this size, so the pipeline one is spelled out by its
                        Deepgram half above rather than by the provider name. */}
                  </div>
                </Link>
              );
            })
          )}
        </nav>
      </SectionSidebarBody>
    </SectionSidebar>
  );
}

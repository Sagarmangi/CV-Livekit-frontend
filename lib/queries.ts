import "server-only";

import { db, expect } from "@/lib/supabase";
import type {
  Agent,
  CallLog,
  CallOutcome,
  ExternalNumber,
  Tool,
} from "@/lib/types";

/** An agent row plus the derived columns the list view shows. */
export type AgentListItem = Agent & {
  last_call_at: string | null;
  call_count: number;
};

export async function listAgents(): Promise<AgentListItem[]> {
  const agents = (await expect(
    db().from("agents").select("*").order("created_at", { ascending: true }),
    "listAgents",
  )) as unknown as Agent[];

  if (agents.length === 0) return [];

  // One extra query for call activity rather than N per-agent queries. Only the
  // timestamp is selected — transcripts are large and the list doesn't need them.
  const calls = (await expect(
    db()
      .from("call_logs")
      .select("agent_id, created_at")
      .order("created_at", { ascending: false }),
    "listAgents.calls",
  )) as unknown as { agent_id: string | null; created_at: string }[];

  const activity = new Map<string, { last: string; count: number }>();
  for (const call of calls) {
    if (!call.agent_id) continue;
    const existing = activity.get(call.agent_id);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows arrive newest-first, so the first one seen is the latest call.
      activity.set(call.agent_id, { last: call.created_at, count: 1 });
    }
  }

  return agents.map((agent) => ({
    ...agent,
    last_call_at: activity.get(agent.agent_id)?.last ?? null,
    call_count: activity.get(agent.agent_id)?.count ?? 0,
  }));
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { data, error } = await db()
    .from("agents")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(`getAgent: ${error.message}`);
  return (data as unknown as Agent) ?? null;
}

/** The whole tools library -- shared across every agent (see 0014_global_tools.sql). */
export async function listAllTools(): Promise<Tool[]> {
  return (await expect(
    db().from("tools").select("*").order("name", { ascending: true }),
    "listAllTools",
  )) as unknown as Tool[];
}

/** Which of the global tools this agent currently has selected. */
export async function listAgentTools(agentId: string): Promise<Tool[]> {
  const rows = (await expect(
    db().from("agent_tools").select("tools(*)").eq("agent_id", agentId),
    "listAgentTools",
  )) as unknown as { tools: Tool | null }[];
  return rows.map((r) => r.tools).filter((t): t is Tool => t !== null);
}

export type CallLogFilters = {
  agentId?: string;
  outcome?: CallOutcome;
  /** Inclusive ISO date (YYYY-MM-DD). */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to?: string;
};

/** Call log list rows omit the long-form fields — transcript, the per-line cost
 * breakdown, and the analysis prose. All are fetched only on the detail view,
 * where there's room to show them. */
export type CallLogListItem = Omit<
  CallLog,
  | "transcript"
  | "cost_breakdown"
  | "call_summary"
  | "user_queries"
  | "caller_name"
  | "analysis_model"
>;

/** One page of call logs, plus how many rows match the filters in total. */
export type CallLogPage = {
  rows: CallLogListItem[];
  /** Across all pages, for the same filters — what the pager counts against. */
  total: number;
};

/**
 * A single page of call logs, newest first.
 *
 * `count: "exact"` rides along on the same request rather than costing a
 * second round trip for the total. It's a real `COUNT(*)` over the matching
 * rows, which is the right trade here: the filters are all indexed columns and
 * this table grows by one row per phone call, not per event. If it ever gets
 * big enough for that count to hurt, `"planned"` gives a query-planner
 * estimate for the same shape of result.
 */
export async function listCallLogs(
  filters: CallLogFilters,
  { limit, offset }: { limit: number; offset: number },
): Promise<CallLogPage> {
  let query = db()
    .from("call_logs")
    .select(
      "call_log_id, call_sid, room_id, agent_id, caller_number, recording_url, " +
        "duration_seconds, outcome, matched_department, spam_detection, lead_name, " +
        "lead_company, lead_need, is_test, created_at, " +
        // The four component costs but not cost_breakdown: the list shows a
        // single figure, and the per-line audit trail is only ever read on the
        // detail page. Same reasoning as leaving transcript out.
        "cost_stt_usd, cost_llm_usd, cost_tts_usd, cost_telephony_usd, cost_total_usd, " +
        // Analysis fields the list actually shows or filters on. call_summary
        // and user_queries are left out for the same reason as transcript --
        // free-form text nobody reads at 50 rows a page.
        "called_number, call_status, transfer_attempted, callback_needed, " +
        "has_error, error_message, priority",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  // `to` is an inclusive day, so compare against the end of that day.
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) throw new Error(`listCallLogs: ${error.message}`);

  return {
    rows: (data ?? []) as unknown as CallLogListItem[],
    total: count ?? 0,
  };
}

export async function getCallLog(callLogId: string): Promise<CallLog | null> {
  const { data, error } = await db()
    .from("call_logs")
    .select("*")
    .eq("call_log_id", callLogId)
    .maybeSingle();
  if (error) throw new Error(`getCallLog: ${error.message}`);
  return (data as unknown as CallLog) ?? null;
}

/**
 * Which agent, if any, owns each E.164 number. This is the Supabase-side
 * routing table the Project Plan v2 describes: a call's owner is resolved by
 * looking up the dialed number here, not by per-number Twilio configuration.
 */
export async function numberAssignments(): Promise<
  Map<string, Pick<Agent, "agent_id" | "name" | "status">>
> {
  const rows = (await expect(
    db()
      .from("agents")
      .select("agent_id, name, status, twilio_number")
      .not("twilio_number", "is", null),
    "numberAssignments",
  )) as unknown as (Pick<Agent, "agent_id" | "name" | "status"> & {
    twilio_number: string;
  })[];

  return new Map(
    rows.map(({ twilio_number, ...agent }) => [twilio_number, agent]),
  );
}

/** Numbers connected from customers' own Twilio accounts -- see 0010_external_numbers.sql. */
export async function listExternalNumbers(): Promise<ExternalNumber[]> {
  return (await expect(
    db()
      .from("external_numbers")
      .select("*")
      .order("created_at", { ascending: true }),
    "listExternalNumbers",
  )) as unknown as ExternalNumber[];
}

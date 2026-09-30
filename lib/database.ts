/**
 * The `Database` generic for `createClient`.
 *
 * Without this, `supabase-js` widens every insert/update payload to `never` and
 * writes stop typechecking. Kept alongside the row types in `lib/types.ts`:
 * that file is the shape the app reads, this one is the shape Supabase writes.
 */

import type {
  Agent,
  AgentToolLink,
  AllowedUser,
  CallLog,
  ExternalNumber,
  Tool,
} from "@/lib/types";

/** Columns the database fills in itself and callers never send. */
type Generated = "created_at" | "updated_at";

type Insert<Row, Key extends keyof Row> = Omit<Row, Key | Generated> &
  Partial<Pick<Row, Extract<Key, keyof Row>>>;

type TableDef<Row, Key extends keyof Row> = {
  Row: Row;
  Insert: Partial<Insert<Row, Key>>;
  Update: Partial<Omit<Row, Generated>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      agents: TableDef<Agent, "agent_id">;
      tools: TableDef<Tool, "tool_id">;
      agent_tools: TableDef<AgentToolLink, never>;
      call_logs: TableDef<CallLog, "call_log_id">;
      allowed_users: TableDef<AllowedUser, "email">;
      external_numbers: TableDef<ExternalNumber, "external_number_id">;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      agent_status: Agent["status"];
      call_outcome: NonNullable<CallLog["outcome"]>;
    };
    CompositeTypes: Record<never, never>;
  };
};

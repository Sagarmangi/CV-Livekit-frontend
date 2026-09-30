"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Dropdown } from "@/components/dropdown";
import { Button, Field, Input } from "@/components/ui";
import { CALL_OUTCOMES } from "@/lib/types";

/**
 * Filters drive the query string, which the page reads server-side — so a
 * filtered view is a shareable URL, and the back button works.
 */
export function CallFilters({
  agents,
}: {
  agents: { agent_id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(form: FormData) {
    const next = new URLSearchParams();
    for (const key of ["agent", "outcome", "from", "to"]) {
      const value = form.get(key);
      if (typeof value === "string" && value !== "") next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `/calls?${query}` : "/calls");
  }

  return (
    <form action={apply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Agent" htmlFor="filter-agent">
        <Dropdown
          id="filter-agent"
          name="agent"
          defaultValue={params.get("agent") ?? ""}
          options={[
            { value: "", label: "All agents" },
            ...agents.map((agent) => ({
              value: agent.agent_id,
              label: agent.name,
            })),
          ]}
        />
      </Field>

      <Field label="Outcome" htmlFor="filter-outcome">
        <Dropdown
          id="filter-outcome"
          name="outcome"
          defaultValue={params.get("outcome") ?? ""}
          options={[
            { value: "", label: "All outcomes" },
            ...CALL_OUTCOMES.map((outcome) => ({
              value: outcome,
              label: outcome.replace(/_/g, " "),
            })),
          ]}
        />
      </Field>

      <Field label="From" htmlFor="filter-from">
        <Input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={params.get("from") ?? ""}
        />
      </Field>

      <Field label="To" htmlFor="filter-to">
        <Input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={params.get("to") ?? ""}
        />
      </Field>

      <div className="flex items-end gap-2">
        <Button type="submit" variant="primary">
          Filter
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/calls")}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}

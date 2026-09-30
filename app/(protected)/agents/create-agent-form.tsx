"use client";

import { createAgent } from "@/app/(protected)/agents/actions";
import { ActionForm } from "@/components/form";
import { Field, Input, Textarea } from "@/components/ui";

export function CreateAgentForm() {
  return (
    <ActionForm action={createAgent} submitLabel="Create agent" pendingLabel="Creating…">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Persona name"
          htmlFor="new-agent-name"
          hint="Internal label, and the name the agent introduces itself with."
        >
          <Input
            id="new-agent-name"
            name="name"
            required
            placeholder="Kodexo inbound receptionist"
          />
        </Field>
      </div>
      <Field
        label="System prompt"
        htmlFor="new-agent-prompt"
        hint="Optional now — you can write it on the next screen."
      >
        <Textarea id="new-agent-prompt" name="prompt" rows={4} />
      </Field>
    </ActionForm>
  );
}

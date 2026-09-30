"use client";

import { useActionState, useId, useState } from "react";

import { updateAgentIdentity } from "@/app/(protected)/agents/actions";
import { ActionMessage, SubmitButton, useFlashStatus } from "@/components/form";
import { Dropdown } from "@/components/dropdown";
import { Input } from "@/components/ui";
import { IDLE } from "@/lib/forms";
import { AGENT_STATUSES, type Agent, type AgentStatus } from "@/lib/types";

/** The status control carries its own state as colour -- live agents read green
 * at a glance, paused ones amber, drafts stay quiet. */
const AGENT_STATUS_TONES: Record<AgentStatus, "green" | "amber" | "neutral"> = {
  active: "green",
  paused: "amber",
  draft: "neutral",
};

const AGENT_STATUS_TOOLTIPS: Record<AgentStatus, string> = {
  draft: "Not live. Safe to leave incomplete -- won't answer calls even if a number is assigned.",
  paused: "Temporarily off. Callers to an assigned number hear the number's fallback instead of this agent.",
  active: "Live. Answers real calls on any number assigned to this agent. Requires a system prompt.",
};

/**
 * Quick persona-name/status editor, lifted out of the Prompt & qualification
 * tab into the sticky header so renaming or (de)activating an agent doesn't
 * need a scroll + tab switch. CoreConfigForm still carries these two as
 * hidden fields (unchanged) so its own full-form save doesn't clobber
 * whatever's set here, and vice versa.
 */
export function AgentIdentityForm({ agent }: { agent: Agent }) {
  const [state, formAction, pending] = useActionState(updateAgentIdentity, IDLE);
  const flash = useFlashStatus(state);
  const formId = useId();
  const [status, setStatus] = useState<AgentStatus>(agent.status);

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
      {/* Wraps, and the name field takes the slack -- three controls in a row
          is wider than a phone. */}
      <form
        id={formId}
        action={formAction}
        className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
      >
        <input type="hidden" name="agent_id" value={agent.agent_id} />
        <Input
          name="name"
          defaultValue={agent.name}
          required
          aria-label="Persona name"
          placeholder="Persona name"
          className="min-w-0 flex-1 sm:w-40 sm:flex-none"
        />
        <Dropdown
          name="status"
          value={status}
          onValueChange={(next) => setStatus(next as AgentStatus)}
          ariaLabel="Status"
          tone={AGENT_STATUS_TONES[status]}
          className="w-36"
          menuClassName="w-72"
          align="end"
          options={AGENT_STATUSES.map((option) => ({
            value: option,
            label: option,
            description: AGENT_STATUS_TOOLTIPS[option],
          }))}
        />
        {/* "Save name" rather than "Save": this form posts only name and status,
            but it is the most prominent button on the page, so a bare "Save"
            reads as saving whatever tab you were just editing. It doesn't -- each
            tab has its own Save -- and the failure is silent and convincing: this
            one reports success while the voice or prompt you just changed is
            quietly discarded. Cost real debugging time before it was spotted. */}
        <SubmitButton
          formId={formId}
          variant="secondary"
          idleLabel="Save name"
          pendingLabel="Saving…"
          pending={pending}
          flash={flash}
        />
      </form>
      {/* Success now shows on the button itself; this stays only for error,
          since the reason (e.g. the missing-API-key message) needs more room
          than the button has -- constrained so it wraps near the button
          instead of stretching the full width of the header. */}
      {flash === "error" && (
        <div className="w-full sm:max-w-[16rem] sm:text-right">
          <ActionMessage state={state} />
        </div>
      )}
    </div>
  );
}

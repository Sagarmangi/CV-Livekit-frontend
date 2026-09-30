"use client";

import { useActionState } from "react";

import { connectNumber } from "@/app/(protected)/numbers/actions";
import { Dropdown } from "@/components/dropdown";
import { ActionMessage } from "@/components/form";
import { Button, Field, Input } from "@/components/ui";
import { IDLE } from "@/lib/forms";

export type AgentOption = { agent_id: string; name: string };

/**
 * Connects a number the customer already owns on their own Twilio account,
 * rather than buying one on the platform's account -- the Vapi-style "bring
 * your own Twilio" path.
 *
 * Nothing here is charged: the SID/token only authorize creating a trunk in
 * their account and moving their existing number onto it.
 */
export function ConnectNumber({ agents }: { agents: AgentOption[] }) {
  const [state, action, pending] = useActionState(connectNumber, IDLE);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Account SID"
        htmlFor="connect-account-sid"
        badge="required"
        hint='Starts with "AC" -- found on the Twilio Console dashboard.'
      >
        <Input
          id="connect-account-sid"
          name="account_sid"
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          required
        />
      </Field>
      <Field
        label="Auth Token"
        htmlFor="connect-auth-token"
        badge="required"
        hint="Also on the Console dashboard. Stored so this number can be disconnected later -- never shown again after saving."
      >
        <Input
          id="connect-auth-token"
          name="auth_token"
          type="password"
          autoComplete="off"
          required
        />
      </Field>
      <Field
        label="Phone number"
        htmlFor="connect-phone-number"
        badge="required"
        hint="Must already exist on that Twilio account, in E.164 form."
      >
        <Input
          id="connect-phone-number"
          name="phone_number"
          placeholder="+15105550100"
          required
        />
      </Field>
      <Field label="Label" htmlFor="connect-friendly-name" badge="optional">
        <Input id="connect-friendly-name" name="friendly_name" placeholder="Acme support line" />
      </Field>
      <Field label="Assign to" htmlFor="connect-agent-id" badge="optional">
        <Dropdown
          id="connect-agent-id"
          name="agent_id"
          defaultValue=""
          options={[
            { value: "", label: "Leave unassigned" },
            ...agents.map((agent) => ({
              value: agent.agent_id,
              label: agent.name,
            })),
          ]}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect number"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

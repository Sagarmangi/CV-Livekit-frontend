"use client";

import { updateIntegrationSecrets } from "@/app/(protected)/integrations/actions";
import { ActionForm } from "@/components/form";
import { Badge, Field, Input } from "@/components/ui";
import type { ManagedSecret, SecretStatus } from "@/lib/secrets";

const SOURCE_LABEL: Record<SecretStatus["source"], { text: string; tone: "green" | "neutral" | "amber" }> = {
  database: { text: "saved here", tone: "green" },
  environment: { text: "from .env", tone: "neutral" },
  unset: { text: "not set", tone: "amber" },
};

/**
 * One integration's credentials, with the password confirmation that has to
 * accompany any change.
 *
 * Existing secret values are never sent to the browser -- the server renders a
 * masked preview and nothing more, so a blank field here means "leave it as it
 * is" rather than "erase it".
 */
export function CredentialsForm({
  group,
  fields,
  statuses,
}: {
  group: string;
  fields: ManagedSecret[];
  statuses: Record<string, SecretStatus>;
}) {
  return (
    <ActionForm
      action={updateIntegrationSecrets}
      submitLabel="Save credentials"
      pendingLabel="Verifying…"
      confirm={`Change ${group} credentials? Calls in progress keep the old values until they finish, and the agent worker needs a restart to pick these up.`}
    >
      <input type="hidden" name="group" value={group} />

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const status = statuses[field.name];
          const source = SOURCE_LABEL[status?.source ?? "unset"];
          const inputId = `secret-${field.name}`;
          return (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={inputId}
              hint={field.hint}
            >
              <div className="flex items-center gap-2 pb-0.5">
                <Badge tone={source.tone}>{source.text}</Badge>
                {status?.preview && (
                  <span className="min-w-0 truncate font-mono text-xs text-faint">
                    {status.preview}
                  </span>
                )}
              </div>
              <Input
                id={inputId}
                name={field.name}
                type={field.kind === "secret" ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                // Non-secret values are prefilled, so they can be edited in
                // place -- and clearing one is a real instruction to drop the
                // override. Secrets start blank and blank means "unchanged".
                defaultValue={
                  field.kind === "plain" ? (status?.preview ?? "") : ""
                }
                placeholder={
                  field.kind === "secret"
                    ? status?.source === "unset"
                      ? (field.placeholder ?? "Paste the key")
                      : "Leave blank to keep the current value"
                    : field.placeholder
                }
              />
            </Field>
          );
        })}
      </div>

      <div className="border-t border-divider pt-5">
        <Field
          label="Your dashboard password"
          htmlFor={`confirm-${group}`}
          badge="required"
          hint="The same password you sign in with. Confirms it's you before credentials change."
        >
          <Input
            id={`confirm-${group}`}
            name="current_password"
            type="password"
            autoComplete="current-password"
            className="sm:max-w-xs"
          />
        </Field>
      </div>
    </ActionForm>
  );
}

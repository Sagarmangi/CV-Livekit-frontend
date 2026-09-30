"use server";

import { revalidatePath } from "next/cache";

import { requireAllowedUser, verifyPassword } from "@/lib/auth";
import { fail, guard, ok, str, type ActionState } from "@/lib/forms";
import { MANAGED_SECRETS, saveSecrets, type SecretChange } from "@/lib/secrets";

/**
 * Rewrites provider credentials from the Integrations page.
 *
 * Gated on the admin re-entering their own login password. A session cookie is
 * enough to browse the dashboard; it shouldn't be enough to silently repoint
 * the platform's Twilio account or swap an API key on a borrowed laptop.
 *
 * Blank fields are not "clear this" for secrets -- the form never shows an
 * existing secret, so a blank one only means "leave it alone". Non-secret
 * fields are prefilled with their current value, so blanking one of those is an
 * explicit instruction to drop the override.
 */
export async function updateIntegrationSecrets(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const user = await requireAllowedUser();

    const group = str(form, "group");
    const fields = MANAGED_SECRETS.filter((secret) => secret.group === group);
    if (fields.length === 0) return fail("Unknown integration group.");

    const password = str(form, "current_password");
    if (!password) {
      return fail("Enter your dashboard password to change credentials.");
    }

    const changes: SecretChange[] = [];
    for (const field of fields) {
      // `has` rather than a truthiness check: a field the form didn't render at
      // all must not be read as "cleared".
      if (!form.has(field.name)) continue;
      const raw = str(form, field.name);

      if (raw) {
        changes.push({ name: field.name, action: "set", value: raw });
        continue;
      }
      // Blank. Only meaningful for the prefilled, non-secret fields.
      if (field.kind === "plain") {
        changes.push({ name: field.name, action: "clear" });
      }
    }

    if (changes.length === 0) {
      return fail("Nothing to change — fill in at least one field.");
    }

    // Checked after the form is understood but before anything is written, and
    // deliberately with the same wording whatever the reason, so this can't be
    // used to probe which fields exist.
    if (!(await verifyPassword(user.email, password))) {
      return fail("That password doesn't match. Nothing was changed.");
    }

    const { error } = await saveSecrets(changes, user.email);
    if (error) return fail(`Could not save: ${error}`);

    // The health checks on this page read process.env, which saveSecrets has
    // just updated -- so a re-render immediately re-tests the new key.
    revalidatePath("/integrations");
    return ok(
      `Updated ${changes.length} value${changes.length === 1 ? "" : "s"}. The agent worker picks new keys up when it restarts.`,
    );
  });
}

/**
 * Shared form-state contract for Server Actions.
 *
 * Every mutating action returns an `ActionState` instead of throwing on bad
 * input, so the client can render the message inline via `useActionState`.
 * Thrown errors are reserved for genuine faults (network, misconfiguration).
 */

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const IDLE: ActionState = { status: "idle" };

export function ok(message?: string): ActionState {
  return { status: "success", message };
}

export function fail(message: string): ActionState {
  return { status: "error", message };
}

/**
 * Wraps an action body so an unexpected throw becomes an inline error.
 *
 * Generic over the state type so actions carrying extra payload (search
 * results, for instance) keep their shape on the success path.
 */
export async function guard<T extends ActionState>(
  fn: () => Promise<T>,
): Promise<T | ActionState> {
  try {
    return await fn();
  } catch (error) {
    // `redirect()` and `notFound()` signal control flow by throwing; those must
    // propagate to Next.js rather than being rendered as a form error.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    return fail(error instanceof Error ? error.message : "Unexpected error");
  }
}

/* -------------------------------------------------------------------------- */
/* FormData readers                                                           */
/* -------------------------------------------------------------------------- */

export function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === "" ? null : value;
}

export function bool(form: FormData, key: string): boolean {
  // Unchecked checkboxes are absent from FormData entirely.
  return form.get(key) !== null;
}

/** Returns `null` for blank input so an unset numeric setting stays unset. */
export function num(form: FormData, key: string): number | null {
  const value = str(form, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads the parallel arrays that a repeating field group submits.
 *
 * A form with several `<input name="department_name">` / `<input
 * name="transfer_number">` pairs arrives as two same-length lists; zipping them
 * back into rows keeps the editors free of client-side row-id bookkeeping.
 */
export function rows<K extends string>(
  form: FormData,
  keys: readonly K[],
): Record<K, string>[] {
  const columns = keys.map((key) =>
    form.getAll(key).map((v) => (typeof v === "string" ? v.trim() : "")),
  );
  const length = Math.max(0, ...columns.map((c) => c.length));

  const result: Record<K, string>[] = [];
  for (let i = 0; i < length; i++) {
    const row = {} as Record<K, string>;
    keys.forEach((key, col) => {
      row[key] = columns[col][i] ?? "";
    });
    result.push(row);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

/** Twilio and LiveKit both speak E.164, so reject anything else at the edge. */
export const E164 = /^\+[1-9]\d{6,14}$/;

export function isE164(value: string): boolean {
  return E164.test(value);
}

/**
 * Tool and criterion names are passed to DeepSeek's function-calling interface,
 * which requires identifier-safe names.
 */
export const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export function isIdentifier(value: string): boolean {
  return IDENTIFIER.test(value);
}

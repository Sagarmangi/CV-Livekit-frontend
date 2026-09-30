"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, type ButtonSize } from "@/components/ui";
import { IDLE, type ActionState } from "@/lib/forms";

type ServerAction = (
  prev: ActionState,
  form: FormData,
) => Promise<ActionState>;

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Shared gating logic behind the `confirm` prop on ActionForm/ActionButton.
 *
 * `window.confirm()` is synchronous, so the old code could block submission
 * inline inside `onSubmit`. A custom dialog can't do that -- showing it is
 * asynchronous -- so this always prevents the first submit when a message is
 * set, opens the dialog, and on "Confirm" replays the submit via
 * `requestSubmit()` with a one-shot bypass flag so it isn't prompted again.
 */
function useConfirmGate(confirm: string | undefined) {
  const formRef = useRef<HTMLFormElement>(null);
  const bypass = useRef(false);
  const [open, setOpen] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!confirm || bypass.current) {
      bypass.current = false;
      return;
    }
    event.preventDefault();
    setOpen(true);
  };

  const dialog = confirm ? (
    <ConfirmDialog
      open={open}
      message={confirm}
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false);
        bypass.current = true;
        formRef.current?.requestSubmit();
      }}
    />
  ) : null;

  return { formRef, onSubmit, dialog };
}

type FlashStatus = "idle" | "success" | "error";

/**
 * Turns a one-shot `ActionState` into a temporary "just happened" flash --
 * `state` gets a new object identity every time a submit settles (even a
 * repeat of the same status), so comparing it against the last seen value
 * catches every completion. Reverts to "idle" on its own so the button
 * doesn't stay stuck showing "Saved"/"Failed" forever.
 *
 * That comparison happens during render rather than in an effect -- an
 * effect running setState unconditionally on every settle would cost an
 * extra render pass for no reason. The effect below only owns the
 * revert-to-idle timer, which is a genuine external-timer subscription.
 */
export function useFlashStatus(state: ActionState): FlashStatus {
  const [flash, setFlash] = useState<FlashStatus>("idle");
  // Tracked via useState rather than a ref -- see "Adjusting state when a
  // prop changes" in the React docs, and owned-numbers.tsx's pagination
  // reset for the same pattern already in use elsewhere in this app.
  const [prevState, setPrevState] = useState(state);

  if (prevState !== state) {
    setPrevState(state);
    if (state.status !== "idle") {
      setFlash(state.status === "error" ? "error" : "success");
    }
  }

  useEffect(() => {
    if (flash === "idle") return;
    const ms = flash === "error" ? 4000 : 2000;
    const timeout = setTimeout(() => setFlash("idle"), ms);
    return () => clearTimeout(timeout);
  }, [flash, state]);

  return flash;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/**
 * The submit button's own label/icon/color carries save state now, Vapi-style
 * ("Saved" with a checkmark, briefly) instead of only a separate text message
 * off to the side -- pending -> success/error -> back to idle on its own.
 */
export function SubmitButton({
  formId,
  variant,
  size = "md",
  fullWidth,
  idleLabel,
  pendingLabel,
  successLabel = "Saved",
  pending,
  flash,
}: {
  formId: string;
  variant: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  pending: boolean;
  flash: FlashStatus;
}) {
  const shared = {
    type: "submit" as const,
    form: formId,
    size,
    className: fullWidth ? "w-full" : undefined,
  };

  if (pending) {
    return (
      <Button {...shared} variant={variant} disabled>
        <Spinner />
        {pendingLabel ?? "Working…"}
      </Button>
    );
  }
  if (flash === "success") {
    return (
      <Button {...shared} variant={variant}>
        <CheckIcon />
        {successLabel}
      </Button>
    );
  }
  if (flash === "error") {
    return (
      <Button {...shared} variant="danger">
        <CrossIcon />
        Failed
      </Button>
    );
  }
  return (
    <Button {...shared} variant={variant}>
      {idleLabel}
    </Button>
  );
}

const FLASH_ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-3.5 w-3.5 shrink-0",
  "aria-hidden": true,
};

function CheckIcon() {
  return (
    <svg {...FLASH_ICON_PROPS}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg {...FLASH_ICON_PROPS}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * A `<form>` bound to a Server Action, with pending/success/error reflected
 * on the submit button itself. Every mutation in the dashboard goes through
 * this so save state looks the same everywhere.
 *
 * `confirm` guards destructive or costly actions (releasing a number, deleting
 * an agent) behind a confirmation dialog.
 */
export function ActionForm({
  action,
  submitLabel = "Save",
  submitVariant = "primary",
  submitFullWidth,
  pendingLabel,
  confirm,
  footer,
  className,
  children,
}: {
  action: ServerAction;
  submitLabel?: string;
  submitVariant?: ButtonVariant;
  /** Stretches the submit button across the form -- for a single-purpose form
   * that is the whole surface, like sign-in. */
  submitFullWidth?: boolean;
  pendingLabel?: string;
  confirm?: string;
  /** Extra content rendered next to the submit button. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const { formRef, onSubmit, dialog } = useConfirmGate(confirm);
  const formId = useId();
  const flash = useFlashStatus(state);

  return (
    // `footer` often holds an ActionButton, which renders its own <form> --
    // that can't nest inside this one (invalid HTML, breaks hydration). The
    // submit button below is pulled out of the <form> tag too (tied back to
    // it via the `form` attribute) so it and `footer`'s button share one flex
    // row instead of the button sitting inside the form and footer stacking
    // below it as a separate block.
    <div className={className ?? "space-y-4"}>
      <form id={formId} ref={formRef} action={formAction} className="space-y-4" onSubmit={onSubmit}>
        {children}
      </form>
      <div
        className={
          submitFullWidth
            ? "space-y-3"
            : "flex flex-wrap items-center gap-3"
        }
      >
        <SubmitButton
          formId={formId}
          variant={submitVariant}
          fullWidth={submitFullWidth}
          idleLabel={submitLabel}
          pendingLabel={pendingLabel}
          pending={pending}
          flash={flash}
        />
        {/* Success is now shown on the button itself -- this stays only for
            error, since the reason why needs more room than the button has. */}
        {flash === "error" && <ActionMessage state={state} />}
        {footer}
      </div>
      {dialog}
    </div>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-sm text-error-text"
          : "text-sm text-success-text"
      }
    >
      {state.message}
    </p>
  );
}

/**
 * A submit-only form — no fields beyond the hidden values passed in. Used for
 * row-level actions like delete, attach, detach.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  size = "md",
  confirm,
  hidden,
}: {
  action: ServerAction;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  /** `"sm"` for buttons that live inside a table row or list item, so they
   * don't out-weigh the row's own content. */
  size?: ButtonSize;
  confirm?: string;
  /** Hidden field name/value pairs identifying the target row. */
  hidden: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const { formRef, onSubmit, dialog } = useConfirmGate(confirm);
  const formId = useId();
  const flash = useFlashStatus(state);

  return (
    <>
      <form
        id={formId}
        ref={formRef}
        action={formAction}
        className="hidden"
        onSubmit={onSubmit}
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      <div className="inline-flex flex-wrap items-center gap-2">
        <SubmitButton
          formId={formId}
          variant={variant}
          size={size}
          idleLabel={label}
          pendingLabel={pendingLabel}
          successLabel="Done"
          pending={pending}
          flash={flash}
        />
        {flash === "error" && <ActionMessage state={state} />}
      </div>
      {dialog}
    </>
  );
}

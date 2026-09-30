"use client";

import { Button } from "@/components/ui";

/**
 * Replaces the browser's native `window.confirm()` -- which shows as an ugly
 * "localhost:3737 says..." box the user can't style -- with a dialog that
 * matches the rest of the dashboard. Wired into ActionForm/ActionButton, so
 * every `confirm={...}` prop already in use gets this automatically.
 */
export function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-body">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" autoFocus onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

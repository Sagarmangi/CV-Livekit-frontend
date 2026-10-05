"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { regenerateWidgetKey } from "@/app/(protected)/agents/actions";
import { ActionButton } from "@/components/form";
import { Button, Mono } from "@/components/ui";

// `useSyncExternalStore` is the sanctioned way to read a browser-only value:
// the server snapshot (null) renders first and the client one replaces it
// after hydration, with no effect-and-setState round trip.
const noSubscribe = () => () => {};
function useDashboardOrigin(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null,
  );
}

/**
 * The half of the Web widget tab that isn't a form: the key, the snippet to
 * paste, and a live preview. Separate from WidgetConfigForm because the
 * "Regenerate key" ActionButton renders its own <form>, which can't nest
 * inside the config form's.
 */
export function WidgetEmbedPanel({
  agentId,
  widgetKey,
  enabled,
}: {
  agentId: string;
  widgetKey: string | null;
  enabled: boolean;
}) {
  // The embed URL is wherever this dashboard is being served from -- the
  // loader derives its own base from the script src, so the snippet only has
  // to point at us. Null on the server, which has no window to ask.
  const base = useDashboardOrigin();

  // Bumped by "Reload preview" so the iframe picks up a just-saved config
  // without a full page refresh.
  const [previewNonce, setPreviewNonce] = useState(0);

  // The column is NOT NULL and the migration issued a key to every agent, so
  // this is defensive only -- a row that somehow lost its key can get one back.
  if (!widgetKey) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">This agent has no widget key. Issue one to embed it.</p>
        <ActionButton
          action={regenerateWidgetKey}
          label="Generate key"
          pendingLabel="Generating…"
          hidden={{ agent_id: agentId }}
        />
      </div>
    );
  }

  const snippet = `<script src="${base ?? "https://voice.codeoravision.com"}/widget.js" data-key="${widgetKey}" async></script>`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-body">Widget key</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-line bg-canvas-alt px-3 py-2">
            <Mono>{widgetKey}</Mono>
          </span>
          <CopyButton text={widgetKey} label="Copy key" />
          <ActionButton
            action={regenerateWidgetKey}
            label="Regenerate key"
            pendingLabel="Regenerating…"
            variant="danger"
            size="sm"
            confirm="Issue a new key? Every site embedding the current key stops working until it's updated with the new snippet."
            hidden={{ agent_id: agentId }}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Public by design -- it sits in the page source of every site that embeds the
          widget. It identifies the agent; the allowed domains above are what grant access.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-body">Embed snippet</p>
        <pre className="overflow-x-auto rounded-md border border-line bg-canvas-alt p-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap break-all">
          {snippet}
        </pre>
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton text={snippet} label="Copy snippet" disabled={base === null} />
          <p className="text-xs text-muted">
            Paste it just before <code className="font-mono">&lt;/body&gt;</code> on any page
            of an allowed domain.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-body">Live preview</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPreviewNonce((n) => n + 1)}
          >
            Reload preview
          </Button>
        </div>
        {enabled ? (
          <>
            <div className="inline-block overflow-hidden rounded-xl border border-line shadow-md">
              <iframe
                key={previewNonce}
                src={`/widget/${widgetKey}`}
                title="Widget preview"
                allow="microphone; autoplay"
                className="block h-[560px] w-[360px] max-w-full bg-white"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              The real widget, exactly as a visitor gets it. A call started here counts
              toward the daily cap and the live-call limit like any other. The agent must
              be <strong>active</strong> for calls to connect; the preview is allowed from
              the dashboard without listing its domain.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Enable the widget and save to preview it here.
          </p>
        )}
      </div>
    </div>
  );
}

function CopyButton({
  text,
  label,
  disabled,
}: {
  text: string;
  label: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard access needs a secure context; the text is on screen to
          // select by hand, so there's nothing more useful to say here.
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

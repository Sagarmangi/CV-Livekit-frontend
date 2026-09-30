/**
 * Shared presentational primitives.
 *
 * Deliberately plain Tailwind rather than a component library — the dashboard
 * is a handful of admin screens, and the whole surface fits in one file.
 *
 * Every colour, radius, shadow and face here comes from the Kodexo Labs
 * visual identity via the semantic utilities set up in app/globals.css
 * (bg-surface, text-muted, border-line, ...). Those resolve through custom
 * properties that flip with the theme, so nothing in this file needs a `dark:`
 * variant -- if you find yourself reaching for a raw palette value or a
 * `dark:` pair, the token for it probably already exists.
 */

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import type { AgentStatus, CallOutcome, CallPriority } from "@/lib/types";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The padded content column every page sits in. Explicit per page rather than
 * baked into the protected layout, because /agents puts its own second rail
 * (see components/section-sidebar.tsx) beside this instead of inside it.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        // Gutters tighten on small screens -- 24px each side costs a sixth of a
        // 320px viewport, which is content, not whitespace.
        "mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8 lg:py-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  /** A row of small facts about the thing being edited -- rendered directly
   * under the title, ahead of any description. */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line pb-5 sm:pb-6">
      <div className="min-w-0 flex-1">
        {/* Statement face, per the identity's H1 rule -- the base styles in
            globals.css carry the family/weight, so this only sets size. */}
        {/* Wraps rather than overflowing -- an agent name can be long, and the
            statement face is set tight. */}
        <h1 className="text-xl break-words sm:text-2xl">{title}</h1>
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {meta}
          </div>
        )}
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        // Wraps onto its own full-width row below `sm` rather than being
        // squeezed beside the title.
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-line bg-surface shadow-sm",
        className,
      )}
    >
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-divider px-4 py-4 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2 className="font-heading text-sm font-semibold text-strong">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

/** `Card`'s shell with no padding of its own -- for content that owns its own
 * internal layout, like the tools library's list-plus-detail split. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-lg border border-line bg-surface shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Same look as `Card`, but the whole thing starts closed -- for reference
 * material that's worth having on the page without taking up space by default. */
export function CollapsibleCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-line bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-4 py-4 marker:content-none sm:px-6">
        <Chevron />
        <div className="min-w-0">
          {title && (
            <h2 className="font-heading text-sm font-semibold text-strong">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
      </summary>
      <div className="border-t border-divider p-4 sm:p-6">{children}</div>
    </details>
  );
}

/** The disclosure triangle used by every `<details>` in the app -- rotates on
 * open via the `group-open` variant on its parent `<summary>`'s group. */
export function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint transition-transform group-open:rotate-90"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center sm:px-6 sm:py-12">
      <p className="font-heading text-sm font-semibold text-strong">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Explains a missing integration instead of letting the page throw.
 * `lib/env.ts` intentionally fails loudly on unset credentials; this is the
 * friendly version of that error for a half-configured install.
 */
export function ConfigNotice({
  integration,
  vars,
}: {
  integration: string;
  vars: string[];
}) {
  return (
    <div className="rounded-lg border border-warning-border bg-warning-bg px-5 py-4 text-sm">
      <p className="font-heading font-semibold text-warning-text">
        {integration} isn&apos;t configured yet
      </p>
      <p className="mt-1.5 leading-relaxed text-warning-text">
        Set{" "}
        {vars.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <Code>{v}</Code>
          </span>
        ))}{" "}
        in <Code>dashboard/.env.local</Code> and restart the dev server.
      </p>
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-error-border bg-error-bg px-5 py-4 text-sm leading-relaxed text-error-text">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Text bits                                                                  */
/* -------------------------------------------------------------------------- */

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-canvas-alt px-1.5 py-0.5 font-mono text-[0.8125rem] text-body">
      {children}
    </code>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-sm tabular-nums">{children}</span>;
}

/** The one dash used for "no value here", so empty cells look deliberate
 * rather than like three different bugs. */
export function Empty() {
  return <span className="text-faint">—</span>;
}

/** Renders a UTC timestamp deterministically so SSR and the client agree. */
export function Timestamp({ value }: { value: string | null }) {
  if (!value) return <Empty />;
  const iso = new Date(value).toISOString();
  return (
    <time dateTime={iso} className="font-mono text-[0.8125rem] tabular-nums">
      {iso.slice(0, 16).replace("T", " ")} UTC
    </time>
  );
}

export function Duration({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <Empty />;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className="font-mono text-[0.8125rem] tabular-nums">
      {`${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

/**
 * A USD amount, shown to four decimal places rather than two.
 *
 * These are fractions of a cent: a three-minute call costs around $0.07 and a
 * single component of it can be $0.0039. Rounding to cents would print $0.00
 * for most of what this dashboard is trying to show, so the extra digits are
 * the whole point rather than false precision.
 *
 * Null means the call predates cost tracking and can never be priced — an
 * em-dash, not $0.00, because the two mean very different things.
 */
export function Money({ usd }: { usd: number | null }) {
  if (usd === null || usd === undefined) return <Empty />;
  return (
    <span className="font-mono text-[0.8125rem] tabular-nums">
      {`$${usd.toFixed(4)}`}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

const BADGE_TONES = {
  neutral: "border-line bg-canvas-alt text-muted",
  green: "border-success-border bg-success-bg text-success-text",
  amber: "border-warning-border bg-warning-bg text-warning-text",
  red: "border-error-border bg-error-bg text-error-text",
  blue: "border-info-border bg-info-bg text-info-text",
  // The identity allows one tertiary accent per surface; violet is only ever
  // used for the "live on another platform" number badge.
  violet: "border-soft-purple/35 bg-soft-purple/12 text-soft-purple",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Small status dot -- same tone vocabulary as `Badge`, for places where a
 * whole pill is too much furniture (list rows, summary cards). */
const DOT_TONES = {
  neutral: "bg-n-400",
  green: "bg-success-text",
  amber: "bg-warning-text",
  red: "bg-brand",
  blue: "bg-info-text",
  violet: "bg-soft-purple",
} as const;

export function StatusDot({ tone = "neutral" }: { tone?: keyof typeof DOT_TONES }) {
  return (
    <span
      aria-hidden
      className={cx("h-1.5 w-1.5 shrink-0 rounded-pill", DOT_TONES[tone])}
    />
  );
}

const AGENT_STATUS_TONES: Record<AgentStatus, keyof typeof BADGE_TONES> = {
  active: "green",
  paused: "amber",
  draft: "neutral",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <Badge tone={AGENT_STATUS_TONES[status]}>{status}</Badge>;
}

export function AgentStatusDot({ status }: { status: AgentStatus }) {
  return <StatusDot tone={AGENT_STATUS_TONES[status]} />;
}

const OUTCOME_TONES: Record<CallOutcome, keyof typeof BADGE_TONES> = {
  qualified: "green",
  department_transfer: "blue",
  not_qualified: "neutral",
  transfer_failed: "red",
  dropped: "amber",
  // Amber rather than neutral: a spam hangup is a call the system ended on its
  // own, and one of them being wrong means a real customer was cut off. Worth
  // catching the eye of anyone scanning the list.
  spam_bot: "amber",
  spam_sales: "amber",
};

export function OutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <Empty />;
  return (
    <Badge tone={OUTCOME_TONES[outcome]}>{outcome.replace(/_/g, " ")}</Badge>
  );
}

const PRIORITY_TONES: Record<CallPriority, keyof typeof BADGE_TONES> = {
  High: "red",
  Medium: "amber",
  Low: "neutral",
};

/** How much attention a call deserves, as judged by the post-call analysis.
 * Separate from OutcomeBadge on purpose — a spam call is outcome "spam bot" and
 * priority "Low", and collapsing the two would lose one of them. */
export function PriorityBadge({ priority }: { priority: CallPriority | null }) {
  if (!priority) return <Empty />;
  return <Badge tone={PRIORITY_TONES[priority]}>{priority}</Badge>;
}

const CALL_STATUS_TONES = {
  success: "green",
  failed: "red",
  incomplete: "amber",
} as const;

/** Whether the call worked, as distinct from what it was for. */
export function CallStatusBadge({
  status,
}: {
  status: "success" | "failed" | "incomplete" | null;
}) {
  if (!status) return <Empty />;
  return <Badge tone={CALL_STATUS_TONES[status]}>{status}</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Buttons & links                                                            */
/* -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  /** Brand red -- one per view, on the action that view exists to perform. */
  primary: "bg-brand text-on-brand hover:bg-brand-deep",
  secondary:
    "border border-line bg-surface text-body hover:bg-canvas-alt hover:text-strong",
  danger:
    "border border-error-border bg-error-bg text-error-text hover:bg-error-border",
  /** No chrome until hovered -- for icon buttons and low-stakes toggles. */
  ghost: "text-muted hover:bg-canvas-alt hover:text-strong",
} as const;

const BUTTON_SIZES = {
  md: "h-9 gap-1.5 px-3.5 text-sm",
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem]",
} as const;

/* Focus is handled globally (see the `:focus-visible` rule in globals.css) so
 * every interactive element in the app gets the same brand-red ring. */
const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export type ButtonSize = keyof typeof BUTTON_SIZES;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={cx(
        BUTTON_BASE,
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: ButtonSize;
}) {
  return (
    <Link
      {...props}
      className={cx(
        BUTTON_BASE,
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

/** Inline text link, in brand red. `brand-deep` in light mode for contrast
 * against a white surface; the lighter red reads better on a dark one. */
export function TextLink({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cx(
        "font-medium text-brand-deep underline-offset-2 transition-colors hover:underline dark:text-brand",
        className,
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

/* Split so a toned control can replace the colour half without both versions
 * emitting a `background-color` utility. Two Tailwind utilities for the same
 * property have identical specificity, so which one wins comes down to their
 * order in the generated stylesheet, not the order they're listed at the call
 * site -- appending `bg-success-bg` to a class list that already has
 * `bg-surface` is a coin toss. */
const CONTROL_BASE =
  "w-full rounded-md border px-3 py-2 text-sm transition-colors placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-60";

/* `bg-input` rather than `bg-surface`: a card is already the elevated surface,
 * so a field sharing that token has no edge to it at all in dark mode. This one
 * is recessed instead -- see the note on --input-bg in globals.css. */
const CONTROL_SURFACE =
  "border-input-line bg-input text-body focus:border-brand";

const CONTROL = `${CONTROL_BASE} ${CONTROL_SURFACE}`;

/* Tones for a control whose value is itself a status live with the dropdown
 * that uses them -- see TRIGGER_TONES in components/dropdown.tsx. */

const FIELD_BADGE_CLASSES: Record<"required" | "optional", string> = {
  required: "bg-brand-tint text-brand-deep dark:text-brand",
  optional: "bg-canvas-alt text-faint",
};

/**
 * Small "i" icon that reveals `text` in a floating bubble on hover/focus,
 * instead of a permanently-visible paragraph. Anchored above the icon by
 * default (`bottom-full`) since that's usually clearer above a form field,
 * and width-clamped so it can't overflow off the side of the viewport.
 */
export function InfoTooltip({ text }: { text: ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      <button
        type="button"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border border-n-400 font-mono text-[0.625rem] leading-none font-medium text-faint transition-colors hover:border-brand hover:text-brand"
        aria-label="More info"
      >
        i
      </button>
      <span
        role="tooltip"
        // bg-strong/text-canvas is the inverted surface pair: near-black on
        // white in light mode, white on near-black in dark, from one class each.
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[min(20rem,80vw)] -translate-x-1/2 rounded-md bg-strong px-3 py-2 text-xs leading-relaxed font-normal whitespace-normal text-canvas opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {text}
        <span className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-strong" />
      </span>
    </span>
  );
}

/** Pass `"required"`/`"optional"` for the common cases, or a short string
 * (e.g. `"Required to activate"`) for a field that's conditionally needed.
 * `hint`, if given, shows in a hover tooltip off an "i" icon next to the
 * label rather than as permanent text under the field. */
export function Field({
  label,
  hint,
  htmlFor,
  badge,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  badge?: "required" | "optional" | string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-body"
      >
        {label}
        {hint && <InfoTooltip text={hint} />}
        {badge && (
          <span
            className={cx(
              "rounded-pill px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap",
              badge === "required" || badge === "optional"
                ? FIELD_BADGE_CLASSES[badge]
                : "bg-warning-bg text-warning-text",
            )}
          >
            {badge === "required"
              ? "Required"
              : badge === "optional"
                ? "Optional"
                : badge}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

/** A titled group of related fields inside a form, replacing the ad-hoc
 * `<fieldset class="border-t ...">` blocks that had drifted apart. */
export function FieldSet({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 border-t border-divider pt-5">
      <div>
        <legend className="font-heading text-sm font-semibold text-strong">
          {legend}
        </legend>
        {description && (
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {children}
    </fieldset>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx(CONTROL, "font-mono text-[0.8125rem] leading-relaxed", className)}
    />
  );
}

/* There's no `Select` primitive here on purpose. A native <select>'s open list
 * is drawn by the OS -- unstylable, single-line, and on Windows it lands as a
 * white menu with a blue highlight in the middle of a dark dashboard. Use
 * components/dropdown.tsx instead; it posts through a hidden input, so it drops
 * into a form the same way. */

/** The one-character glyph that stands in for a tool's type (see
 * lib/tool-display.ts for which character means what). Brand red on a plain
 * surface -- these appear in lists of a dozen, so a filled colour block each
 * would fight everything around them. */
/**
 * Per-tool-type accents, so a type is recognisable by colour before the label
 * is read -- the library list and the type picker show the same six.
 *
 * Built from the existing semantic tokens rather than raw colours, so both
 * themes are covered without a second palette to keep in step. Violet is
 * deliberately absent: the identity reserves it for the "live on another
 * platform" number badge (see BADGE_TONES).
 */
const GLYPH_TONES = {
  brand: "border-brand/35 bg-brand-tint text-brand",
  blue: "border-info-border bg-info-bg text-info-text",
  green: "border-success-border bg-success-bg text-success-text",
  amber: "border-warning-border bg-warning-bg text-warning-text",
  red: "border-error-border bg-error-bg text-error-text",
  neutral: "border-line bg-canvas-alt text-muted",
} as const;

export type GlyphTone = keyof typeof GLYPH_TONES;

export function ToolTypeGlyph({
  icon,
  tone = "brand",
  size = "md",
}: {
  icon: string;
  tone?: GlyphTone;
  /** `"sm"` inside a dropdown row, where a 28px badge crowds the label. */
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-md border font-mono font-bold",
        size === "sm" ? "h-5 w-5 text-[0.625rem]" : "h-7 w-7 text-xs",
        GLYPH_TONES[tone],
      )}
    >
      {icon}
    </span>
  );
}

/** A value that can't be edited -- fixed by the worker and shown here only for
 * context. Deliberately does NOT look like an input: dashed edge, no recessed
 * fill, muted text. Editable fields are the solid, filled ones. */
export function StaticValue({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
      {children}
    </p>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      type="checkbox"
      // accent-color comes from the global `:root` rule, so a checked box is
      // brand red without every call site restating it.
      className={cx("size-4 rounded-sm border-line", className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-line px-3 py-2.5 font-mono text-[0.6875rem] font-medium tracking-[0.08em] whitespace-nowrap text-faint uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: ComponentProps<"td">) {
  return (
    <td
      className={cx("border-b border-divider px-3 py-3 align-middle", className)}
    >
      {children}
    </td>
  );
}

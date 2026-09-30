/**
 * Loading placeholders for the `loading.tsx` boundary of each section.
 *
 * These exist for a reason beyond looking busy. Next skips prefetching a
 * dynamic route entirely unless it has a `loading.tsx` to prefetch -- so
 * without one, clicking a nav item does nothing visible until the server has
 * finished the whole render, and the dashboard reads as frozen. With one, the
 * shell is already on the client and swaps in on the same frame as the click.
 *
 * Each skeleton mirrors the real chrome it stands in for (same PageBody
 * gutters, same PageHeader border, same table columns) so the page doesn't
 * jump when the content lands.
 */

import { PageBody } from "@/components/ui";

/** One shimmering block. `w`/`h` are Tailwind classes so callers set the size. */
export function Bar({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-canvas-alt ${className ?? ""}`} />
  );
}

/** Stands in for `PageHeader` -- title, optional description, same bottom rule. */
export function HeaderSkeleton({ withDescription = true }: { withDescription?: boolean }) {
  return (
    <div className="border-b border-line pb-5 sm:pb-6">
      <Bar className="h-7 w-48 sm:h-8" />
      {withDescription && <Bar className="mt-3 h-3.5 w-full max-w-2xl" />}
    </div>
  );
}

/** Stands in for a `Card` with `rows` lines of content inside it. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} className={i === rows - 1 ? "h-3.5 w-2/3" : "h-3.5 w-full"} />
        ))}
      </div>
    </section>
  );
}

/** Stands in for a `Table` inside a `Card`: header rule plus `rows` rows. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-6">
      <div className="flex gap-3 border-b border-line pb-2.5">
        {Array.from({ length: cols }, (_, i) => (
          <Bar key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3 border-b border-divider py-3">
          {Array.from({ length: cols }, (_, c) => (
            <Bar key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </section>
  );
}

/** The whole-page shape most sections want: header then a table. */
export function TablePageSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <PageBody>
      <HeaderSkeleton />
      <TableSkeleton rows={rows} cols={cols} />
    </PageBody>
  );
}

import Link from "next/link";

/**
 * Page-through control for a server-rendered list.
 *
 * Plain `<Link>`s rather than buttons and client state: the page number lives
 * in the query string like the filters beside it do, so a given page is a
 * shareable URL and the back button steps through pages the way people expect.
 * They're also prefetchable, which a click handler wouldn't be.
 *
 * Every existing search param is carried through, so paging never silently
 * drops the filter someone just set.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  /** Plural noun for the total, e.g. "calls". */
  unit,
}: {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  /** The current query string, page number included or not — it's overwritten. */
  params: Record<string, string | string[] | undefined>;
  unit: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function href(target: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page") continue;
      if (typeof value === "string" && value !== "") next.set(key, value);
    }
    // Page 1 is the bare URL — no `?page=1` clutter on the common case.
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4"
    >
      <p className="text-sm text-muted">
        {total === 0 ? (
          <>No {unit}</>
        ) : (
          <>
            <span className="font-mono tabular-nums">{first}</span>–
            <span className="font-mono tabular-nums">{last}</span> of{" "}
            <span className="font-mono tabular-nums">{total}</span> {unit}
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <PageLink href={href(page - 1)} disabled={page <= 1} rel="prev">
          ← Previous
        </PageLink>
        <span className="px-1 text-sm text-faint">
          Page <span className="font-mono tabular-nums">{page}</span> of{" "}
          <span className="font-mono tabular-nums">{lastPage}</span>
        </span>
        <PageLink href={href(page + 1)} disabled={page >= lastPage} rel="next">
          Next →
        </PageLink>
      </div>
    </nav>
  );
}

/** A `secondary` Button's look, as a link — or an inert span at either end. */
function PageLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string;
  disabled: boolean;
  rel: "prev" | "next";
  children: React.ReactNode;
}) {
  const shape =
    "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-[0.8125rem] font-semibold whitespace-nowrap";

  if (disabled) {
    // Deliberately not a disabled <button>: there's no action here to disable,
    // it's the absence of a page to link to.
    return (
      <span aria-disabled className={`${shape} border border-line bg-surface text-faint opacity-50`}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={rel}
      className={`${shape} border border-line bg-surface text-body transition-colors hover:bg-canvas-alt hover:text-strong`}
    >
      {children}
    </Link>
  );
}

import { Bar, CardSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

export default function Loading() {
  return (
    <PageBody>
      <HeaderSkeleton />
      {/* The three working/broken/not-configured tallies. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm"
          >
            <Bar className="h-6 w-8" />
            <Bar className="mt-2.5 h-2.5 w-24" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={9} cols={4} />
      <CardSkeleton rows={2} />
    </PageBody>
  );
}

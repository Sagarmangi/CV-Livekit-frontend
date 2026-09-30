import { Bar, HeaderSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

export default function Loading() {
  return (
    <PageBody>
      <HeaderSkeleton />
      {/* The library is a list-plus-detail split inside a `Panel`. */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="flex min-h-96 flex-col sm:flex-row">
          <div className="w-full shrink-0 space-y-2 border-line p-3 sm:w-64 sm:border-r">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                <Bar className="h-7 w-7 shrink-0" />
                <Bar className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-6">
            <Bar className="h-4 w-40" />
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-5/6" />
            <Bar className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}

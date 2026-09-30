import { Bar, CardSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

/**
 * Mirrors the agent pane: sticky title band with its actions, the model
 * summary strip, then the tab bar and the open tab's card. Clicking between
 * agents in the rail swaps to this immediately instead of leaving the previous
 * agent on screen while the server fetches.
 */
export default function Loading() {
  return (
    <PageBody className="pt-0">
      <div className="-mx-4 bg-canvas px-4 pt-5 pb-4 sm:-mx-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:px-8 lg:pt-7 lg:pb-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line pb-5 sm:pb-6">
          <div className="min-w-0 flex-1">
            <Bar className="h-7 w-56 sm:h-8" />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Bar className="h-3.5 w-40" />
              <Bar className="h-3.5 w-20" />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            <Bar className="h-9 w-24" />
            <Bar className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Model summary strip. */}
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <Bar key={i} className="h-6 w-32" />
        ))}
      </div>

      {/* Tab bar. */}
      <div className="flex gap-4 border-b border-line pb-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bar key={i} className="h-3.5 w-28" />
        ))}
      </div>

      <CardSkeleton rows={6} />
    </PageBody>
  );
}

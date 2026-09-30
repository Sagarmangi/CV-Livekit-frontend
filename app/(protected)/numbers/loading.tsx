import { CardSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

export default function Loading() {
  return (
    <PageBody>
      <HeaderSkeleton />
      {/* Mirrors the two-up grid of owned/connected numbers, then the connect
          form and the routing-status card below it. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={5} />
        <CardSkeleton rows={5} />
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </PageBody>
  );
}

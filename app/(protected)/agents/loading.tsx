import { CardSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

/**
 * Covers the pane to the right of the agents rail. The rail itself is in the
 * layout above and streams behind its own Suspense boundary, so it stays put
 * while this swaps.
 */
export default function Loading() {
  return (
    <PageBody>
      <HeaderSkeleton />
      <CardSkeleton rows={4} />
    </PageBody>
  );
}

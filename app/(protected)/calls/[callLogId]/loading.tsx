import { CardSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { PageBody } from "@/components/ui";

/**
 * The detail view is cards, not the list's table -- without this the parent
 * /calls skeleton would flash a table shape on the way into a single call.
 */
export default function Loading() {
  return (
    <PageBody>
      <HeaderSkeleton withDescription={false} />
      <CardSkeleton rows={6} />
      <CardSkeleton rows={10} />
    </PageBody>
  );
}

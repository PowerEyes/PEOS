import { PortalSkeleton } from "@/components/Skeletons";

/** Streams while any /my/* page resolves (auth check + customer fetch). */
export default function Loading() {
  return <PortalSkeleton />;
}

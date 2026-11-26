import { Skeleton } from "@poweros/ui";
export default function Loading() {
  return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-10 w-56" /><Skeleton className="h-12 w-full" />{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
}

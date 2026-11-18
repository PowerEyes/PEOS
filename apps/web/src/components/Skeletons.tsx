import { Skeleton } from "@poweros/ui";

/**
 * Skeleton placeholders for every page that fetches data — shown by the
 * route's loading.tsx (or a component's own pending state) so navigation
 * never lands on a blank white area.
 */

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(10,34,64,.08)]">
          <Skeleton className="aspect-[4/3]" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-3 h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hero banner + product grid — category and collection pages. */
export function ListingSkeleton() {
  return (
    <div className="space-y-6 py-8">
      <Skeleton className="h-28 w-full rounded-none" />
      <ProductGridSkeleton />
    </div>
  );
}

/** Order / repair / document style cards — portal lists. */
export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="mt-4 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
          <div className="mt-4 border-t border-slate-100 pt-3"><Skeleton className="h-4 w-28" /></div>
        </div>
      ))}
    </div>
  );
}

/** Generic portal page shell (my/loading.tsx covers every /my route). */
export function PortalSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <CardListSkeleton rows={3} />
    </div>
  );
}

/** Product detail: gallery square + info column, then tabs. */
export function ProductPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <Skeleton className="h-3 w-72" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full" />
          <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-16" />)}</div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Cart: item rows + order summary, before localStorage hydration finishes. */
export function CartSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4">
              <Skeleton className="h-24 w-24 shrink-0" />
              <div className="flex-1 space-y-2 pt-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
            </div>))}
        </div>
        <div className="h-fit space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("skeleton rounded-lg", className)} />
  );
}

export function PosterCardSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

export function PosterGridSkeleton({
  count = 12,
  label = "Loading anime",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: count }, (_, index) => (
          <PosterCardSkeleton key={index} />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <PosterCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading anime details">
      <Skeleton className="h-48 w-full rounded-none sm:h-64 lg:h-80" />
      <div className="mx-auto -mt-20 max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row">
          <Skeleton className="aspect-[2/3] w-32 shrink-0 rounded-xl sm:w-44 lg:w-52" />
          <div className="w-full space-y-3 pt-20 sm:pt-24">
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading anime details</span>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

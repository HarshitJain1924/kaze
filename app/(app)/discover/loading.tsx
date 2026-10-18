import { PosterGridSkeleton, Skeleton } from "@/components/loading-skeleton";

export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface/60 p-3 sm:p-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <PosterGridSkeleton count={12} label="Loading discovery results" />
    </div>
  );
}

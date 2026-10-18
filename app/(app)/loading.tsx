import {
  PosterGridSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/components/loading-skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <Skeleton className="h-64 w-full rounded-3xl sm:h-72" />

      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <RowSkeleton count={6} />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <PosterGridSkeleton count={12} label="Loading anime" />
      </div>
    </div>
  );
}

import { RowSkeleton, Skeleton } from "@/components/loading-skeleton";

export default function LibraryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-11 w-full sm:max-w-xs rounded-xl" />
      </div>
      <RowSkeleton count={6} />
    </div>
  );
}

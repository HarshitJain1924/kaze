import { Skeleton } from "@/components/loading-skeleton";

export default function ScheduleLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading anime schedule">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      <div className="flex gap-2 overflow-hidden sm:grid sm:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full min-w-[76px] rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-2xl border border-border-subtle bg-surface p-3"
          >
            <Skeleton className="h-[110px] w-[74px] shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2.5 py-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-auto h-7 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

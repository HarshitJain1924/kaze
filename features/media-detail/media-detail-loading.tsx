export function MediaDetailLoading() {
  return (
    <div className="animate-pulse space-y-8 py-4" aria-label="Loading media details">
      <div className="h-5 w-28 rounded bg-surface-2" />
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="aspect-[2/3] w-40 shrink-0 rounded-xl bg-surface-2 sm:w-52" />
        <div className="min-w-0 flex-1 space-y-4 pt-2">
          <div className="h-6 w-48 rounded bg-surface-2" />
          <div className="h-10 w-3/4 rounded bg-surface-2" />
          <div className="h-4 w-1/2 rounded bg-surface-2" />
          <div className="h-px w-full bg-border-subtle" />
          <div className="flex gap-6">
            <div className="h-10 w-24 rounded bg-surface-2" />
            <div className="h-10 w-24 rounded bg-surface-2" />
            <div className="h-10 w-24 rounded bg-surface-2" />
          </div>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="h-10 w-full rounded bg-surface-2" />
          <div className="h-40 w-full rounded-2xl bg-surface-2" />
          <div className="h-40 w-full rounded-2xl bg-surface-2" />
        </div>
        <div className="h-80 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}

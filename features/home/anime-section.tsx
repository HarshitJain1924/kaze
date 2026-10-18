import { AnimeGrid } from "@/components/anime-grid";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { SectionHeader } from "@/components/section-header";
import type { AnimeSummary } from "@/types/anime";

export function AnimeSection({
  title,
  description,
  actionHref,
  actionLabel = "View all",
  items,
  error,
  emptyMessage = "No anime to show right now.",
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  items: AnimeSummary[] | null;
  error?: boolean;
  emptyMessage?: string;
}) {
  return (
    <section aria-label={title}>
      <SectionHeader
        title={title}
        description={description}
        action={actionHref ? actionLabel : undefined}
        actionHref={actionHref}
      />

      {items === null || error ? (
        <ErrorState
          title="Could not load anime"
          message="AniList did not respond in time. Your library is unaffected."
          action={<RetryButton />}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to show"
          description={emptyMessage}
        />
      ) : (
        <AnimeGrid items={items} />
      )}
    </section>
  );
}

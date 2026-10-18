import { EmptyState } from "@/components/empty-state";
import { LinkButton } from "@/components/ui/link-button";

export default function AnimeNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        title="Anime not found"
        description="This title may have been removed from AniList, or the address is incorrect."
        action={
          <LinkButton href="/discover" variant="primary" size="sm">
            Browse anime
          </LinkButton>
        }
      />
    </div>
  );
}

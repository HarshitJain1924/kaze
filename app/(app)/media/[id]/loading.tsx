import { DetailsSkeleton } from "@/components/loading-skeleton";

export default function AnimeDetailsLoading() {
  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 lg:-mx-10 lg:-mt-8">
      <DetailsSkeleton />
    </div>
  );
}

import { permanentRedirect } from "next/navigation";

export default async function LegacyAnimeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/media/${id}`);
}

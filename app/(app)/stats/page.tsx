import type { Metadata } from "next";

import { StatsView } from "@/features/stats/stats-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Statistics",
  description: "Your personal anime watching statistics.",
};

export default async function StatsPage() {
  await requireViewer("/stats");
  return <StatsView />;
}

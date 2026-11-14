import { redirect } from "next/navigation";

import { ActivityLog } from "@/features/activity/activity-log";
import { loadActivitySource } from "@/features/activity/load-activity";
import { buildActivityEvents } from "@/lib/activity";
import { getViewer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Activity · Kaze",
  description: "Everything you have watched, read and finished, newest first.",
};

export default async function ActivityPage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`/login?next=${encodeURIComponent("/activity")}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <ActivityLog events={[]} />;
  }

  const source = await loadActivitySource(supabase, viewer.id);
  const events = buildActivityEvents(source);

  return <ActivityLog events={events} />;
}

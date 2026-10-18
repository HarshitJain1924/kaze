import type { Metadata } from "next";

import { SettingsView } from "@/features/settings/settings-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, appearance and personal anime data.",
};

export default async function SettingsPage() {
  const viewer = await requireViewer("/settings");
  return <SettingsView viewer={viewer} />;
}

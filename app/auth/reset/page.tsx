import type { Metadata } from "next";

import { AlertIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/link-button";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Reset password · Kaze Anime Platform",
  description: "Choose a new password for your Kaze account.",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {viewer ? (
          <ResetPasswordForm />
        ) : (
          <div className="border border-border bg-surface p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center border border-warning/40 bg-warning/10 text-warning">
              <AlertIcon className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-display text-xl font-semibold text-fg">
              This reset link is no longer valid
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
              Reset links expire quickly for security. Request a new one from
              the sign-in screen.
            </p>
            <div className="mt-5">
              <LinkButton
                href="/login"
                variant="primary"
                className="h-10 w-full border border-accent bg-accent text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-contrast transition-colors hover:bg-accent-hover"
              >
                Request a new link
              </LinkButton>
            </div>
          </div>
        )}

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          Protected by PostgreSQL Row-Level Security (RLS)
        </p>
      </div>
    </div>
  );
}

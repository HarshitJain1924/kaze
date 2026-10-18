import type { Metadata } from "next";

import { AlertIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/link-button";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your Kaze account.",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo />
        </div>

        {viewer ? (
          <ResetPasswordForm />
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-7">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
              <AlertIcon className="h-5 w-5" />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-fg">
              This reset link is no longer valid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Reset links expire quickly for security. Request a new one from
              the sign-in screen.
            </p>
            <div className="mt-5">
              <LinkButton
                href="/login"
                variant="primary"
                className="w-full"
              >
                Request a new link
              </LinkButton>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-faint">
          Need help? Sign in again and use “Forgot your password?” on the login
          screen.
        </p>
      </div>
    </div>
  );
}

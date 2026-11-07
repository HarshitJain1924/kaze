"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AlertIcon, EyeIcon, EyeOffIcon, LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <OpticalGlass
      variant="card"
      className="border border-border bg-surface/90 p-6 sm:p-8 backdrop-blur-xl"
    >
      <div className="border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Vault Credential Reset
          </span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg">
          Choose a new password
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Your reset link is verified. Configure a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <Field
          label="New password"
          htmlFor="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="h-11 rounded-none border border-border bg-surface-2/60 pr-12 text-sm focus:border-accent focus:bg-surface focus:ring-0"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-faint transition-colors hover:text-fg"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-new-password">
          <Input
            id="confirm-new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            className="h-11 rounded-none border border-border bg-surface-2/60 text-sm focus:border-accent focus:bg-surface focus:ring-0"
            required
          />
        </Field>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 border border-danger/40 bg-danger/10 p-3 text-xs leading-relaxed text-danger"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="h-11 w-full border border-accent bg-accent text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
          disabled={busy}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span>Saving…</span>
            </span>
          ) : (
            "Save new password"
          )}
        </Button>
      </form>
    </OpticalGlass>
  );
}

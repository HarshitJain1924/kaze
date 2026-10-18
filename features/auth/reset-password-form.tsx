"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
      setError(`Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
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
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-7">
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Your reset link is valid. Pick a new password for your account.
      </p>

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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="pr-16"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-faint transition-colors hover:bg-surface-3 hover:text-fg"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-new-password">
          <Input
            id="confirm-new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            required
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={busy}
        >
          {busy ? (
            <>
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save new password"
          )}
        </Button>
      </form>
    </div>
  );
}

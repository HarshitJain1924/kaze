"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AlertIcon, CheckIcon, LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SUPABASE_ENV_VARS } from "@/lib/supabase/config";

type AuthMode = "signin" | "signup" | "forgot";

const MIN_PASSWORD_LENGTH = 8;

const LINK_ERROR_MESSAGES: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one and try again.",
  auth: "We could not complete sign in. Please try again.",
  not_configured:
    "Authentication is not configured for this deployment yet.",
};

function mapAuthError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (normalized.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (normalized.includes("password should be at least")) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("security purposes")
  ) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (normalized.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Could not reach the authentication service. Check your connection.";
  }
  return message;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginForm({
  configured,
  nextPath,
  linkError,
}: {
  configured: boolean;
  nextPath: string;
  linkError?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? (LINK_ERROR_MESSAGES[linkError] ?? linkError) : null,
  );
  const [notice, setNotice] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const title =
    notice
      ? "Check your email"
      : mode === "signin"
        ? "Welcome back"
        : mode === "signup"
          ? "Create your account"
          : "Reset your password";

  const subtitle =
    mode === "signin"
      ? "Sign in to sync your anime library across devices."
      : mode === "signup"
        ? "Start tracking episodes, ratings and notes in one private library."
        : "We will email you a secure link to choose a new password.";

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode !== "forgot" && password.length === 0) {
      setError("Enter your password.");
      return;
    }

    if (mode === "signup") {
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
    }

    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) {
          throw signInError;
        }
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          router.replace(nextPath);
          router.refresh();
          return;
        }

        setNotice({
          title: "Confirm your email",
          body: `We sent a confirmation link to ${cleanEmail}. Open it to finish creating your account, then sign in.`,
        });
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset`;
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        });
      if (resetError) {
        throw resetError;
      }
      setNotice({
        title: "Check your email",
        body: `If an account exists for ${cleanEmail}, a password reset link is on its way. The link expires shortly.`,
      });
    } catch (submitError) {
      setError(mapAuthError(submitError));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
            <AlertIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-fg">
            Connect Supabase to enable accounts
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Discovery and anime details already work with the public AniList
            API. Sign-in and your personal library need a Supabase project.
          </p>
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
              Required environment variables
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
              {SUPABASE_ENV_VARS.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Copy <code className="text-muted">.env.example</code> to{" "}
            <code className="text-muted">.env.local</code>, add your project
            URL and publishable key, then apply the migration in{" "}
            <code className="text-muted">supabase/migrations</code>. See the
            README for the full setup.
          </p>
          <div className="mt-5">
            <LinkButton href="/discover" variant="primary" className="w-full">
              Browse anime while you set up
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  if (notice) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-success/30 bg-success/10 text-success">
            <CheckIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-fg">
            {notice.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {notice.body}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant="primary"
              onClick={() => switchMode("signin")}
              className="w-full"
            >
              Back to sign in
            </Button>
            <LinkButton href="/discover" variant="ghost" className="w-full">
              Keep browsing
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

        {mode !== "forgot" ? (
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2/60 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "bg-surface-3 text-fg"
                  : "text-faint hover:text-muted"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-surface-3 text-fg"
                  : "text-faint hover:text-muted"
              }`}
            >
              Create account
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <Field label="Email" htmlFor="auth-email">
            <Input
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              required
            />
          </Field>

          {mode !== "forgot" ? (
            <Field
              label="Password"
              htmlFor="auth-password"
              hint={
                mode === "signup"
                  ? `At least ${MIN_PASSWORD_LENGTH} characters.`
                  : undefined
              }
            >
              <div className="relative">
                <Input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder={
                    mode === "signup"
                      ? `At least ${MIN_PASSWORD_LENGTH} characters`
                      : "Your password"
                  }
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
          ) : null}

          {mode === "signup" ? (
            <Field label="Confirm password" htmlFor="auth-confirm">
              <Input
                id="auth-confirm"
                name="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={busy}
                required
              />
            </Field>
          ) : null}

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
                Working…
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Back to sign in
            </button>
          )}
          <LinkButton href="/discover" variant="ghost" size="sm">
            Keep browsing
          </LinkButton>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
        Your library is private to your account. Kaze never posts publicly or
        shares your notes.
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  AlertIcon,
  CheckIcon,
  CompassIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
} from "@/components/icons";
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
      ? "Check your inbox"
      : mode === "signin"
        ? "Welcome back"
        : mode === "signup"
          ? "Create your vault"
          : "Reset your password";

  const subtitle =
    mode === "signin"
      ? "Sign in to synchronize your anime watch progress across devices."
      : mode === "signup"
        ? "Start tracking series, log episode milestones, and unlock analytics."
        : "We will email you a secure one-time link to configure a new password.";

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
          body: `We sent a secure activation link to ${cleanEmail}. Open it to verify your account and jump into Kaze.`,
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
        title: "Check your inbox",
        body: `If an account is associated with ${cleanEmail}, a secure password reset link has been dispatched.`,
      });
    } catch (submitError) {
      setError(mapAuthError(submitError));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-amber-500/10 blur-xl" />
        <div className="relative rounded-3xl border border-white/[0.12] bg-surface/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning shadow-inner">
            <AlertIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-fg sm:text-2xl">
            Connect Supabase to enable accounts
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            Discovery and anime details already operate live with the public AniList
            GraphQL API. Cloud authentication and your personal encrypted library require a Supabase project.
          </p>
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-surface-2/80 p-3.5 backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Required environment variables
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
              {SUPABASE_ENV_VARS.map((name) => (
                <li key={name} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Copy <code className="text-white/80">.env.example</code> to{" "}
            <code className="text-white/80">.env.local</code> and set your project
            credentials.
          </p>
          <div className="mt-6">
            <LinkButton
              href="/discover"
              variant="primary"
              className="h-11 w-full rounded-xl bg-accent font-semibold text-accent-contrast shadow-lg shadow-accent/25 hover:bg-accent-hover"
            >
              Browse anime while you set up
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  if (notice) {
    return (
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-emerald-500/15 blur-xl" />
        <div className="relative rounded-3xl border border-white/[0.12] bg-surface/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-inner">
            <CheckIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
            {notice.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {notice.body}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              variant="primary"
              onClick={() => switchMode("signin")}
              className="h-11 w-full rounded-xl bg-accent font-semibold text-accent-contrast shadow-lg shadow-accent/25 hover:bg-accent-hover"
            >
              Back to sign in
            </Button>
            <LinkButton
              href="/discover"
              variant="ghost"
              className="h-11 w-full rounded-xl border border-white/[0.08] hover:bg-white/[0.05]"
            >
              Keep browsing
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md">
      {/* Dynamic ambient halo behind login card */}
      <div className="pointer-events-none absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-accent/25 via-purple-500/10 to-accent/20 opacity-75 blur-2xl transition-all duration-500" />

      {/* Main Liquid-Glass Container */}
      <div className="relative rounded-3xl border border-white/[0.12] bg-surface/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
        {/* Card Header */}
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-muted sm:text-sm">{subtitle}</p>
        </div>

        {/* Tab Switcher */}
        {mode !== "forgot" ? (
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-surface-2/70 p-1 backdrop-blur-md"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                mode === "signin"
                  ? "bg-surface-3 text-white shadow-md border border-white/[0.12]"
                  : "text-muted hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                mode === "signup"
                  ? "bg-surface-3 text-white shadow-md border border-white/[0.12]"
                  : "text-muted hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              Create Account
            </button>
          </div>
        ) : null}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="Email address" htmlFor="auth-email">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                <MailIcon className="h-4 w-4" />
              </span>
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
                className="h-11 sm:h-12 pl-10 rounded-xl border-white/[0.1] bg-surface-2/80 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </Field>

          {mode !== "forgot" ? (
            <Field
              label="Password"
              htmlFor="auth-password"
              hint={
                mode === "signup"
                  ? `Minimum ${MIN_PASSWORD_LENGTH} characters.`
                  : undefined
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                  <LockIcon className="h-4 w-4" />
                </span>
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
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  className="h-11 sm:h-12 pl-10 pr-12 rounded-xl border-white/[0.1] bg-surface-2/80 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-faint transition-colors hover:bg-white/[0.08] hover:text-white"
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
          ) : null}

          {mode === "signup" ? (
            <Field label="Confirm password" htmlFor="auth-confirm">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                  <LockIcon className="h-4 w-4" />
                </span>
                <Input
                  id="auth-confirm"
                  name="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={busy}
                  className="h-11 sm:h-12 pl-10 rounded-xl border-white/[0.1] bg-surface-2/80 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                  required
                />
              </div>
            </Field>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs leading-relaxed text-danger"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="h-12 w-full rounded-xl bg-accent font-semibold text-accent-contrast shadow-lg shadow-accent/25 hover:bg-accent-hover active:scale-[0.98] transition-all"
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <LoaderIcon className="h-4 w-4 animate-spin" />
                <span>Authenticating…</span>
              </span>
            ) : mode === "signin" ? (
              "Sign In to Kaze"
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-xs">
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-muted transition-colors hover:text-white"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-muted transition-colors hover:text-white"
            >
              Back to sign in
            </button>
          )}
          <LinkButton
            href="/discover"
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white"
          >
            <CompassIcon className="h-3.5 w-3.5" />
            <span>Keep browsing</span>
          </LinkButton>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
        Your library and episode progress are encrypted and private to your account.
      </p>
    </div>
  );
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

/**
 * Handles Supabase email links. Supports the PKCE `code` flow and the
 * `token_hash` flow used by email templates.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=not_configured", url.origin),
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    console.error("[auth/callback] code exchange failed", error.message);
  } else if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    console.error("[auth/callback] OTP verification failed", error.message);
  }

  const failure = new URL("/login", url.origin);
  failure.searchParams.set("error", "link");
  failure.searchParams.set("next", next);
  return NextResponse.redirect(failure);
}

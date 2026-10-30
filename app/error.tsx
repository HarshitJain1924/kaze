"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] rendering failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState
        title="This page hit a snag"
        message="Something went wrong while rendering this page. Your saved library, ratings and episode progress are unaffected."
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}

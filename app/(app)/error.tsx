"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

/**
 * Boundary for the signed-in shell. The layout, navigation and library
 * context stay mounted, so a failed screen never blanks the whole app.
 */
export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] screen failed", error);
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title="This screen couldn't load"
        message="The page failed to render, but your library and progress are safe. Try again, or use the navigation to open another screen."
        action={
          <Button variant="primary" onClick={reset}>
            Reload this screen
          </Button>
        }
      />
    </div>
  );
}

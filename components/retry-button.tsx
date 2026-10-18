"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RetryButton({
  label = "Try again",
  variant = "secondary",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      {pending ? "Retrying…" : label}
    </Button>
  );
}

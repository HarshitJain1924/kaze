"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Anchors the dialog to the bottom edge on small screens. */
  mobileSheet?: boolean;
  className?: string;
}

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  mobileSheet = false,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className={cn(
        "max-h-[90dvh] w-full overflow-y-auto border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        "m-0 mt-auto rounded-t-2xl sm:m-auto sm:rounded-2xl",
        mobileSheet ? "sm:w-[calc(100%-2rem)]" : "w-[calc(100%-2rem)]",
        SIZES[size],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          {description ? (
            <p
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-muted"
            >
              {description}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mr-1 -mt-1"
        >
          <CloseIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-5 py-5 sm:px-6">{children}</div>

      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-2/40 p-4 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

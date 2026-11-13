"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

export type OpticalGlassProps<T extends React.ElementType = "div"> = {
  as?: T;
  variant?: "workspace" | "card" | "pill" | "interactive" | "nav" | "tint";
  interactive?: boolean;
} & React.ComponentPropsWithoutRef<T>;

/**
 * Optical Glass component adapted to Kaze's cinematic editorial design.
 *
 * Implements high optical clarity, minimal blur (preserving artwork recognition),
 * multi-layered Fresnel edge reflections, subtle SVG refraction distortion,
 * and restrained 60fps/120fps pointer-responsive specular highlights without heavy WebGL.
 */
export function OpticalGlass<T extends React.ElementType = "div">({
  as,
  variant = "card",
  interactive = true,
  className,
  children,
  onPointerMove,
  onPointerLeave,
  style,
  ...props
}: OpticalGlassProps<T>) {
  const Component = as || "div";
  const isMoving = useRef(false);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      (onPointerMove as React.PointerEventHandler<HTMLElement> | undefined)?.(e);
      if (!interactive || e.pointerType === "touch") return;

      const target = e.currentTarget;
      if (isMoving.current) return;
      isMoving.current = true;

      requestAnimationFrame(() => {
        isMoving.current = false;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        target.style.setProperty("--glass-x", `${x}%`);
        target.style.setProperty("--glass-y", `${y}%`);
      });
    },
    [interactive, onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      (onPointerLeave as React.PointerEventHandler<HTMLElement> | undefined)?.(e);
      if (!interactive || e.pointerType === "touch") return;
      const target = e.currentTarget;
      target.style.removeProperty("--glass-x");
      target.style.removeProperty("--glass-y");
    },
    [interactive, onPointerLeave],
  );

  const variantClass = {
    workspace: "optical-glass-workspace",
    card: "optical-glass",
    pill: "optical-glass-pill",
    interactive: "optical-glass-interactive",
    nav: "optical-glass-nav",
    tint: "optical-glass-tint",
  }[variant];

  return (
    <Component
      className={cn(variantClass, className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Lightweight SVG optical refraction filter.
 * Simulates delicate Snell's-law light displacement through physical glass.
 * Zero bundle-size overhead and zero external dependencies.
 */
export function OpticalGlassFilter() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-50 h-0 w-0 opacity-0 overflow-hidden"
    >
      <defs>
        <filter
          id="kaze-optical-refraction"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Subtle microscopic turbulence for authentic organic optical glass casting */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="1"
            result="noise"
          />
          {/* Restrained displacement scale (2.5px): light bends gently at edges without distorting text */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}


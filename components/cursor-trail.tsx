"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";

const TRAIL_LENGTH = 10;
const CALM_TRAIL_LENGTH = 3;
/** Base streak length in pixels before the speed scale is applied. */
const STREAK_LENGTH = 30;
const STREAK_THICKNESS = 2;

function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}
const subscribeFinePointer = subscribeToQuery("(any-pointer: fine)");
const subscribeReducedMotion = subscribeToQuery("(prefers-reduced-motion: reduce)");

function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia("(any-pointer: fine)").matches,
    () => false,
  );
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const streakStyle = {
  width: STREAK_LENGTH,
  height: STREAK_THICKNESS,
  borderRadius: "9999px",
  background: "currentColor",
  filter: "blur(0.4px)",
  willChange: "transform, opacity",
} as const;

/**
 * A wind trail: a short comet of accent-coloured air streaks that stretches
 * with pointer speed and settles into a faint smudge when the pointer stops.
 * There is no solid cursor disc — the native cursor stays visible.
 */
export function CursorTrail() {
  const { preferences } = usePreferences();
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const enabled = preferences.cursorEffect !== false;
  const active = enabled && finePointer;
  const count = reducedMotion ? CALM_TRAIL_LENGTH : TRAIL_LENGTH;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const streaks = Array.from(
      root.querySelectorAll<HTMLElement>("[data-cursor-streak]"),
    );
    if (streaks.length === 0) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    const points = streaks.map(() => ({ x: targetX, y: targetY }));
    const previous = streaks.map(() => ({ x: targetX, y: targetY }));
    let hovering = false;
    let visible = false;
    let frame = 0;

    const reveal = () => {
      if (visible) return;
      visible = true;
      root.style.opacity = "1";
      for (const point of points) {
        point.x = targetX;
        point.y = targetY;
      }
      for (const point of previous) {
        point.x = targetX;
        point.y = targetY;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      targetX = event.clientX;
      targetY = event.clientY;
      reveal();
    };

    const onPointerOver = (event: PointerEvent) => {
      const node = event.target;
      hovering =
        node instanceof Element &&
        Boolean(
          node.closest(
            "a, button, [role='button'], input, textarea, select, summary, [data-cursor='interactive']",
          ),
        );
    };

    const onLeave = () => {
      visible = false;
      root.style.opacity = "0";
    };

    const tick = () => {
      // The calm variant follows exactly; the full one eases so the tail drags.
      const headFollow = reducedMotion ? 1 : 0.45;
      const tailFollow = 0.35;

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const prior = points[index - 1];
        if (!point) continue;

        const towardsX = prior ? prior.x : targetX;
        const towardsY = prior ? prior.y : targetY;
        const follow = prior ? tailFollow : headFollow;
        point.x += (towardsX - point.x) * follow;
        point.y += (towardsY - point.y) * follow;

        const last = previous[index];
        const dx = point.x - (last?.x ?? point.x);
        const dy = point.y - (last?.y ?? point.y);
        const speed = Math.hypot(dx, dy);
        const angle = speed > 0.4 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
        const stretch = Math.min(1.35, Math.max(0.14, speed * 0.09));
        const falloff = 1 - index / (points.length + 2);
        const glow = hovering ? 1.35 : 1;
        const opacity = Math.min(0.85, (0.34 + Math.min(speed, 22) * 0.014) * falloff * glow);

        streaks[index]?.style.setProperty(
          "transform",
          `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) rotate(${angle}deg) scaleX(${stretch}) scaleY(${1 + (1 - falloff) * 1.6})`,
        );
        streaks[index]?.style.setProperty("opacity", String(opacity));

        if (last) {
          last.x = point.x;
          last.y = point.y;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active, reducedMotion]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] text-accent opacity-0 transition-opacity duration-300"
    >
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          data-cursor-streak
          className="absolute left-0 top-0 block"
          style={streakStyle}
        />
      ))}
    </div>
  );
}

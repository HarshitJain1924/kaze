"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";

const TRAIL_DOTS = 6;
const LENS_SIZE = 20;
const DOT_SIZE = 12;

/* Media queries as external stores: SSR always reports false, so the effect is
   never part of the server markup and cannot cause a hydration mismatch. */
function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}
const subscribeFinePointer = subscribeToQuery("(pointer: fine)");
const subscribeReducedMotion = subscribeToQuery("(prefers-reduced-motion: reduce)");

function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia("(pointer: fine)").matches,
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

const glassSurface = (size: number, blur: number, strength: number) => ({
  width: size,
  height: size,
  borderRadius: "9999px",
  border: "1px solid rgba(255,255,255,0.42)",
  background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,${strength}), rgba(255,255,255,${strength * 0.28}) 46%, rgba(255,255,255,0) 72%)`,
  backdropFilter: `blur(${blur}px) saturate(170%)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(170%)`,
  boxShadow:
    "inset 0 1px 2px rgba(255,255,255,0.55), inset 0 -2px 5px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.22)",
  willChange: "transform, opacity",
});

/**
 * Liquid-glass pointer trail: a clear lens that follows the cursor with a short,
 * softly lagging trail of droplets behind it. Purely decorative — the native
 * cursor stays, nothing is captured, and it is off for touch and reduced motion.
 */
export function CursorGlass() {
  const { preferences } = usePreferences();
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const enabled = preferences.cursorEffect !== false;
  const active = enabled && finePointer && !reducedMotion;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const lens = root.querySelector<HTMLElement>("[data-cursor-lens]");
    const dots = Array.from(
      root.querySelectorAll<HTMLElement>("[data-cursor-dot]"),
    );
    if (!lens) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let lensX = targetX;
    let lensY = targetY;
    let hovering = false;
    let pressed = false;
    let visible = false;
    let frame = 0;

    const dotState = dots.map(() => ({ x: targetX, y: targetY }));

    const reveal = () => {
      if (visible) return;
      visible = true;
      root.style.opacity = "1";
      lensX = targetX;
      lensY = targetY;
      for (const dot of dotState) {
        dot.x = targetX;
        dot.y = targetY;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      targetX = event.clientX;
      targetY = event.clientY;
      reveal();
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target;
      hovering =
        target instanceof Element &&
        Boolean(
          target.closest(
            "a, button, [role='button'], input, textarea, select, summary, [data-cursor='interactive']",
          ),
        );
    };

    const onPointerDown = () => {
      pressed = true;
    };
    const onPointerUp = () => {
      pressed = false;
    };
    const onLeave = () => {
      visible = false;
      root.style.opacity = "0";
    };

    const tick = () => {
      lensX += (targetX - lensX) * 0.3;
      lensY += (targetY - lensY) * 0.3;

      const scale = (hovering ? 1.85 : 1) * (pressed ? 0.82 : 1);
      lens.style.transform = `translate3d(${lensX}px, ${lensY}px, 0) translate(-50%, -50%) scale(${scale})`;
      lens.style.opacity = hovering ? "0.95" : "0.72";

      let prevX = lensX;
      let prevY = lensY;
      dots.forEach((dot, index) => {
        const state = dotState[index];
        if (!state) return;
        state.x += (prevX - state.x) * 0.45;
        state.y += (prevY - state.y) * 0.45;
        const shrink = 1 - index / (dots.length + 3);
        dot.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) translate(-50%, -50%) scale(${shrink})`;
        dot.style.opacity = String(Math.max(0.05, 0.34 - index * 0.05));
        prevX = state.x;
        prevY = state.y;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] opacity-0 transition-opacity duration-300"
    >
      {Array.from({ length: TRAIL_DOTS }).map((_, index) => (
        <span
          key={index}
          data-cursor-dot
          className="absolute left-0 top-0 block"
          style={glassSurface(DOT_SIZE, 1, 0.42)}
        />
      ))}
      <span
        data-cursor-lens
        className="absolute left-0 top-0 block"
        style={glassSurface(LENS_SIZE, 2.5, 0.6)}
      />
    </div>
  );
}

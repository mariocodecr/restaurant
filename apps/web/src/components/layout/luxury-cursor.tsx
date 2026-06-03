"use client";

import { useEffect, useRef, useState } from "react";

// Adapted from 21st.dev "Cursor Follower" — two-element dot + ring with
// smooth lerp follow and hover-grow on interactive elements. Colors tuned
// to match the stardust button palette (icy blue glow).

const DOT_LERP = 0.25;
const RING_LERP = 0.12;
const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, [role='button'], [data-cursor-interactive]";

export function LuxuryCursor() {
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState({ dot: { x: -100, y: -100 }, ring: { x: -100, y: -100 } });
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const target = useRef({ x: 0, y: 0 });
  const dotRef = useRef({ x: 0, y: 0 });
  const ringRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Skip on touch / coarse pointer devices — no point hiding the system
    // cursor if there isn't one to begin with.
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;

    setEnabled(true);
    document.documentElement.classList.add("luxury-cursor-active");

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    const enterHover = () => setHovering(true);
    const leaveHover = () => setHovering(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    // Delegate enter/leave to body and check via closest() — survives DOM
    // updates without re-attaching listeners on every render.
    const onOver = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.(INTERACTIVE_SELECTOR)) enterHover();
    };
    const onOut = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.(INTERACTIVE_SELECTOR)) leaveHover();
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let raf = 0;
    const tick = () => {
      dotRef.current.x = lerp(dotRef.current.x, target.current.x, DOT_LERP);
      dotRef.current.y = lerp(dotRef.current.y, target.current.y, DOT_LERP);
      ringRef.current.x = lerp(ringRef.current.x, target.current.x, RING_LERP);
      ringRef.current.y = lerp(ringRef.current.y, target.current.y, RING_LERP);
      setPos({
        dot: { x: dotRef.current.x, y: dotRef.current.y },
        ring: { x: ringRef.current.x, y: ringRef.current.y },
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("luxury-cursor-active");
    };
  }, []);

  if (!enabled) return null;

  const ringSize = hovering ? 56 : 36;
  const dotSize = pressed ? 6 : 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div
        className="absolute rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          left: pos.dot.x,
          top: pos.dot.y,
          transform: "translate(-50%, -50%)",
          backgroundColor: "rgba(212, 163, 92, 0.95)",
          boxShadow: "0 0 12px rgba(255, 196, 110, 0.85), 0 0 24px rgba(212, 163, 92, 0.55)",
          transition: "width 0.12s ease, height 0.12s ease",
        }}
      />
      <div
        className="absolute rounded-full border"
        style={{
          width: ringSize,
          height: ringSize,
          left: pos.ring.x,
          top: pos.ring.y,
          transform: "translate(-50%, -50%)",
          borderColor: "rgba(212, 163, 92, 0.6)",
          boxShadow: hovering
            ? "0 0 30px rgba(212, 163, 92, 0.4) inset, 0 0 20px rgba(255, 196, 110, 0.3)"
            : "0 0 10px rgba(212, 163, 92, 0.22)",
          backgroundColor: hovering ? "rgba(212, 163, 92, 0.08)" : "transparent",
          transition:
            "width 0.25s ease, height 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease",
        }}
      />
    </div>
  );
}

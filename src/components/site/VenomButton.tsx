"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type VenomButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

type PointerState = { x: number; y: number; width: number; height: number } | null;

/**
 * Organic "symbiote" CTA: the pill stays anchored while a viscous strand
 * stretches toward a nearby mouse pointer. Touch and reduced-motion users
 * get the same button without the pointer effect.
 */
export default function VenomButton({ href, children, className = "" }: VenomButtonProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const [pointer, setPointer] = useState<PointerState>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;

    let frame = 0;
    let latest: PointerEvent | null = null;

    const update = () => {
      frame = 0;
      if (!latest || latest.pointerType !== "mouse") {
        setPointer(null);
        return;
      }

      const rect = node.getBoundingClientRect();
      const x = latest.clientX - rect.left;
      const y = latest.clientY - rect.top;
      const nearestX = Math.max(0, Math.min(rect.width, x));
      const nearestY = Math.max(0, Math.min(rect.height, y));
      const dx = x - nearestX;
      const dy = y - nearestY;
      const distance = Math.hypot(dx, dy);

      if (distance <= 150 && distance > 2) {
        setPointer({ x, y, width: rect.width, height: rect.height });
      } else {
        setPointer(null);
      }
    };

    const onMove = (event: PointerEvent) => {
      latest = event;
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const onLeaveWindow = () => {
      latest = null;
      setPointer(null);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", onLeaveWindow);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onLeaveWindow);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const width = pointer?.width ?? 240;
  const height = pointer?.height ?? 56;
  const offset = 150;
  const cursorX = (pointer?.x ?? width / 2) + offset;
  const cursorY = (pointer?.y ?? height / 2) + offset;
  const anchorX = pointer ? Math.max(offset, Math.min(width + offset, cursorX)) : width / 2 + offset;
  const anchorY = pointer ? Math.max(offset, Math.min(height + offset, cursorY)) : height / 2 + offset;
  const dx = cursorX - anchorX;
  const dy = cursorY - anchorY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const strand = pointer
    ? `M ${anchorX + nx * 12} ${anchorY + ny * 12} C ${anchorX + dx * 0.35 + nx * 22} ${anchorY + dy * 0.35 + ny * 22}, ${cursorX - dx * 0.2 + nx * 9} ${cursorY - dy * 0.2 + ny * 9}, ${cursorX} ${cursorY} C ${cursorX - dx * 0.2 - nx * 9} ${cursorY - dy * 0.2 - ny * 9}, ${anchorX + dx * 0.35 - nx * 22} ${anchorY + dy * 0.35 - ny * 22}, ${anchorX - nx * 12} ${anchorY - ny * 12} Z`
    : "";

  return (
    <a
      ref={rootRef}
      href={href}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
      className={`venom-button ${pressed ? "is-pressed" : ""} ${className}`}
    >
      <svg
        aria-hidden="true"
        className="venom-button__goo"
        viewBox={`0 0 ${width + offset * 2} ${height + offset * 2}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="venom-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <linearGradient id="venom-liquid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#34383d" />
            <stop offset="0.42" stopColor="#08090b" />
            <stop offset="0.78" stopColor="#171a1e" />
            <stop offset="1" stopColor="#030405" />
          </linearGradient>
        </defs>
        <g filter="url(#venom-goo)">
          <rect
            x={offset}
            y={offset}
            width={width}
            height={height}
            rx={height / 2}
            fill="url(#venom-liquid)"
          />
          {pointer && (
            <>
              <path d={strand} fill="url(#venom-liquid)" />
              <circle cx={cursorX} cy={cursorY} r="15" fill="url(#venom-liquid)" />
            </>
          )}
        </g>
      </svg>
      <span className="venom-button__surface" aria-hidden="true" />
      <span className="venom-button__label">{children}</span>
      <span className="venom-button__shine" aria-hidden="true" />
    </a>
  );
}

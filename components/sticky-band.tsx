"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * One layer of a stacked-sticky-headers UI (nav -> page header -> tab bar).
 *
 * Stacking multiple `position: sticky` elements only works gap-free if each
 * one's `top` exactly equals the real rendered height of everything stuck
 * above it. Hard-coding that in rem/px drifts the moment content wraps to a
 * second line or an agent's name is long -- which is exactly what showed up
 * as a gap with scrolled content bleeding through. This measures its own
 * height live (ResizeObserver, not a one-time read) and publishes it to a CSS
 * var, so whatever stacks below it via `top` can reference that var and stay
 * correct automatically.
 */
export function StickyBand({
  top,
  publishHeightAs,
  className,
  children,
}: {
  /** Raw CSS `top` value/expression, e.g. `"var(--content-top, 0px)"`. */
  top: string;
  /** CSS custom property name this band's own height gets published to. */
  publishHeightAs?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !publishHeightAs) return;
    const update = () =>
      document.documentElement.style.setProperty(publishHeightAs, `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [publishHeightAs]);

  return (
    <div ref={ref} className={className} style={{ position: "sticky", top }}>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fire `cb` on a repeating interval. Pass `null` for `delay` to pause.
 * Mirrors the classic Dan Abramov pattern — the callback ref is updated
 * each render so consumers don't need useCallback to avoid restarts.
 */
export function useInterval(cb: () => void, delay: number | null): void {
  const savedCb = useRef<() => void>(cb);

  useEffect(() => {
    savedCb.current = cb;
  }, [cb]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCb.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Monotonically-advancing counter, wraps at `max + 1`. Useful for driving
 * cyclic UI animations without each consumer wiring up their own setInterval.
 */
export function useTicker(step: number = 1, max: number = Infinity, delay: number = 1000): number {
  const [n, setN] = useState<number>(0);
  useInterval(() => setN((x) => (x + step) % (max + 1)), delay);
  return n;
}

/**
 * Smooth-counts from 0 to `target` over `ms`. Cubic ease-out.
 * Re-runs whenever `target` changes.
 */
export function useCountUp(target: number, ms: number = 1400): number {
  const [n, setN] = useState<number>(0);

  useEffect(() => {
    let start: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return n;
}

/**
 * A live "now" Date ticking every `intervalMs`. Used for the live-feed
 * UTC timestamp chip in the portal surface.
 */
export function useNow(intervalMs: number = 1000): Date {
  const [n, setN] = useState<Date>(() => new Date());
  useInterval(() => setN(new Date()), intervalMs);
  return n;
}

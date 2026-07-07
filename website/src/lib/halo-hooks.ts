"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * One-shot IntersectionObserver reveal. Returns a stable `ref` setter and a
 * `visible` boolean that flips to `true` the first time the element crosses
 * the threshold, then stops observing. Consumers bind the ref to the root
 * element and toggle the `.reveal` / `.is-visible` CSS classes from
 * globals.css, which already carries the motion + reduced-motion guards.
 *
 * Example:
 *   const { ref, visible } = useReveal<HTMLDivElement>();
 *   <div ref={ref} className={`reveal ${visible ? "is-visible" : ""}`}>...</div>
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  threshold: number = 0.12,
): { ref: (node: T | null) => void; visible: boolean } {
  const [visible, setVisible] = useState<boolean>(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      // Disconnect when the node unmounts or is replaced.
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      nodeRef.current = node;
      if (!node || typeof IntersectionObserver === "undefined") return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            observerRef.current = null;
          }
        },
        { threshold, rootMargin: "0px 0px -40px 0px" },
      );
      obs.observe(node);
      observerRef.current = obs;
    },
    [threshold],
  );

  // Safety net: disconnect if the component unmounts without the ref callback
  // being called with `null` first.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { ref: setRef, visible };
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

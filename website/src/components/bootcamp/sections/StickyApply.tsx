"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { nav, pricing } from "@/components/bootcamp/content";
import { ButtonLink, motion, useReducedMotion } from "@/components/bootcamp/ui";

/**
 * Persistent mobile Apply bar. Fades in once the hero scrolls away so the
 * primary action stays one tap from anywhere on the long mobile scroll.
 * Hidden on md+ (the desktop nav keeps a visible CTA).
 */
export default function StickyApply() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="bp-glass-strong flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 shadow-2xl">
            <div className="min-w-0 pl-1.5">
              <p className="truncate text-[13px] font-semibold bp-fg">
                Build your AI product
              </p>
              <p className="truncate text-[11.5px] bp-muted">
                {pricing.price} · 25 seats only
              </p>
            </div>
            <ButtonLink href={nav.cta.href} icon className="shrink-0">
              {nav.cta.label}
            </ButtonLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

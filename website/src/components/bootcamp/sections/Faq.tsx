"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { faqs } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  GlassCard,
  Stagger,
  Item,
  Plus,
  Minus,
  motion,
  useReducedMotion,
} from "@/components/bootcamp/ui";

export default function Faq() {
  const reduce = useReducedMotion();
  // First question opens by default for a warm, inviting state.
  const [open, setOpen] = useState<number>(0);

  return (
    <Section id="faq">
      <SectionHeading eyebrow={faqs.eyebrow} title={faqs.title} align="center" />

      <Stagger className="mx-auto mt-12 grid max-w-3xl gap-3 sm:gap-4">
        {faqs.items.map((item, i) => {
          const isOpen = open === i;
          const panelId = `bp-faq-panel-${i}`;
          const buttonId = `bp-faq-button-${i}`;

          return (
            <Item key={item.q}>
              <GlassCard
                edge={isOpen}
                className={`overflow-hidden transition-colors duration-300 ${
                  isOpen ? "bp-glass-strong" : ""
                }`}
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="group flex w-full items-center gap-4 px-5 py-5 text-left sm:px-7 sm:py-6"
                  >
                    <span
                      className={`flex-1 font-display text-[16px] font-medium leading-snug tracking-tight transition-colors sm:text-[17px] ${
                        isOpen ? "bp-fg" : "bp-fg group-hover:text-[color:var(--bp-iris)]"
                      }`}
                    >
                      {item.q}
                    </span>

                    <span
                      aria-hidden="true"
                      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                        isOpen
                          ? "border-[color:var(--bp-border-strong)] bg-[color:var(--bp-bg-3)]"
                          : "border-[color:var(--bp-border)] group-hover:border-[color:var(--bp-border-strong)]"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isOpen ? (
                          <motion.span
                            key="minus"
                            initial={reduce ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
                            animate={reduce ? undefined : { opacity: 1, rotate: 0, scale: 1 }}
                            exit={reduce ? undefined : { opacity: 0, rotate: 90, scale: 0.6 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <Minus className="h-[18px] w-[18px] bp-iris" aria-hidden="true" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="plus"
                            initial={reduce ? false : { opacity: 0, rotate: 90, scale: 0.6 }}
                            animate={reduce ? undefined : { opacity: 1, rotate: 0, scale: 1 }}
                            exit={reduce ? undefined : { opacity: 0, rotate: -90, scale: 0.6 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <Plus className="h-[18px] w-[18px] bp-muted" aria-hidden="true" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      key="content"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 sm:px-7 sm:pb-6">
                        <div className="mb-4 h-px w-full bg-[color:var(--bp-border)]" />
                        <p className="max-w-[58ch] text-[15px] leading-relaxed bp-muted">
                          {item.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </Item>
          );
        })}
      </Stagger>
    </Section>
  );
}

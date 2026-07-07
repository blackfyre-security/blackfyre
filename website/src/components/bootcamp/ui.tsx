"use client";

import {
  motion,
  useReducedMotion,
  type Variants,
  type HTMLMotionProps,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  Sparkles,
  Star,
  Quote,
  Plus,
  Minus,
  Menu,
  X,
  Users,
  ShieldCheck,
  Zap,
  Clock,
  TrendingUp,
  GraduationCap,
  Lightbulb,
  Timer,
  Layers,
  Rocket,
  Globe,
  Presentation,
  Trophy,
  type LucideProps,
} from "lucide-react";
import { type ComponentType, type ReactNode, type ElementType } from "react";

/* ════════════════════════════════════════════════════════════════
   Shared primitives for the bootcamp landing page. Every section
   composes from these so motion, glass, and rhythm stay consistent.
   ════════════════════════════════════════════════════════════════ */

/* ── Motion variants ───────────────────────────────────────────── */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const VIEWPORT = { once: true, amount: 0.2 } as const;

/* ── Reveal: fade/slide a block in on scroll (reduced-motion safe) ─ */
interface RevealProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
  delay?: number;
  variant?: Variants;
  as?: keyof typeof motion;
}
export function Reveal({ children, delay = 0, variant = fadeUp, className, as = "div", ...rest }: RevealProps) {
  const reduce = useReducedMotion();
  // Honor `as` so callers can render semantic tags (e.g. <Reveal as="li">).
  const Cmp = (motion[as] ?? motion.div) as ElementType;
  return (
    <Cmp
      className={className}
      variants={variant}
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={VIEWPORT}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </Cmp>
  );
}

/* ── Stagger group + item ──────────────────────────────────────── */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={container}
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}
export function Item({
  children,
  className,
  variant = fadeUp,
  ...rest
}: { children: ReactNode; className?: string; variant?: Variants } & HTMLMotionProps<"div">) {
  return (
    <motion.div className={className} variants={variant} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── Section shell — consistent vertical rhythm + max width ─────── */
export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 ${className}`}
    >
      <div className="relative mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/* ── Eyebrow pill ──────────────────────────────────────────────── */
export function Eyebrow({ children, icon = true }: { children: ReactNode; icon?: boolean }) {
  return (
    <span className="bp-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-wide bp-muted">
      {icon && <Sparkles className="h-3.5 w-3.5 bp-iris" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── Section heading ───────────────────────────────────────────── */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const center = align === "center";
  return (
    <Reveal
      className={`${center ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}
      variant={blurUp}
    >
      {eyebrow && (
        <div className={center ? "flex justify-center" : ""}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      )}
      <h2 className="mt-5 font-display text-[clamp(30px,5vw,48px)] font-semibold leading-[1.05] tracking-[-0.02em] bp-fg [text-wrap:balance]">
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 text-[16px] leading-relaxed bp-muted ${center ? "mx-auto" : ""} max-w-xl`}>
          {sub}
        </p>
      )}
    </Reveal>
  );
}

/* ── Glass card (optional hover lift) ──────────────────────────── */
export function GlassCard({
  children,
  className = "",
  hover = false,
  strong = false,
  edge = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  strong?: boolean;
  edge?: boolean;
}) {
  const reduce = useReducedMotion();
  const base = `${strong ? "bp-glass-strong" : "bp-glass"} ${edge ? "bp-edge" : ""} rounded-2xl`;
  if (!hover) return <div className={`${base} ${className}`}>{children}</div>;
  return (
    <motion.div
      className={`${base} ${className}`}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

/* ── Buttons (render as anchors) ───────────────────────────────── */
type BtnProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
  icon?: boolean;
  className?: string;
};
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  icon = false,
  className = "",
}: BtnProps) {
  const reduce = useReducedMotion();
  const sizing = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-[14px]";
  const look =
    variant === "primary"
      ? "text-white bp-cta-glow"
      : "bp-glass bp-fg hover:border-[color:var(--bp-border-strong)]";
  return (
    <motion.a
      href={href}
      whileHover={reduce ? undefined : { scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-colors ${sizing} ${look} ${className}`}
      style={variant === "primary" ? { backgroundImage: "var(--bp-grad)" } : undefined}
    >
      {children}
      {icon && (
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      )}
    </motion.a>
  );
}

/* ── Gradient text helper ──────────────────────────────────────── */
export function Gradient({ children, ember = false }: { children: ReactNode; ember?: boolean }) {
  return <span className={ember ? "bp-grad-text-ember" : "bp-grad-text"}>{children}</span>;
}

/* ── Icon resolver — string name → lucide icon (curated, safe) ──── */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  ArrowRight, Check, Sparkles, Star, Quote, Plus, Minus, Menu, X, Users,
  ShieldCheck, Zap, Clock, TrendingUp, GraduationCap, Lightbulb, Timer,
  Layers, Rocket, Globe, Presentation, Trophy,
};
export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Sparkles;
  return <Cmp className={className} aria-hidden="true" />;
}

/* Re-export common icons so section files can import from one place. */
export {
  ArrowRight, Check, Sparkles, Star, Quote, Plus, Minus, Menu, X, Users,
  ShieldCheck, Zap, Clock, TrendingUp, GraduationCap, Lightbulb, Timer,
  Layers, Rocket, Globe, Presentation, Trophy, motion, useReducedMotion,
};

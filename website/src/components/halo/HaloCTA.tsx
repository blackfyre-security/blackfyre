import Link from "next/link";

interface HaloCTAProps {
  title: string;
  sub?: string;
  titleAccent?: string;
  eyebrow?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/**
 * Reusable CTA band. Renders the radial accent glow, a display heading with
 * an optional italic accent word, and up to two buttons.
 *
 * Example:
 *   <HaloCTA title="Ready to see it live?" titleAccent="live" sub="..." />
 */
export default function HaloCTA({
  title,
  sub,
  titleAccent,
  eyebrow = "§ Start",
  primaryLabel = "Talk to us",
  primaryHref = "/contact",
  secondaryLabel = "Book a call",
  secondaryHref = "/contact",
}: HaloCTAProps) {
  const renderTitle = () => {
    if (!titleAccent) return title;
    const idx = title.toLowerCase().indexOf(titleAccent.toLowerCase());
    if (idx === -1) return title;
    const before = title.slice(0, idx);
    const match = title.slice(idx, idx + titleAccent.length);
    const after = title.slice(idx + titleAccent.length);
    return (
      <>
        {before}
        <span className="halo-italic">{match}</span>
        {after}
      </>
    );
  };

  return (
    <section className="relative overflow-hidden border-t border-border bg-halo-radial px-6 py-24 text-center md:px-12 md:py-28">
      <div className="mx-auto max-w-[820px]">
        <p className="halo-eyebrow justify-center">{eyebrow}</p>
        <h2 className="mt-4 font-display text-[clamp(40px,6vw,64px)] font-medium leading-[1] tracking-display text-text [text-wrap:balance]">
          {renderTitle()}
        </h2>
        {sub && (
          <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-text-muted">
            {sub}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {primaryLabel && primaryHref && (
            <Link href={primaryHref} className="halo-btn-accent">
              {primaryLabel} <span className="halo-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          )}
          {secondaryLabel && secondaryHref && (
            <Link href={secondaryHref} className="halo-btn-ghost">
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

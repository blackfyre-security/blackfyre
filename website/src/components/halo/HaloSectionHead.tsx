import { cn } from "@/lib/utils";

interface HaloSectionHeadProps {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  blurb?: string;
  align?: "center" | "left";
  className?: string;
}

/**
 * Shared section heading: mono eyebrow, display title (with optional italic
 * accent word), optional muted blurb. Centered by default.
 */
export default function HaloSectionHead({
  eyebrow,
  title,
  titleAccent,
  blurb,
  align = "center",
  className,
}: HaloSectionHeadProps) {
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
    <div
      className={cn(
        "mx-auto max-w-[720px]",
        align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <p
        className={cn(
          "halo-eyebrow",
          align === "center" && "justify-center",
        )}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3.5 font-display text-[clamp(34px,4.2vw,52px)] font-medium leading-[1.02] tracking-display text-text [text-wrap:balance]">
        {renderTitle()}
      </h2>
      {blurb && (
        <p
          className={cn(
            "mt-4 text-[17px] leading-relaxed text-text-muted",
            align === "center" ? "mx-auto max-w-prose" : "max-w-prose",
          )}
        >
          {blurb}
        </p>
      )}
    </div>
  );
}

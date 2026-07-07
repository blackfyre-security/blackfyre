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
 * accent word), optional muted blurb. Left-aligned by default for dense
 * portal layouts.
 */
export default function HaloSectionHead({
  eyebrow,
  title,
  titleAccent,
  blurb,
  align = "left",
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

  const wrapperCls = [
    align === "center" ? "mx-auto max-w-[720px] text-center" : "text-left",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const eyebrowCls = [
    "halo-eyebrow",
    align === "center" ? "justify-center" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperCls}>
      <p className={eyebrowCls}>{eyebrow}</p>
      <h2
        className="mt-2 font-semibold leading-tight tracking-tight"
        style={{ fontSize: 24, letterSpacing: "-0.025em", color: "var(--text-primary)" }}
      >
        {renderTitle()}
      </h2>
      {blurb && (
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", maxWidth: "56ch" }}>
          {blurb}
        </p>
      )}
    </div>
  );
}

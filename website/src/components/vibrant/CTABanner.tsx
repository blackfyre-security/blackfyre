import { LimeButton, GhostButton } from "./buttons";

interface CTABannerProps {
  dotLabel: string;
  title: string;
  primaryLabel: string;
  primaryHref: string;
  primaryExternal?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/** Dark inset banner with a lime primary action (the "Start the Build" pattern). */
export default function CTABanner({
  dotLabel,
  title,
  primaryLabel,
  primaryHref,
  primaryExternal,
  secondaryLabel,
  secondaryHref,
}: CTABannerProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-zinc-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c6f24e] opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c6f24e]" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{dotLabel}</p>
          <p className="mt-0.5 text-[15px] font-semibold">{title}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {secondaryLabel && secondaryHref && (
          <GhostButton href={secondaryHref} on="dark">
            {secondaryLabel}
          </GhostButton>
        )}
        <LimeButton href={primaryHref} external={primaryExternal}>
          {primaryLabel}
        </LimeButton>
      </div>
    </div>
  );
}

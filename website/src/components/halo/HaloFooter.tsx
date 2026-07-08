import Link from "next/link";
import { DOCS, SITE, SOCIALS } from "@/data/site";

// Resolve a docs URL by a title fragment so column links stay bound to the
// single source of truth in @/data/site. Falls back to the repo root.
function docUrl(needle: string): string {
  const hit = DOCS.find((d) =>
    d.title.toLowerCase().includes(needle.toLowerCase()),
  );
  return hit?.url ?? SITE.repoUrl;
}

interface FooterLink {
  label: string;
  href: string;
}
interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "/platform" },
      { label: "Auditors", href: "/agents" },
      { label: "Frameworks", href: "/platform#frameworks" },
      { label: "Security", href: "/security" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Self-host", href: "/self-host" },
      { label: "Roadmap", href: docUrl("Roadmap") },
      { label: "Changelog", href: `${SITE.repoUrl}/releases` },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: SITE.repoUrl },
      { label: "Contribute", href: "/contribute" },
      { label: "Governance", href: docUrl("Governance") },
      { label: "Code of Conduct", href: docUrl("Code of Conduct") },
      { label: "Security policy", href: docUrl("Security Policy") },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "License (Apache-2.0)", href: docUrl("License") },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Trademark", href: docUrl("Trademark") },
    ],
  },
];

const isExternal = (href: string) => /^https?:\/\//.test(href);

function FooterAnchor({ link }: { link: FooterLink }) {
  const className =
    "text-[13px] text-text-muted transition-colors hover:text-text";
  if (isExternal(link.href)) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

// Brand SVGs inlined — Lucide no longer ships brand glyphs.
const SOCIAL_ICONS: Record<string, JSX.Element> = {
  GitHub: (
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  ),
  LinkedIn: (
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  ),
  X: (
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  ),
  Instagram: (
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.802c-3.155 0-3.508.012-4.747.069-1.013.046-1.566.215-1.932.357-.486.189-.833.414-1.197.778-.364.364-.589.711-.778 1.197-.142.366-.311.919-.357 1.932-.057 1.239-.069 1.592-.069 4.747s.012 3.508.069 4.747c.046 1.013.215 1.566.357 1.932.189.486.414.833.778 1.197.364.364.711.589 1.197.778.366.142.919.311 1.932.357 1.239.057 1.592.069 4.747.069s3.508-.012 4.747-.069c1.013-.046 1.566-.215 1.932-.357.486-.189.833-.414 1.197-.778.364-.364.589-.711.778-1.197.142-.366.311-.919.357-1.932.057-1.239.069-1.592.069-4.747s-.012-3.508-.069-4.747c-.046-1.013-.215-1.566-.357-1.932-.189-.486-.414-.833-.778-1.197-.364-.364-.711-.589-1.197-.778-.366-.142-.919-.311-1.932-.357-1.239-.057-1.592-.069-4.747-.069zm0 3.064a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666zm5.338-9.87a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
  ),
};

function BrandBlock() {
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/blackfyre-logomark.png"
        alt="Blackfyre"
        width={295}
        height={64}
        className="h-auto w-auto max-h-16 max-w-full"
      />
      <p className="halo-label mt-3">Open source &middot; Apache-2.0</p>
      <p className="mt-4 max-w-[300px] text-[13px] leading-relaxed text-text-muted">
        Open-source multi-cloud compliance &amp; security. 55 auditors, 9
        frameworks, 678 controls across AWS, Azure, GCP and on-prem &mdash;
        self-host free forever.
      </p>
    </div>
  );
}

export default function HaloFooter() {
  return (
    <footer className="border-t border-border px-6 pb-12 pt-16 md:px-12">
      <div className="mx-auto grid max-w-[1280px] gap-12 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        <BrandBlock />
        {COLUMNS.map((col) => (
          <div key={col.title} className="sm:pt-3 lg:pt-4">
            <p className="halo-label mb-4">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <FooterAnchor link={l} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-[1280px] border-t border-border pt-6">
        <div className="flex flex-col-reverse items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <p className="halo-label">&copy; 2026 Blackfyre</p>
            <p className="max-w-[520px] text-[12px] leading-relaxed text-text-dim">
              Blackfyre is open source under Apache-2.0. The name and logo are
              trademarks &mdash; forks must rename.
            </p>
          </div>
          <div className="flex items-center gap-3 text-text-muted">
            {SOCIALS.map((s) => {
              const icon = SOCIAL_ICONS[s.label];
              if (!icon) return null;
              return (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="transition-colors hover:text-text"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    {icon}
                  </svg>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

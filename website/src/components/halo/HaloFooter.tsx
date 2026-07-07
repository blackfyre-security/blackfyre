import Link from "next/link";

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "/platform" },
      { label: "Agents", href: "/agents" },
      { label: "Pricing", href: "/contact" },
      { label: "Changelog", href: "/blog" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "vCISO", href: "/services" },
      { label: "VAPT", href: "/services" },
      { label: "Compliance advisory", href: "/services" },
      { label: "Web development", href: "/webapp" },
      { label: "Mobile apps", href: "/mobile" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "SOC 2", href: "/services" },
      { label: "ISO 27001", href: "/services" },
      { label: "DPDPA", href: "/services" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Security", href: "/security" },
      { label: "Privacy", href: "/privacy" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

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
      <p className="halo-label mt-3">
        Security &middot; Chennai &middot; 2026
      </p>
      <p className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-text-muted">
        Autonomous compliance infrastructure. SOC 2, ISO 27001, HIPAA, NIST,
        DPDPA &mdash; on one posture.
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
                  <Link
                    href={l.href}
                    className="text-[13px] text-text-muted transition-colors hover:text-text"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-[1280px] border-t border-border pt-6">
        <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="halo-label">
            &copy; 2026 Blackfyre, Inc. &middot; Built in Chennai
          </p>
          <div className="flex items-center gap-3 text-text-muted">
            {/* Brand SVGs inlined — Lucide 1.7 no longer ships brand glyphs. */}
            <a
              href="https://www.instagram.com/blackfyre_technologies/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="transition-colors hover:text-text"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.802c-3.155 0-3.508.012-4.747.069-1.013.046-1.566.215-1.932.357-.486.189-.833.414-1.197.778-.364.364-.589.711-.778 1.197-.142.366-.311.919-.357 1.932-.057 1.239-.069 1.592-.069 4.747s.012 3.508.069 4.747c.046 1.013.215 1.566.357 1.932.189.486.414.833.778 1.197.364.364.711.589 1.197.778.366.142.919.311 1.932.357 1.239.057 1.592.069 4.747.069s3.508-.012 4.747-.069c1.013-.046 1.566-.215 1.932-.357.486-.189.833-.414 1.197-.778.364-.364.589-.711.778-1.197.142-.366.311-.919.357-1.932.057-1.239.069-1.592.069-4.747s-.012-3.508-.069-4.747c-.046-1.013-.215-1.566-.357-1.932-.189-.486-.414-.833-.778-1.197-.364-.364-.711-.589-1.197-.778-.366-.142-.919-.311-1.932-.357-1.239-.057-1.592-.069-4.747-.069zm0 3.064a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666zm5.338-9.87a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
              </svg>
            </a>
            <a
              href="https://x.com/blackfyretech"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X / Twitter"
              className="transition-colors hover:text-text"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/blackfyre-technologies/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="transition-colors hover:text-text"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

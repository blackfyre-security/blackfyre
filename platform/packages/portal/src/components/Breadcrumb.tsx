import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: "var(--text-muted)" }}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:underline" style={{ color: "var(--text-secondary)" }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

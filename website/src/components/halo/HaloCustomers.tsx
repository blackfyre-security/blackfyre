import { CUSTOMERS } from "@/lib/halo-data";

export interface HaloCustomersProps {
  /** Override the customer wordmarks. Defaults to the placeholder CUSTOMERS list. */
  customers?: readonly string[];
  eyebrow?: string;
  className?: string;
}

/**
 * Row of monochrome customer wordmarks under a small eyebrow. Pure SSR —
 * no interactivity. Uses placeholder names until real customer logos land.
 */
export default function HaloCustomers({
  customers = CUSTOMERS,
  eyebrow = "TRUSTED BY ENGINEERING TEAMS AT",
  className,
}: HaloCustomersProps) {
  return (
    <section
      className={[
        "border-b border-border px-6 py-10 sm:px-12",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          {eyebrow}
        </div>
        <div
          className="grid grid-cols-2 gap-1 text-text sm:grid-cols-5 lg:grid-cols-10"
          role="list"
        >
          {customers.map((c) => (
            <div
              key={c}
              role="listitem"
              className="border-r border-border py-2 text-center font-sans text-[13px] font-semibold tracking-[0.08em] opacity-60 last:border-r-0"
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

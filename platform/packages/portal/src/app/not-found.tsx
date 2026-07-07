import Link from "next/link";

function ShieldIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 animate-fade-in"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-md mb-6"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
        >
          <ShieldIcon />
        </div>
        <h1
          className="text-6xl font-bold mono mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          404
        </h1>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Page Not Found
        </h2>
        <p
          className="text-sm mb-8 max-w-sm mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Dashboard
        </Link>
        <p
          className="text-xs mono mt-10"
          style={{ color: "var(--text-muted)" }}
        >
          BLACKFYRE Audit Portal v1.0
        </p>
      </div>
    </div>
  );
}

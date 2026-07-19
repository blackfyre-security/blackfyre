"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Client-side auth guard for dashboard routes.
 *
 * Replaces the deleted middleware.ts. Static-export builds can't run server-side
 * middleware, so the redirect runs in the browser on mount.
 *
 * Checks for an access token in localStorage or the bf_portal_token cookie.
 * Missing → redirect to /login. Present → render children.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // The real auth cookies (bf_access_token/bf_refresh_token) are HttpOnly and
    // invisible to JS, so the guard keys on bf_portal_user — the non-HttpOnly
    // session cookie auth-context sets on successful login. The legacy
    // localStorage/bf_portal_token checks are kept for older sessions.
    const hasToken =
      typeof window !== "undefined" &&
      (localStorage.getItem("accessToken") ||
        localStorage.getItem("bf_portal_token") ||
        document.cookie.split("; ").some((c) => c.startsWith("bf_portal_token=")) ||
        document.cookie.split("; ").some((c) => c.startsWith("bf_portal_user=")));

    if (!hasToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setChecked(true);
  }, [router, pathname]);

  if (!checked) return null;
  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Client-side auth guard for admin dashboard routes.
 * Replaces the deleted middleware.ts since static export can't run middleware.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hasToken =
      typeof window !== "undefined" &&
      (localStorage.getItem("accessToken") ||
        localStorage.getItem("bf_admin_token") ||
        document.cookie.split("; ").some((c) => c.startsWith("bf_admin_token=")));

    if (!hasToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setChecked(true);
  }, [router, pathname]);

  if (!checked) return null;
  return <>{children}</>;
}

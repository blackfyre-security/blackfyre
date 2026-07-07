import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-replace-in-production!!";

function clearCookiesAndRedirect(url: string, request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL(url, request.url));
  response.cookies.set("bf_admin_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("bf_admin_refresh", "", { maxAge: 0, path: "/" });
  return response;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("bf_admin_token")?.value;
  const path = request.nextUrl.pathname;
  const isAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/api");

  if (isAsset) return NextResponse.next();

  if (path === "/login") {
    if (!token) return NextResponse.next();
    // Verify the token before redirecting logged-in users away from /login
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });
      if (payload.type !== "access") return NextResponse.next();
      return NextResponse.redirect(new URL("/", request.url));
    } catch {
      return NextResponse.next();
    }
  }

  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    // Enforce token type — must be an access token, not refresh/mfa_challenge/etc.
    if (payload.type !== "access") {
      return clearCookiesAndRedirect("/login", request);
    }
    return NextResponse.next();
  } catch {
    // Signature invalid, expired, or malformed — clear cookies and redirect
    return clearCookiesAndRedirect("/login", request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "pm_session_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow Next.js internals, static files, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // 1b. Enforce HTTPS in production / behind reverse proxy (Vercel, Cloudflare)
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("host") || request.nextUrl.host;
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  if (proto === "http" && !isLocal) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // 2. Allow auth, scheduler (Vercel cron), and recipient opt-out API endpoints
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/unsubscribe"
  ) {
    return NextResponse.next();
  }

  // 2b. Anti-CSRF Origin check for state-changing API mutations
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host.split(":")[0];
        const normalizedHost = host.split(":")[0];
        if (
          originHost !== normalizedHost &&
          !originHost.includes("localhost") &&
          !originHost.includes("127.0.0.1") &&
          !originHost.endsWith(".vercel.app")
        ) {
          return NextResponse.json(
            { success: false, error: "Błąd weryfikacji CSRF: niepoprawny nagłówek Origin." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "Błąd weryfikacji CSRF: nieprawidłowy nagłówek Origin." },
          { status: 403 }
        );
      }
    }
  }

  // 3. Allow public client offer landing pages (accessed by leads)
  if (pathname.startsWith("/offers") || pathname.startsWith("/o/")) {
    return NextResponse.next();
  }

  // 4. Allow /login and /invite pages (never redirect blindly from /login to prevent infinite loops)
  if (pathname === "/login" || pathname.startsWith("/invite")) {
    return NextResponse.next();
  }

  // 5. Protected routes: Check session cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "Wymagane uwierzytelnienie. Zaloguj się." },
        { status: 401 }
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/" && !pathname.startsWith("/login")) {
      loginUrl.searchParams.set("redirect", pathname);
    }
    if (!isLocal) {
      loginUrl.protocol = "https:";
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

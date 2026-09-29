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

  // 2. Allow auth API endpoints
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 3. Allow public client offer landing pages (accessed by leads)
  if (pathname.startsWith("/offers")) {
    return NextResponse.next();
  }

  // 4. Allow /login and /invite pages
  if (pathname === "/login" || pathname.startsWith("/invite")) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
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

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
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

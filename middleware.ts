import { NextRequest, NextResponse } from "next/server";
import { isSiteProtectionEnabled } from "@/lib/siteAuthStore";
import { validateSessionCookie, getSessionCookieName } from "@/lib/session";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Owner Area"' },
  });
}

function handleBasicAuth(req: NextRequest): NextResponse {
  const expectedUser = process.env.OWNER_USERNAME;
  const expectedPass = process.env.OWNER_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new NextResponse("Owner credentials are not configured.", { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorizedResponse();

  const base64 = auth.slice(6);
  const decoded = atob(base64);
  const separator = decoded.indexOf(":");
  if (separator < 0) return unauthorizedResponse();

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (username !== expectedUser || password !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Owner/admin routes: existing Basic Auth (unchanged)
  if (pathname.startsWith("/owner") || pathname.startsWith("/api/admin")) {
    return handleBasicAuth(req);
  }

  // Login page: always accessible
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // Auth API routes: always accessible (login/logout endpoints)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Cron endpoint: uses its own Bearer token auth
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Public routes: check if site protection is enabled
  const protectionEnabled = await isSiteProtectionEnabled();
  if (!protectionEnabled) {
    return NextResponse.next();
  }

  // Protection is on: validate session cookie
  const sessionCookie = req.cookies.get(getSessionCookieName())?.value;
  if (sessionCookie) {
    const { valid } = await validateSessionCookie(sessionCookie);
    if (valid) return NextResponse.next();
  }

  // No valid session: redirect pages, 401 for API
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

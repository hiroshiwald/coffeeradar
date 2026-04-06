import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { validateSessionCookie, getSessionCookieName } from "@/lib/session";

type AuthResult = { authorized: boolean; username: string };

const DENIED: AuthResult = { authorized: false, username: "" };

function isProtectionEnabled(): boolean {
  return process.env.SITE_PROTECTION_ENABLED === "true";
}

/** For use in Server Components (reads cookies via next/headers). */
export async function checkSiteAuth(): Promise<AuthResult> {
  try {
    if (!isProtectionEnabled()) return { authorized: true, username: "" };

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(getSessionCookieName())?.value;
    if (!sessionCookie) return DENIED;

    const { valid, username } = await validateSessionCookie(sessionCookie);
    return valid ? { authorized: true, username } : DENIED;
  } catch {
    return DENIED;
  }
}

/** For use in API Route Handlers (reads cookie from the incoming request). */
export async function checkSiteAuthFromRequest(req: NextRequest): Promise<AuthResult> {
  try {
    if (!isProtectionEnabled()) return { authorized: true, username: "" };

    const sessionCookie = req.cookies.get(getSessionCookieName())?.value;
    if (!sessionCookie) return DENIED;

    const { valid, username } = await validateSessionCookie(sessionCookie);
    return valid ? { authorized: true, username } : DENIED;
  } catch {
    return DENIED;
  }
}
